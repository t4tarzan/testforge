// Strategic Analysis — dimensions competitors don't cover
// Vision alignment, scope coverage, stack choice, feature matrix

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
  const allContent = Object.values(fileContents).join('\n');

  // Check for observability/metrics
  const hasMetrics = dependencies.some(d =>
    d.includes('prometheus') || d.includes('datadog') || d.includes('newrelic') ||
    d.includes('opentelemetry') || d.includes('sentry') || d.includes('bugsnag') ||
    d.includes('logrocket')
  );

  if (!hasMetrics) {
    findings.push({
      severity: 'high',
      title: 'No Observability/Metrics Detected',
      description: 'Without metrics, you cannot measure if your product is achieving its business goals. Add monitoring to track user behavior, performance, and business KPIs.',
      category: 'Observability',
      fixSuggestion: 'Add OpenTelemetry for tracing, Prometheus for metrics, and Sentry for error tracking. Set up dashboards for key business metrics.',
    });
  }

  // Check for feature flags
  const hasFeatureFlags = dependencies.some(d =>
    d.includes('launchdarkly') || d.includes('unleash') || d.includes('flagsmith') ||
    d.includes('growthbook') || d.includes('feature-flags')
  );

  if (!hasFeatureFlags) {
    findings.push({
      severity: 'medium',
      title: 'No Feature Flag System',
      description: 'Feature flags enable gradual rollouts, A/B testing, and quick rollbacks. Without them, every release is all-or-nothing — increasing deployment risk.',
      category: 'Delivery Velocity',
      fixSuggestion: 'Integrate LaunchDarkly, Unleash, or GrowthBook. Use feature flags for all new features to enable canary releases and A/B testing.',
    });
  }

  // Check for analytics
  const hasAnalytics = dependencies.some(d =>
    d.includes('analytics') || d.includes('mixpanel') || d.includes('amplitude') ||
    d.includes('segment') || d.includes('posthog') || d.includes('heap') ||
    d.includes('ga4') || d.includes('google-analytics')
  );

  if (!hasAnalytics) {
    findings.push({
      severity: 'high',
      title: 'No Product Analytics',
      description: 'You cannot improve what you cannot measure. Product analytics tell you if features are actually delivering value to users.',
      category: 'Product Intelligence',
      fixSuggestion: 'Add PostHog (open-source) or Mixpanel for product analytics. Track feature adoption, user journeys, and conversion funnels.',
    });
  }

  // Check for CI/CD maturity
  const hasCI = fileContents['.github/workflows'] !== undefined ||
    dependencies.some(d => d.includes('jest') || d.includes('vitest')) ||
    allContent.includes('npm test') || allContent.includes('npm run test');

  if (!hasCI && Object.keys(fileContents).length > 5) {
    findings.push({
      severity: 'medium',
      title: 'No CI/CD Pipeline Detected',
      description: 'Without CI/CD, you cannot ship with confidence. Automated testing and deployment are essential for maintaining velocity.',
      category: 'Delivery Pipeline',
      fixSuggestion: 'Set up GitHub Actions or GitLab CI. Add automated testing, linting, and deployment pipelines.',
    });
  }

  // Check for API versioning (indicates product maturity)
  const hasVersioning = allContent.includes('/v1/') || allContent.includes('/v2/') ||
    allContent.includes('api-version') || allContent.includes('apiVersion');

  if (!hasVersioning && Object.keys(fileContents).length > 10) {
    findings.push({
      severity: 'low',
      title: 'No API Versioning',
      description: 'As your product grows, API versioning becomes critical for maintaining backward compatibility while shipping new features.',
      category: 'API Maturity',
      fixSuggestion: 'Implement API versioning via URL path (/v1/, /v2/) or header-based versioning. Document breaking changes.',
    });
  }

  // Calculate score
  const deductions = findings.reduce((sum, f) =>
    sum + (f.severity === 'high' ? 20 : f.severity === 'medium' ? 10 : 5), 0
  );
  const score = Math.max(0, 100 - deductions);

  return {
    score,
    findings,
    summary: score >= 80
      ? 'Strong product engineering practices. Well-instrumented for measuring success.'
      : score >= 50
        ? 'Basic engineering in place but missing key observability and delivery practices.'
        : 'Critical gaps in observability and delivery pipeline. Cannot effectively measure product success.',
  };
}

/**
 * Analyze scope coverage — are documented features actually implemented?
 * Heuristic: checks README, package.json description, API routes for feature mentions.
 */
export async function runScopeAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[]
): Promise<ScopeAnalysis> {
  const findings: VisionFinding[] = [];
  const allContent = Object.values(fileContents).join('\n').toLowerCase();

  // Extract mentioned features from README/package.json
  const readme = fileContents['README.md'] || '';
  const pkgJson = fileContents['package.json'] || '';

  // Detect feature mentions in documentation
  const featurePatterns = [
    { name: 'Authentication', patterns: ['auth', 'login', 'signup', 'register', 'jwt', 'oauth', 'sso'] },
    { name: 'Payments', patterns: ['payment', 'stripe', 'checkout', 'billing', 'invoice', 'subscription'] },
    { name: 'Search', patterns: ['search', 'filter', 'query', 'elasticsearch', 'full-text'] },
    { name: 'Notifications', patterns: ['notification', 'email', 'alert', 'push', 'webhook'] },
    { name: 'File Upload', patterns: ['upload', 'file', 'image', 'storage', 's3', 'multer'] },
    { name: 'API/Integration', patterns: ['api', 'rest', 'graphql', 'webhook', 'integration'] },
    { name: 'Admin/Dashboard', patterns: ['admin', 'dashboard', 'panel', 'manage'] },
    { name: 'Reporting', patterns: ['report', 'analytics', 'export', 'csv', 'pdf', 'chart'] },
    { name: 'User Management', patterns: ['user', 'profile', 'account', 'role', 'permission'] },
    { name: 'Real-time', patterns: ['websocket', 'socket', 'real-time', 'live', 'streaming'] },
  ];

  const documentedFeatures: string[] = [];
  const implementedFeatures: string[] = [];
  const missingFeatures: string[] = [];
  const features: FeatureMatrixAnalysis['features'] = [];

  for (const fp of featurePatterns) {
    const isDocumented = fp.patterns.some(p => readme.includes(p) || pkgJson.includes(p));
    const isImplemented = fp.patterns.some(p => allContent.includes(p));

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
      title: `${missingFeatures.length} Documented Features Not Implemented`,
      description: `Features mentioned in docs but not found in code: ${missingFeatures.join(', ')}. This indicates scope misalignment between documentation and implementation.`,
      category: 'Scope Gap',
      fixSuggestion: `Either implement: ${missingFeatures.slice(0, 3).join(', ')} or update documentation to reflect current scope.`,
    });
  }

  if (documentedFeatures.length === 0) {
    findings.push({
      severity: 'medium',
      title: 'No Feature Documentation Found',
      description: 'README.md and package.json do not describe product features. This makes scope testing impossible and indicates poor documentation practices.',
      category: 'Documentation',
      fixSuggestion: 'Add a Features section to README.md listing all product capabilities. This enables scope traceability.',
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

  // Check for containerization
  const hasDocker = 'Dockerfile' in fileContents || 'docker-compose.yml' in fileContents ||
    'docker-compose.yaml' in fileContents;

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
