// DORA-metric signal extraction.
//
// True DORA metrics (Deployment Frequency, Lead Time, Change Failure
// Rate, MTTR) come from git + deployment history — out of scope for a
// static analyzer. But each metric has STATIC proxies that the project
// either has or doesn't, and that's what we surface here. Honest about
// the limitation: we don't claim "Daily" deploys, we say "CI exists,
// deploy-automation config exists, tests gate the merge."
//
// What we look at:
//
//   Deployment Frequency  — CI workflow files; deployment-platform
//                            configs (Dockerfile, vercel.json,
//                            render.yaml, fly.toml, app.yaml, etc.);
//                            existence of a `deploy` job in CI yaml.
//   Lead Time             — number of jobs in the primary CI workflow
//                            (more parallel = faster); test framework
//                            present; type-check step.
//   MTTR                  — observability deps (Sentry, Datadog,
//                            OpenTelemetry, Honeycomb, …); structured
//                            logging deps (pino, winston).
//   Change Failure Rate   — test framework; feature-flag deps
//                            (LaunchDarkly, Statsig, Unleash, …);
//                            CODEOWNERS file presence (review enforce).

import * as yaml from 'js-yaml';
import { hasTestFiles } from './test-presence.js';

export interface DoraSignals {
  // Deployment-frequency surface
  ciWorkflows: string[];                   // discovered .github/workflows/*.yml files
  deployPlatformConfigs: string[];         // Dockerfile, vercel.json, render.yaml, etc.
  hasDeployJob: boolean;                   // any CI workflow has a job that looks like a deploy step
  // Lead-time surface
  ciJobCount: number;                      // total jobs across discovered workflows
  hasTypeCheckStep: boolean;               // tsc / type-check step in CI
  hasTestFramework: boolean;
  // MTTR surface
  observabilityDeps: string[];             // matched dep names
  structuredLoggingDeps: string[];         // pino, winston, bunyan
  // Change-failure-rate surface
  featureFlagDeps: string[];
  hasCodeowners: boolean;
  hasGitHubBranchProtection: boolean;      // a branch-protection or settings yaml in .github/
}

const DEPLOY_PLATFORM_FILES = [
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'vercel.json', 'vercel.ts', 'render.yaml', 'render.yml',
  'fly.toml', 'app.yaml', 'app.yml', 'Procfile', 'netlify.toml',
  '.platform/applications.yaml', 'cloudbuild.yaml', 'cloudbuild.yml',
  'kubernetes/', 'k8s/', 'helm/', 'terraform/', '.tf',
  'serverless.yml', 'serverless.yaml',
];

const OBSERVABILITY_DEPS = new Set([
  '@sentry/node', '@sentry/browser', '@sentry/nextjs', '@sentry/react',
  '@datadog/browser-rum', 'dd-trace', 'datadog-metrics',
  'newrelic', '@newrelic/native-metrics',
  '@opentelemetry/api', '@opentelemetry/sdk-node', '@opentelemetry/sdk-trace-node',
  'honeycomb-beeline', '@honeycombio/opentelemetry-node',
  'opentracing', 'jaeger-client', 'zipkin-javascript-opentracing',
  '@logtail/node', '@logtail/winston', 'logflare',
  'rollbar', 'bugsnag', '@bugsnag/js',
  'prom-client', 'statsd-client',
]);

const STRUCTURED_LOGGING_DEPS = new Set([
  'pino', 'pino-http', 'pino-pretty', 'winston', 'bunyan', 'roarr',
]);

const FEATURE_FLAG_DEPS = new Set([
  '@growthbook/growthbook', '@growthbook/growthbook-react',
  'launchdarkly-js-client-sdk', 'launchdarkly-node-server-sdk', '@launchdarkly/node-server-sdk',
  '@statsig/js-client', 'statsig-js', 'statsig-node',
  'unleash-client', '@unleash/proxy-client-react',
  'flagsmith', 'flagsmith-nodejs', '@flagsmith/react-sdk',
  'posthog-js', 'posthog-node',
  'flipt-client', 'configcat-js', 'configcat-node',
  'split-software', '@splitsoftware/splitio',
]);

export function extractDoraSignals(
  fileContents: Record<string, string>,
  dependencies: string[],
  devDependencies: string[]
): DoraSignals {
  const allDeps = [...dependencies, ...devDependencies];
  const paths = Object.keys(fileContents);

  const ciWorkflows = paths.filter((p) =>
    /^\.github\/workflows\/.+\.ya?ml$/.test(p) || p === '.gitlab-ci.yml' || p === '.gitlab-ci.yaml'
    || p === 'azure-pipelines.yml' || p === 'azure-pipelines.yaml'
    || p === '.circleci/config.yml' || p === '.circleci/config.yaml'
    || p === 'bitbucket-pipelines.yml'
  );

  // Parse CI workflows to count jobs and look for deploy / type-check signals.
  let ciJobCount = 0;
  let hasDeployJob = false;
  let hasTypeCheckStep = false;
  for (const path of ciWorkflows) {
    const content = fileContents[path];
    if (!content) continue;
    let parsed: unknown;
    try { parsed = yaml.load(content); } catch { continue; }
    if (!parsed || typeof parsed !== 'object') continue;
    const jobs = (parsed as Record<string, unknown>).jobs;
    if (!jobs || typeof jobs !== 'object') continue;
    const jobEntries = Object.entries(jobs as Record<string, unknown>);
    ciJobCount += jobEntries.length;
    for (const [jobName, job] of jobEntries) {
      if (/(?:^|[-_])(deploy|publish|release|promote)(?:[-_]|$)/i.test(jobName)) hasDeployJob = true;
      if (typeof job === 'object' && job !== null) {
        const steps = (job as Record<string, unknown>).steps;
        if (Array.isArray(steps)) {
          for (const step of steps) {
            if (!step || typeof step !== 'object') continue;
            const run = (step as Record<string, unknown>).run;
            const name = (step as Record<string, unknown>).name;
            const blob = `${typeof run === 'string' ? run : ''} ${typeof name === 'string' ? name : ''}`;
            if (/\btsc\b|\btype-?check\b|\bcheck-types\b/i.test(blob)) hasTypeCheckStep = true;
            if (/\b(?:deploy|publish|release|promote)\b/i.test(blob)) hasDeployJob = true;
          }
        }
      }
    }
  }

  // Deployment platform configs — recognise by literal filename match.
  const deployPlatformConfigs: string[] = [];
  for (const p of paths) {
    const base = p.split('/').pop() ?? p;
    if (DEPLOY_PLATFORM_FILES.includes(base)) deployPlatformConfigs.push(p);
    else if (p.endsWith('.tf') || p.includes('/kubernetes/') || p.includes('/k8s/') || p.includes('/helm/') || p.includes('/terraform/')) {
      // Bucket of infrastructure-as-code that signals automated deploys.
      deployPlatformConfigs.push(p);
    }
  }

  const observabilityDeps = allDeps.filter((d) => OBSERVABILITY_DEPS.has(d));
  const structuredLoggingDeps = allDeps.filter((d) => STRUCTURED_LOGGING_DEPS.has(d));
  const featureFlagDeps = allDeps.filter((d) => FEATURE_FLAG_DEPS.has(d));

  // A root/workspace devDep is the strongest signal, but the test framework
  // may live in a top-level sibling package the workspace discovery misses
  // (see test-presence.ts). Test FILES on disk are the language-agnostic
  // fallback, consistent with the unit + mutation analyzers.
  const hasTestFramework = devDependencies.some((d) =>
    d === 'jest' || d === 'vitest' || d === 'mocha' || d === 'ava' || d === '@japa/runner'
  ) || hasTestFiles(fileContents);

  const hasCodeowners =
    paths.includes('.github/CODEOWNERS') || paths.includes('CODEOWNERS') || paths.includes('docs/CODEOWNERS');
  const hasGitHubBranchProtection =
    paths.includes('.github/branch-protection-rules.yml') ||
    paths.includes('.github/branch-protection.yml') ||
    paths.includes('.github/settings.yml');

  return {
    ciWorkflows,
    deployPlatformConfigs,
    hasDeployJob,
    ciJobCount,
    hasTypeCheckStep,
    hasTestFramework,
    observabilityDeps,
    structuredLoggingDeps,
    featureFlagDeps,
    hasCodeowners,
    hasGitHubBranchProtection,
  };
}
