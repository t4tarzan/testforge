// Strategic Analysis — dimensions competitors don't cover
// Vision alignment, scope coverage, stack choice, feature matrix

import {
  findReadme,
  hasProductAnalytics,
  hasFeatureFlags,
  hasErrorTracking,
  hasAPM,
  hasAnyKeyword,
  extractFeaturesSection,
} from './lib/strategic-signals.js';
import { hasTestFiles } from './lib/test-presence.js';
import { severityScore } from './lib/score.js';

export interface StrategicReport {
  vision: VisionAnalysis;
  scope: ScopeAnalysis;
  stack: StackAnalysis;
  featureMatrix: FeatureMatrixAnalysis;
}

export interface VisionAnalysis {
  score: number;
  findings: VisionFinding[];
  summary: string;
}

export interface VisionFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  category: string;
  filePath?: string;
  fixSuggestion: string;
}

export interface ScopeAnalysis {
  coverage: number;
  documentedFeatures: number;
  implementedFeatures: number;
  missingFeatures: string[];
  findings: VisionFinding[];
}

export interface StackAnalysis {
  score: number;
  stack: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  findings: VisionFinding[];
}

export interface FeatureMatrixAnalysis {
  traceability: number;
  features: Array<{
    name: string;
    implemented: boolean;
    files: string[];
    testCoverage: number;
  }>;
  findings: VisionFinding[];
}

/**
 * Analyze vision/goal alignment in a codebase.
 * Checks for metrics, observability, feature flags, and business goal indicators.
 */
export async function runVisionAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  devDependencies: string[]
): Promise<VisionAnalysis> {
  const findings: VisionFinding[] = [];
  const allDeps = [...dependencies, ...devDependencies];

  // ── Observability is split into APM (tracing/metrics) and error tracking
  //    (Sentry/Rollbar/Bugsnag). Both matter; recognize them separately.
  const observabilityPresent = hasAPM(allDeps) || hasErrorTracking(allDeps);
  if (!observabilityPresent) {
    findings.push({
      severity: 'high',
      title: 'No observability stack detected',
      description: 'No APM (OpenTelemetry/Datadog/NewRelic/Honeycomb) and no error tracking (Sentry/Rollbar/Bugsnag) dep detected. Without these, you can\'t correlate user-impacting issues with code changes.',
      category: 'Observability',
      fixSuggestion: 'Start with Sentry — fastest path to crash/error visibility. Add OpenTelemetry if you need full tracing. Wire up alerts to a notification channel humans actually read.',
    });
  }

  // ── Feature flag platform — strict dep name matching now.
  if (!hasFeatureFlags(allDeps)) {
    findings.push({
      severity: 'medium',
      title: 'No feature-flag platform',
      description: 'Feature flags decouple deploy from release: kill-switch on regressions, staged rollouts to a % of users, A/B test cohorts. Releases without them are all-or-nothing.',
      category: 'Delivery Velocity',
      fixSuggestion: 'For early-stage: Posthog (free tier, JS-SDK-only). For larger teams: LaunchDarkly / Statsig. Even a homegrown flags table beats no kill-switch.',
    });
  }

  // ── Product analytics — strict dep name matching (was: substring of "analytics" matched cache-analytics, crypto-analytics-lib, …).
  if (!hasProductAnalytics(allDeps)) {
    findings.push({
      severity: 'high',
      title: 'No product analytics dependency',
      description: 'No Posthog / Mixpanel / Amplitude / Segment / Heap / Plausible / Fathom dep detected. Without telemetry on feature adoption + user journeys, you can\'t close the loop between code shipped and value delivered.',
      category: 'Product Intelligence',
      fixSuggestion: 'PostHog (open source, generous free tier) is the lowest-friction start. Track 3-5 key events: signup, activation, first-value-moment, retention, churn signal.',
    });
  }

  // ── API versioning — match on path-segment, not loose `/v1/` substring.
  const allContent = Object.values(fileContents).join('\n');
  const hasVersioning = /['"`]\/v\d+\//.test(allContent);
  if (!hasVersioning && Object.keys(fileContents).length > 10) {
    findings.push({
      severity: 'low',
      title: 'No API versioning convention',
      description: 'No `/v1/`, `/v2/` path-prefixed routes detected (as string literals — not comments). Breaking changes will hit every consumer at once.',
      category: 'API Maturity',
      fixSuggestion: 'Adopt URL-based versioning (`/v1/users`). Document the deprecation policy in your README.',
    });
  }

  // Removed: the CI/CD finding from this dimension. CI/CD is now DORA's
  // territory (pass 12, lib/dora-signals.ts) — surfacing it from two
  // dimensions made the dashboard noisy.

  // Diminishing returns: missing vision/observability signals shouldn't cliff to 0.
  const score = severityScore(findings, 5);

  return {
    score,
    findings,
    summary: score >= 80
      ? 'Product-engineering vision signals look strong: observability + analytics + feature flags wired up.'
      : score >= 50
        ? 'Some vision signals present but key telemetry / flag infrastructure is missing.'
        : 'Critical gaps in product-engineering vision: cannot measure feature adoption or roll back regressions.',
  };
}

/**
 * Analyze scope coverage — are documented features actually implemented?
 * Heuristic: checks README, package.json description, API routes for feature mentions.
 */
export async function runScopeAnalysis(
  fileContents: Record<string, string>,
  _dependencies: string[]
): Promise<ScopeAnalysis> {
  const findings: VisionFinding[] = [];
  // For implementation detection, scan SOURCE files only — including
  // the README in `allContent` would let documentation satisfy its
  // own claim. Exclude .md / .markdown / .rst / .txt and package.json
  // (often duplicates README prose).
  const implContent = Object.entries(fileContents)
    .filter(([p]) =>
      !/\.(?:md|markdown|rst|txt)$/i.test(p) &&
      p !== 'package.json' &&
      !/(?:^|\/)README(?:\.[a-zA-Z]+)?$/i.test(p)
    )
    .map(([, v]) => v)
    .join('\n');
  const readme = findReadme(fileContents);
  // Prefer matching against an explicit Features section in the README;
  // fall back to the full README only if no such section exists.
  const featuresSection = extractFeaturesSection(readme);
  const docHaystack = featuresSection || readme;

  // Feature patterns now match on WORD BOUNDARIES (not substring), so
  // "auth" no longer matches "author" / "authorization-library-name".
  const featurePatterns = [
    { name: 'Authentication',  patterns: ['auth', 'login', 'signup', 'register', 'jwt', 'oauth', 'sso', 'authentication', 'session'] },
    { name: 'Payments',        patterns: ['payment', 'payments', 'stripe', 'checkout', 'billing', 'invoice', 'invoices', 'subscription', 'subscriptions'] },
    { name: 'Search',          patterns: ['search', 'filter', 'elasticsearch', 'meilisearch', 'algolia', 'full-text'] },
    { name: 'Notifications',   patterns: ['notification', 'notifications', 'email', 'webhook', 'webhooks', 'sms', 'push'] },
    { name: 'File Upload',     patterns: ['upload', 'uploads', 'attachment', 'attachments', 's3', 'cloudinary', 'multer'] },
    { name: 'API',             patterns: ['api', 'rest', 'graphql', 'grpc', 'openapi', 'swagger'] },
    { name: 'Admin/Dashboard', patterns: ['admin', 'dashboard', 'panel', 'console'] },
    { name: 'Reporting',       patterns: ['report', 'reports', 'export', 'exports', 'csv', 'xlsx', 'pdf'] },
    { name: 'User Management', patterns: ['user management', 'users', 'profile', 'profiles', 'roles', 'permissions', 'rbac'] },
    { name: 'Real-time',       patterns: ['websocket', 'websockets', 'sse', 'real-time', 'realtime', 'streaming', 'live updates'] },
  ];

  const documentedFeatures: string[] = [];
  const implementedFeatures: string[] = [];
  const missingFeatures: string[] = [];
  const features: FeatureMatrixAnalysis['features'] = [];

  for (const fp of featurePatterns) {
    const isDocumented = hasAnyKeyword(docHaystack, fp.patterns);
    const isImplemented = hasAnyKeyword(implContent, fp.patterns);

    if (isDocumented) documentedFeatures.push(fp.name);
    if (isImplemented) implementedFeatures.push(fp.name);
    if (isDocumented && !isImplemented) missingFeatures.push(fp.name);

    features.push({
      name: fp.name,
      implemented: isImplemented,
      files: [],
      testCoverage: isImplemented ? 50 : 0,
    });
  }

  if (missingFeatures.length > 0) {
    findings.push({
      severity: 'high',
      title: `${missingFeatures.length} documented feature(s) not implemented`,
      description: `Feature mentioned in README but no matching keyword found in source: ${missingFeatures.join(', ')}. Scope misaligned between documentation and code.`,
      category: 'Scope Gap',
      fixSuggestion: `Either implement: ${missingFeatures.slice(0, 3).join(', ')}, or update documentation to reflect the current scope.`,
    });
  }

  if (!readme) {
    findings.push({
      severity: 'medium',
      title: 'No README found',
      description: 'No `README.md` / `README` / `docs/README.md` (case-insensitive) found. Without a top-level README, the project\'s scope and onboarding are invisible.',
      category: 'Documentation',
      fixSuggestion: 'Add a `README.md` to the repo root. At minimum: what the project does (one paragraph), how to run it, and a Features section listing key capabilities.',
    });
  } else if (documentedFeatures.length === 0) {
    findings.push({
      severity: 'medium',
      title: 'README has no recognisable feature documentation',
      description: 'README found, but no `## Features` section and no feature keywords matched anywhere. This makes scope traceability impossible.',
      category: 'Documentation',
      fixSuggestion: 'Add a `## Features` section to the README listing the product capabilities. Each bullet should be specific (e.g. "OAuth signup via Google + GitHub" rather than "Authentication").',
    });
  }

  const coverage = documentedFeatures.length > 0
    ? Math.round((implementedFeatures.length / documentedFeatures.length) * 100)
    : 0;

  return {
    coverage,
    documentedFeatures: documentedFeatures.length,
    implementedFeatures: implementedFeatures.length,
    missingFeatures,
    findings,
  };
}

/**
 * Analyze tech stack choices — is the stack appropriate for the use case?
 */
// Stack analysis (pass 16 — strict dep-name matching + extra signals).
//
// The previous version used `dep.includes('vite')` which would have
// fooled itself: vitest is a TEST framework, not a bundler, but
// "vite" is a substring of "vitest". Same risk with `.includes('jest')`
// matching unrelated packages. Now uses strict Sets per category.
//
// Added signals:
//   - tsconfig strict mode detection (TypeScript without strict is
//     still risky)
//   - Modern framework detection (Next.js / Remix / Astro / SvelteKit / Nuxt)
//   - Runtime type validation (Zod / Yup / Joi / ajv / typia / valibot)
//   - tRPC / type-safe RPC stack signal

const TEST_FRAMEWORK_DEPS = new Set([
  'jest', 'vitest', 'mocha', 'ava', 'tap', 'node-tap',
  '@japa/runner', 'uvu', 'tape',
]);

const LINT_DEPS = new Set([
  'eslint', 'prettier', '@biomejs/biome', 'biome', 'rome',
  'standard', 'xo', 'oxlint',
]);

const ORM_DEPS = new Set([
  'prisma', '@prisma/client', 'drizzle-orm', 'drizzle-kit',
  'typeorm', 'sequelize', 'sequelize-typescript',
  'mongoose', 'mikro-orm', '@mikro-orm/core',
  'kysely', 'knex', 'objection',
]);

const CACHE_DEPS = new Set([
  'redis', 'ioredis', 'node-redis', '@upstash/redis',
  'memcached', 'lru-cache', '@isaacs/lru-cache',
  'node-cache', 'cache-manager',
]);

const MONOREPO_DEPS = new Set([
  'turbo', 'nx', '@nrwl/nx', 'lerna', 'rush', '@microsoft/rush',
  '@changesets/cli', 'changesets',
]);

// "Modern bundler" specifically — NOT vitest (which contains "vite").
const MODERN_BUNDLER_DEPS = new Set([
  'vite', '@vitejs/plugin-react', '@vitejs/plugin-vue',
  'esbuild', '@esbuild/linux-x64',
  '@swc/core', '@swc/cli',
  'turbopack', '@parcel/core', 'parcel',
  'rspack', '@rspack/core',
  'rollup',
]);

const MODERN_FRAMEWORK_DEPS = new Set([
  'next', 'remix', 'react-router', '@remix-run/node',
  'astro', '@astrojs/node', 'nuxt', '@nuxt/kit',
  'svelte', 'svelte-kit', '@sveltejs/kit',
  'solid-js', '@solidjs/start', 'qwik', '@builder.io/qwik',
  'hono', 'h3',
]);

const VALIDATION_DEPS = new Set([
  'zod', 'yup', 'joi', 'ajv', 'typia',
  'valibot', 'arktype', 'effect', 'io-ts',
  'class-validator', 'superstruct', 'runtypes',
]);

const TRPC_DEPS = new Set([
  '@trpc/server', '@trpc/client', '@trpc/react-query', '@trpc/next',
]);

const TS_RUNTIMES = new Set(['tsx', 'tsm', 'ts-node', 'esno', '@swc-node/register']);

export async function runStackAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  devDependencies: string[],
  techStack: string[]
): Promise<StackAnalysis> {
  const findings: VisionFinding[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  const allDeps = [...dependencies, ...devDependencies];
  const has = (set: Set<string>) => allDeps.some((d) => set.has(d));
  const matched = (set: Set<string>) => allDeps.filter((d) => set.has(d));

  // ── TypeScript adoption (techStack-based, untouched)
  const hasTypeScript = techStack.includes('TypeScript');
  if (hasTypeScript) {
    strengths.push('TypeScript provides type safety and better developer experience');
  } else if (dependencies.length > 10) {
    findings.push({
      severity: 'medium',
      title: 'JavaScript without TypeScript',
      description: `${dependencies.length} dependencies in JavaScript. TypeScript would catch a class of runtime errors at compile time, especially across module boundaries.`,
      category: 'Stack Quality',
      fixSuggestion: 'Migrate incrementally: rename files to .ts one at a time. Start with `"strict": false` and tighten over weeks.',
    });
    weaknesses.push('Missing TypeScript — higher risk of runtime type errors');
  }

  // ── tsconfig strict mode detection (new in pass 16)
  if (hasTypeScript && fileContents['tsconfig.json']) {
    try {
      const ts = JSON.parse(fileContents['tsconfig.json']);
      const co = (ts.compilerOptions ?? {}) as Record<string, unknown>;
      const strict = co.strict === true ||
        (co.strictNullChecks === true && co.noImplicitAny === true);
      if (strict) {
        strengths.push('tsconfig strict mode enabled — catches null/undefined errors at compile time');
      } else {
        findings.push({
          severity: 'low',
          title: 'TypeScript without strict mode',
          description: 'tsconfig.json found but `compilerOptions.strict` is not true. The default loose mode lets `any`-typed values flow freely; null/undefined errors slip past the compiler.',
          category: 'Stack Quality',
          fixSuggestion: 'Set `"strict": true` in tsconfig (turns on strictNullChecks, noImplicitAny, strictFunctionTypes, etc.). For an existing codebase, use `tsc --noEmit` to see what breaks, then file by file.',
        });
      }
    } catch { /* unparseable — ignore */ }
  }

  // ── Test framework — strict Set match on deps, with a test-FILE fallback so
  // a monorepo whose framework lives in a top-level sibling package (e.g.
  // testforge's mcp-server/) isn't mis-flagged as testless. See test-presence.ts.
  const matchedTestDeps = matched(TEST_FRAMEWORK_DEPS);
  const hasTesting = matchedTestDeps.length > 0 || hasTestFiles(fileContents);
  if (hasTesting) {
    strengths.push(matchedTestDeps.length > 0
      ? `Testing framework configured (${matchedTestDeps.join(', ')})`
      : 'Testing framework configured (test files detected)');
  } else {
    findings.push({
      severity: 'high',
      title: 'No testing framework detected',
      description: 'No jest / vitest / mocha / ava / tap dep found. Tests are the #1 predictor of low regression rates.',
      category: 'Stack Quality',
      fixSuggestion: 'Vitest is the fast modern default (Vite-native, ESM-first). Start with unit tests for the most-edited modules.',
    });
    weaknesses.push('No testing framework — cannot verify code correctness');
  }

  // ── Linting (Set match)
  if (has(LINT_DEPS)) {
    strengths.push(`Linting/formatting configured (${matched(LINT_DEPS).join(', ')})`);
  }

  // ── DB + ORM — strict Set match for ORM.
  const hasDB = techStack.some((t) => ['MongoDB', 'PostgreSQL', 'MySQL', 'SQLite'].includes(t));
  const hasORM = has(ORM_DEPS);
  if (hasDB && !hasORM) {
    findings.push({
      severity: 'medium',
      title: 'Database without ORM',
      description: 'A database is in use, but no ORM/query-builder (Prisma / Drizzle / TypeORM / Mongoose / Kysely / Knex) dep is declared.',
      category: 'Stack Safety',
      fixSuggestion: 'Drizzle (lightweight, SQL-first) or Prisma (heavier, migrations + Studio) for relational. Mongoose for MongoDB. Direct queries are error-prone.',
    });
    weaknesses.push('No ORM — direct DB access is error-prone');
  }
  if (hasORM) strengths.push(`ORM/ODM configured (${matched(ORM_DEPS).join(', ')})`);

  // ── Cache (Set match — no more substring "cache" false positives)
  const hasCache = has(CACHE_DEPS);
  if (dependencies.length > 15 && !hasCache) {
    findings.push({
      severity: 'low',
      title: 'No caching layer for growing app',
      description: `${dependencies.length} direct deps, no Redis / ioredis / memcached / LRU-cache. Even an in-process LRU pays off for hot paths.`,
      category: 'Performance',
      fixSuggestion: 'Cache layer for queries + sessions + rate-limit counters. Redis for cross-instance share, LRU-cache for in-process hot data.',
    });
  }

  // ── Monorepo tooling (Set + turbo.json presence)
  const isMonorepo = has(MONOREPO_DEPS) || fileContents['turbo.json'] !== undefined
    || fileContents['nx.json'] !== undefined || fileContents['pnpm-workspace.yaml'] !== undefined;
  if (isMonorepo) strengths.push('Monorepo tooling detected — organized codebase structure');

  if (dependencies.length > 20 && !isMonorepo) {
    findings.push({
      severity: 'low',
      title: 'Large app without monorepo tooling',
      description: `${dependencies.length} deps without a workspace manager (Turborepo / Nx / pnpm workspaces). Build cache and parallelism are leaving cycles on the table.`,
      category: 'Architecture',
      fixSuggestion: 'Turborepo has the lowest adoption cost (drop-in for existing repos). Nx is heavier but ships codegen + generators.',
    });
  }

  // ── Bundler — strict Set match so "vite" no longer counts when only
  //    "vitest" is present.
  const bundlerHits = matched(MODERN_BUNDLER_DEPS);
  if (bundlerHits.length > 0) {
    strengths.push(`Modern bundler (${bundlerHits.join(', ')}) — fast development experience`);
  }

  // ── Framework — NEW in pass 16
  const frameworkHits = matched(MODERN_FRAMEWORK_DEPS);
  if (frameworkHits.length > 0) {
    strengths.push(`Modern framework (${frameworkHits.join(', ')})`);
  }

  // ── Runtime validation — NEW
  if (has(VALIDATION_DEPS)) {
    const v = matched(VALIDATION_DEPS).join(', ');
    strengths.push(`Runtime validation library detected (${v}) — type-safe boundary parsing`);
  } else if (dependencies.length > 10 && techStack.some((t) => ['Express', 'Fastify', 'Koa', 'Hono', 'NestJS'].includes(t))) {
    findings.push({
      severity: 'medium',
      title: 'API server without runtime validation library',
      description: 'No Zod / Yup / Joi / ajv / Valibot / Effect dep found in an API server. Request bodies cross trust boundaries — TS types alone don\'t enforce them at runtime.',
      category: 'Stack Safety',
      fixSuggestion: 'Zod is the most popular modern choice (TS-first, derives types). Pipe every request body through a parsed schema before any handler logic runs.',
    });
  }

  // ── tRPC — NEW
  if (has(TRPC_DEPS)) {
    strengths.push('tRPC detected — end-to-end type-safe API surface');
  }

  // ── TS runtime — NEW (acknowledges projects running TS without a build step)
  if (has(TS_RUNTIMES)) {
    strengths.push(`TypeScript runtime detected (${matched(TS_RUNTIMES).join(', ')}) — running TS without a build step`);
  }

  // ── Score: base 70, +5 per strength, weighted finding deductions.
  const score = Math.max(0, 70 + strengths.length * 5 - findings.reduce((s, f) =>
    s + (f.severity === 'high' ? 15 : f.severity === 'medium' ? 8 : 3), 0
  ));

  recommendations.push(
    hasTesting ? 'Maintain test coverage above 70%' : 'Add a testing framework immediately',
    hasTypeScript ? 'Enable strict mode in tsconfig' : 'Consider TypeScript migration',
    'Review dependencies monthly for security updates',
    hasDB ? 'Ensure database backups are automated' : 'Set up database backup strategy',
    has(VALIDATION_DEPS) ? 'Pipe every request through a Zod/Valibot schema before handler logic'
                         : 'Add a runtime validation library at the request boundary',
  );

  return {
    score: Math.min(100, score),
    stack: techStack,
    strengths,
    weaknesses,
    recommendations,
    findings,
  };
}
