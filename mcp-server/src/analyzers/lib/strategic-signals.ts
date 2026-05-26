// Strategic-dimension helpers (vision, scope, stack).
//
// The line-level substring matchers in strategic-analyzer.ts fooled
// themselves regularly. Examples that the old code thought present:
//   - "/v1/" in any code comment → "API versioning is in place"
//   - 'analytics' substring in any var name → "Has product analytics"
//   - 'user' substring → "User Management implemented"
//   - case-sensitive `fileContents['README.md']` missed `readme.md`,
//     `Readme.md`, `docs/README.md`.
//
// This module centralises the precise matchers and the README finder.

const README_PATHS = [
  'README.md', 'README.MD', 'Readme.md', 'readme.md',
  'README', 'readme', 'README.rst', 'README.txt',
  'docs/README.md', 'docs/readme.md', 'docs/README',
];

/** Find the README content from a fileContents map, case-insensitively. */
export function findReadme(fileContents: Record<string, string>): string {
  // Direct hits first
  for (const p of README_PATHS) {
    if (typeof fileContents[p] === 'string') return fileContents[p];
  }
  // Case-insensitive fallback
  const wanted = new Set(README_PATHS.map((p) => p.toLowerCase()));
  for (const [path, content] of Object.entries(fileContents)) {
    if (wanted.has(path.toLowerCase())) return content;
  }
  return '';
}

/* -------------------------------------------------------------------------- */
/* Exact dep matchers — single source of truth                                */
/* -------------------------------------------------------------------------- */

const PRODUCT_ANALYTICS_DEPS = new Set([
  'posthog-js', 'posthog-node', '@posthog/react',
  'mixpanel', 'mixpanel-browser', 'amplitude-js', '@amplitude/analytics-browser',
  '@segment/analytics-next', 'analytics-node',
  'heap-analytics', '@heap-analytics/web',
  'react-ga', 'react-ga4', 'ga-4-react', '@analytics/google-analytics',
  'fathom-client', 'plausible-tracker', 'umami-tracker',
]);

const FEATURE_FLAG_DEPS = new Set([
  '@growthbook/growthbook', '@growthbook/growthbook-react',
  'launchdarkly-js-client-sdk', 'launchdarkly-node-server-sdk', '@launchdarkly/node-server-sdk',
  '@statsig/js-client', 'statsig-js', 'statsig-node',
  'unleash-client', '@unleash/proxy-client-react',
  'flagsmith', 'flagsmith-nodejs', '@flagsmith/react-sdk',
  'flipt-client', 'configcat-js', 'configcat-node',
  '@splitsoftware/splitio',
]);

const ERROR_TRACKING_DEPS = new Set([
  '@sentry/node', '@sentry/browser', '@sentry/nextjs', '@sentry/react',
  'rollbar', '@bugsnag/js', 'bugsnag', '@bugsnag/react',
]);

const APM_DEPS = new Set([
  '@datadog/browser-rum', 'dd-trace', 'datadog-metrics',
  'newrelic', '@newrelic/native-metrics',
  '@opentelemetry/api', '@opentelemetry/sdk-node', '@opentelemetry/sdk-trace-node',
  'honeycomb-beeline', '@honeycombio/opentelemetry-node',
]);

export function hasProductAnalytics(allDeps: string[]): boolean {
  return allDeps.some((d) => PRODUCT_ANALYTICS_DEPS.has(d));
}

export function hasFeatureFlags(allDeps: string[]): boolean {
  return allDeps.some((d) => FEATURE_FLAG_DEPS.has(d));
}

export function hasErrorTracking(allDeps: string[]): boolean {
  return allDeps.some((d) => ERROR_TRACKING_DEPS.has(d));
}

export function hasAPM(allDeps: string[]): boolean {
  return allDeps.some((d) => APM_DEPS.has(d));
}

/* -------------------------------------------------------------------------- */
/* Feature-presence matching — word boundary, not substring                   */
/* -------------------------------------------------------------------------- */

/** True if any keyword in `keywords` appears in `content` as a whole word. */
export function hasAnyKeyword(content: string, keywords: string[]): boolean {
  for (const kw of keywords) {
    // Escape regex metachars in keyword (e.g. "auth/")
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match on a word boundary, case-insensitive
    const re = new RegExp(`\\b${esc}\\b`, 'i');
    if (re.test(content)) return true;
  }
  return false;
}

/** Extract the body of the first `## Features` (or similar) section from a README. */
export function extractFeaturesSection(readme: string): string {
  // Match a level-2 heading whose text contains "feature" or "what it does",
  // then capture content until the next level-2 heading or end-of-string.
  // JS regex doesn't support \Z, so we use a lookahead with `$(?![\s\S])`
  // (end of input) or `\n## `.
  const re = /^##\s+[^\n]*(?:features?|capabilities|what (?:it|we) do(?:es)?)[^\n]*\n([\s\S]*?)(?=\n##\s+|$(?![\s\S]))/im;
  const match = re.exec(readme);
  return match ? match[1] : '';
}
