import chalk from 'chalk';

/* -------------------------------------------------------------------------- */
/*                                 Types                                      */
/* -------------------------------------------------------------------------- */

interface FindingRecord {
  id: string;
  dimension: string;
  severity: string;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  fixSuggestion: string;
  category: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

interface TestRunRecord {
  id: string;
  projectPath: string;
  branch?: string;
  dimensions: string[];
  status: string;
  startedAt: string;
  completedAt?: string;
  summary?: Record<string, unknown>;
  error?: string;
}

interface DatabaseClient {
  getTestRun: (id: string) => Promise<TestRunRecord | null | undefined>;
  getFindings: (testRunId: string) => Promise<FindingRecord[]>;
  updateTestRun: (id: string, data: Record<string, unknown>) => Promise<unknown>;
}

interface RemediationPhase {
  name: string;
  priority: string;
  timeframe: string;
  items: string[];
}

interface PRDReport {
  testRunId: string;
  generatedAt: string;
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    dimensionsAnalyzed: string[];
    projectPath: string;
    status: string;
    duration?: string;
  };
  findingsBySeverity: Record<string, FindingRecord[]>;
  findingsByDimension: Record<string, FindingRecord[]>;
  topIssues: Array<{
    severity: string;
    title: string;
    description: string;
    filePath: string;
    fixSuggestion: string;
  }>;
  remediationPlan: RemediationPhase[];
  metrics: {
    securityScore: number;
    reliabilityScore: number;
    performanceScore: number;
    accessibilityScore: number;
    overallHealth: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

/* -------------------------------------------------------------------------- */
/*                           Report Generator                                 */
/* -------------------------------------------------------------------------- */

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_WEIGHTS: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };

/**
 * Generate a structured PRD report from test results.
 * Creates a phased remediation plan prioritized by severity and impact.
 */
export async function generateReport(
  testRunId: string,
  db: DatabaseClient
): Promise<PRDReport> {
  console.log(chalk.cyan(`[${testRunId}] Generating report...`));

  // 1. Fetch test run and findings
  const testRun = await db.getTestRun(testRunId);
  if (!testRun) {
    throw new Error(`Test run not found: ${testRunId}`);
  }

  const findings = await db.getFindings(testRunId);
  console.log(chalk.cyan(`[${testRunId}] ${findings.length} findings to report`));

  // 2. Group by severity
  const findingsBySeverity: Record<string, FindingRecord[]> = {};
  for (const sev of SEVERITY_ORDER) {
    findingsBySeverity[sev] = [];
  }
  for (const f of findings) {
    const sev = f.severity || 'info';
    if (!findingsBySeverity[sev]) findingsBySeverity[sev] = [];
    findingsBySeverity[sev].push(f);
  }

  // 3. Group by dimension
  const findingsByDimension: Record<string, FindingRecord[]> = {};
  for (const f of findings) {
    const dim = f.dimension || 'unknown';
    if (!findingsByDimension[dim]) findingsByDimension[dim] = [];
    findingsByDimension[dim].push(f);
  }

  // 4. Calculate scores
  const metrics = calculateMetrics(findings, testRun);

  // 5. Get top issues (sorted by severity)
  const topIssues = findings
    .filter(f => f.severity === 'critical' || f.severity === 'high')
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 20)
    .map(f => ({
      severity: f.severity,
      title: f.title,
      description: f.description,
      filePath: f.filePath,
      fixSuggestion: f.fixSuggestion,
    }));

  // 6. Build remediation plan
  const remediationPlan = buildRemediationPlan(findings);

  // 7. General recommendations
  const recommendations = generateRecommendations(findings, testRun);

  // 8. Next steps
  const nextSteps = generateNextSteps(metrics);

  // 9. Calculate duration
  let duration: string | undefined;
  if (testRun.startedAt && testRun.completedAt) {
    const start = new Date(testRun.startedAt).getTime();
    const end = new Date(testRun.completedAt).getTime();
    const secs = Math.round((end - start) / 1000);
    duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  const report: PRDReport = {
    testRunId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalFindings: findings.length,
      criticalCount: findingsBySeverity.critical?.length || 0,
      highCount: findingsBySeverity.high?.length || 0,
      mediumCount: findingsBySeverity.medium?.length || 0,
      lowCount: findingsBySeverity.low?.length || 0,
      infoCount: findingsBySeverity.info?.length || 0,
      dimensionsAnalyzed: testRun.dimensions || [],
      projectPath: testRun.projectPath,
      status: testRun.status,
      duration,
    },
    findingsBySeverity,
    findingsByDimension,
    topIssues,
    remediationPlan,
    metrics,
    recommendations,
    nextSteps,
  };

  // Store report in test run
  await db.updateTestRun(testRunId, {
    report: JSON.stringify(report),
    reportGeneratedAt: report.generatedAt,
  });

  console.log(chalk.green(`[${testRunId}] Report generated`));
  return report;
}

/* -------------------------------------------------------------------------- */
/*                           Score Calculation                                */
/* -------------------------------------------------------------------------- */

function calculateMetrics(findings: FindingRecord[], _testRun: TestRunRecord): PRDReport['metrics'] {
  // Security score: 100 minus weighted deductions
  const securityFindings = findings.filter(f => f.dimension === 'security');
  const securityDeductions = securityFindings.reduce(
    (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0) * 3,
    0
  );
  const securityScore = Math.max(0, 100 - Math.min(securityDeductions, 100));

  // Reliability score: based on unit tests, error handling, predictive
  const reliabilityFindings = findings.filter(
    f => f.dimension === 'unit' || f.dimension === 'predictive'
  );
  const reliabilityDeductions = reliabilityFindings.reduce(
    (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0) * 2,
    0
  );
  const reliabilityScore = Math.max(0, 100 - Math.min(reliabilityDeductions, 100));

  // Performance score: based on load analysis
  const loadFindings = findings.filter(f => f.dimension === 'load');
  const loadDeductions = loadFindings.reduce(
    (sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0) * 3,
    0
  );
  const performanceScore = Math.max(0, 100 - Math.min(loadDeductions, 100));

  // Accessibility score: from a11y analysis
  const a11yFinding = findings.find(f => f.dimension === 'accessibility' && f.detail);
  let accessibilityScore = 70; // default
  if (a11yFinding?.detail && typeof a11yFinding.detail.score === 'number') {
    accessibilityScore = a11yFinding.detail.score;
  } else {
    const a11yDeductions = findings
      .filter(f => f.dimension === 'accessibility')
      .reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 0) * 5, 0);
    accessibilityScore = Math.max(0, 100 - Math.min(a11yDeductions, 100));
  }

  // Overall health: weighted average
  const overallHealth = Math.round(
    securityScore * 0.3 +
    reliabilityScore * 0.25 +
    performanceScore * 0.25 +
    accessibilityScore * 0.2
  );

  return {
    securityScore,
    reliabilityScore,
    performanceScore,
    accessibilityScore,
    overallHealth,
  };
}

/* -------------------------------------------------------------------------- */
/*                          Remediation Plan Builder                          */
/* -------------------------------------------------------------------------- */

function buildRemediationPlan(findings: FindingRecord[]): RemediationPhase[] {
  const phases: RemediationPhase[] = [];

  // Phase 1: P0 — Critical fixes (1-3 days)
  const criticalFindings = findings.filter(f => f.severity === 'critical');
  if (criticalFindings.length > 0) {
    phases.push({
      name: 'Phase 1: Critical Fixes (P0) — 1-3 days',
      priority: 'P0',
      timeframe: '1-3 days',
      items: [
        ...criticalFindings.map(f => `[${f.dimension}] ${f.title} — ${f.filePath}${f.lineNumber ? ':' + f.lineNumber : ''}`),
        'Rotate any exposed secrets immediately',
        'Enable audit logging for auth endpoints',
        'Deploy to staging and re-run security scan before production',
      ],
    });
  }

  // Phase 2: P1 — High + Medium fixes (3-7 days)
  const highFindings = findings.filter(f => f.severity === 'high');
  const medFindings = findings.filter(f => f.severity === 'medium');
  if (highFindings.length > 0 || medFindings.length > 0) {
    const items: string[] = [];

    if (highFindings.length > 0) {
      items.push(`=== High Priority (${highFindings.length}) ===`);
      items.push(...highFindings.slice(0, 10).map(f =>
        `[${f.dimension}] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`
      ));
    }

    if (medFindings.length > 0) {
      items.push(`=== Medium Priority (${medFindings.length}) ===`);
      const topMedium = medFindings.slice(0, 8);
      items.push(...topMedium.map(f =>
        `[${f.dimension}] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`
      ));
    }

    items.push('Add rate limiting if not present');
    items.push('Configure CORS with explicit allowed origins');
    items.push('Add security headers (helmet)');

    phases.push({
      name: 'Phase 2: High & Medium Fixes (P1) — 3-7 days',
      priority: 'P1',
      timeframe: '3-7 days',
      items,
    });
  }

  // Phase 3: P2 — Test hardening (1-2 weeks)
  const unitFindings = findings.filter(f => f.dimension === 'unit');
  const mutationFindings = findings.filter(f => f.dimension === 'mutation');
  if (unitFindings.length > 0 || mutationFindings.length > 0) {
    phases.push({
      name: 'Phase 3: Test Hardening (P2) — 1-2 weeks',
      priority: 'P2',
      timeframe: '1-2 weeks',
      items: [
        ...unitFindings.slice(0, 5).map(f => `[unit] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`),
        ...mutationFindings.slice(0, 3).map(f => `[mutation] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`),
        'Write tests for all untested functions',
        'Add error path and boundary condition tests',
        'Set up CI to run tests on every PR',
        'Set coverage threshold at 70% minimum',
        'Add mutation testing to CI pipeline',
      ],
    });
  }

  // Phase 4: P3 — Performance & nice-to-haves (2-4 weeks)
  const loadFindings = findings.filter(f => f.dimension === 'load');
  const a11yFindings = findings.filter(f => f.dimension === 'accessibility');
  const chaosFindings = findings.filter(f => f.dimension === 'chaos');

  phases.push({
    name: 'Phase 4: Performance & Polish (P3) — 2-4 weeks',
    priority: 'P3',
    timeframe: '2-4 weeks',
    items: [
      ...loadFindings.slice(0, 5).map(f => `[load] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`),
      ...a11yFindings.slice(0, 5).map(f => `[a11y] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`),
      ...chaosFindings.slice(0, 3).map(f => `[chaos] ${f.title} — ${f.fixSuggestion.slice(0, 100)}`),
      'Add Redis caching for frequently accessed data',
      'Set up connection pooling for database',
      'Implement circuit breaker for external API calls',
      'Add request/response compression',
      'Run chaos engineering experiments monthly',
      'Fix all accessibility WCAG 2.1 AA violations',
      'Add performance monitoring (APM)',
    ],
  });

  return phases;
}

/* -------------------------------------------------------------------------- */
/*                          Recommendations                                   */
/* -------------------------------------------------------------------------- */

function generateRecommendations(findings: FindingRecord[], testRun: TestRunRecord): string[] {
  const recs: string[] = [];
  const dimensions = new Set(testRun.dimensions || []);

  // Security recommendations
  const hasSecurity = dimensions.has('security');
  if (hasSecurity) {
    const criticalSec = findings.filter(f => f.dimension === 'security' && f.severity === 'critical');
    if (criticalSec.length > 0) {
      recs.push(`URGENT: ${criticalSec.length} critical security issue(s) require immediate attention — rotate secrets and patch before next deploy`);
    }
  }

  // Add general recommendations based on findings
  const categories = new Set(findings.map(f => f.category));
  if (categories.has('SQL Injection')) {
    recs.push('Adopt an ORM (Prisma/Drizzle) to eliminate raw SQL injection risks');
  }
  if (categories.has('Hardcoded Secrets')) {
    recs.push('Integrate a secrets scanner (GitLeaks, TruffleHog) into pre-commit hooks');
  }
  if (categories.has('XSS')) {
    recs.push('Use a template engine with auto-escaping or a framework with built-in XSS protection');
  }
  if (categories.has('CORS Misconfiguration')) {
    recs.push('Implement CORS allowlist via environment variables, never use origin wildcard in production');
  }

  // Always add these
  recs.push('Set up continuous security scanning in CI (npm audit, Snyk, OWASP dependency-check)');
  recs.push('Schedule monthly test suite runs to catch regressions');
  recs.push('Document security decisions in an Architecture Decision Record (ADR)');

  return recs;
}

/* -------------------------------------------------------------------------- */
/*                          Next Steps                                        */
/* -------------------------------------------------------------------------- */

function generateNextSteps(metrics: PRDReport['metrics']): string[] {
  const steps: string[] = [];

  if (metrics.securityScore < 70) {
    steps.push('Address critical and high security findings before next deployment');
  }
  if (metrics.reliabilityScore < 60) {
    steps.push('Increase test coverage — prioritize critical business logic paths');
  }
  if (metrics.performanceScore < 60) {
    steps.push('Implement caching and rate limiting to handle load');
  }
  if (metrics.accessibilityScore < 70) {
    steps.push('Run the accessibility analyzer and fix WCAG violations');
  }

  steps.push('Re-run the test suite after fixes to measure improvement');
  steps.push('Integrate TestForge MCP into your CI/CD pipeline for automated testing');
  steps.push('Set up alerts for new findings via the MCP server');

  return steps;
}
