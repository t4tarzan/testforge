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

  const deductions = findings.reduce((sum, f) =>
    sum + (f.severity === 'high' ? 20 : f.severity === 'medium' ? 10 : 5), 0
  );
  const score = Math.max(0, 100 - deductions);

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

  // Check TypeScript adoption
  const hasTypeScript = techStack.includes('TypeScript');
  if (hasTypeScript) {
    strengths.push('TypeScript provides type safety and better developer experience');
  } else if (dependencies.length > 10) {
    findings.push({
      severity: 'medium',
      title: 'JavaScript Without TypeScript',
      description: 'For projects with 10+ dependencies, TypeScript significantly reduces runtime errors and improves maintainability.',
      category: 'Stack Quality',
      fixSuggestion: 'Migrate to TypeScript. Start with strict: false and gradually enable stricter checks.',
    });
    weaknesses.push('Missing TypeScript — higher risk of runtime type errors');
  }

  // Check for testing framework
  const hasTesting = devDependencies.some(d =>
    d.includes('jest') || d.includes('vitest') || d.includes('mocha') || d.includes('ava')
  );
  if (hasTesting) {
    strengths.push('Testing framework configured — enabling quality assurance');
  } else {
    findings.push({
      severity: 'high',
      title: 'No Testing Framework',
      description: 'No test framework detected. This is the #1 predictor of production bugs and regression issues.',
      category: 'Stack Quality',
      fixSuggestion: 'Add Vitest (fast, Vite-native) or Jest. Start with unit tests for critical business logic.',
    });
    weaknesses.push('No testing framework — cannot verify code correctness');
  }

  // Check for linting/formatting
  const hasLinting = devDependencies.some(d =>
    d.includes('eslint') || d.includes('prettier') || d.includes('biome')
  );
  if (hasLinting) {
    strengths.push('Linting/formatting configured — consistent code quality');
  }

  // Check for ORM/database layer
  const hasDB = techStack.some(t => ['MongoDB', 'PostgreSQL', 'MySQL'].includes(t));
  const hasORM = dependencies.some(d =>
    d.includes('prisma') || d.includes('drizzle') || d.includes('typeorm') ||
    d.includes('sequelize') || d.includes('mongoose')
  );
  if (hasDB && !hasORM) {
    findings.push({
      severity: 'medium',
      title: 'Database Without ORM',
      description: 'Direct database access without an ORM increases risk of SQL injection and makes migrations difficult.',
      category: 'Stack Safety',
      fixSuggestion: 'Add Prisma or Drizzle ORM for type-safe database access, automatic migrations, and query optimization.',
    });
    weaknesses.push('No ORM — direct DB access is error-prone');
  }
  if (hasORM) {
    strengths.push('ORM/ODM configured — type-safe database operations');
  }

  // Check for caching layer
  const hasCache = dependencies.some(d => d.includes('redis') || d.includes('ioredis'));
  if (dependencies.length > 15 && !hasCache) {
    findings.push({
      severity: 'low',
      title: 'No Caching Layer for Growing App',
      description: 'With 15+ dependencies, your app likely has performance-sensitive paths that would benefit from caching.',
      category: 'Performance',
      fixSuggestion: 'Add Redis for caching frequent queries, sessions, and rate limiting.',
    });
  }

  // Check for monorepo tooling
  const isMonorepo = dependencies.some(d => d.includes('turbo') || d.includes('nx') || d.includes('lerna')) ||
    fileContents['turbo.json'] !== undefined;

  if (isMonorepo) {
    strengths.push('Monorepo tooling detected — organized codebase structure');
  }

  if (dependencies.length > 20 && !isMonorepo) {
    findings.push({
      severity: 'low',
      title: 'Large App Without Monorepo Tooling',
      description: 'With 20+ dependencies, consider monorepo tooling (Turborepo/Nx) for better build caching and organization.',
      category: 'Architecture',
      fixSuggestion: 'Evaluate Turborepo or Nx for build caching, parallel task execution, and dependency graph visualization.',
    });
  }

  // Bundler check
  const usesModernBundler = dependencies.some(d =>
    d.includes('vite') || d.includes('esbuild') || d.includes('swc') || d.includes('turbopack')
  );
  if (usesModernBundler) {
    strengths.push('Modern bundler (Vite/esbuild) — fast development experience');
  }

  const score = Math.max(0, 70 + strengths.length * 5 - findings.reduce((s, f) =>
    s + (f.severity === 'high' ? 15 : f.severity === 'medium' ? 8 : 3), 0
  ));

  recommendations.push(
    hasTesting ? 'Maintain test coverage above 70%' : 'Add a testing framework immediately',
    hasTypeScript ? 'Enable strict mode in tsconfig' : 'Consider TypeScript migration',
    'Review dependencies monthly for security updates',
    hasDB ? 'Ensure database backups are automated' : 'Set up database backup strategy'
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
