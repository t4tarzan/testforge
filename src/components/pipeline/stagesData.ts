export type StageStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface Stage {
  id: number;
  number: string;
  name: string;
  subtitle: string;
  description: string;
  status: StageStatus;
  metrics: {
    testsRun: number;
    failures: number;
    coverage: number;
    duration: string;
  };
  logs: string[];
  findings: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    detail: string;
  }[];
}

export const stages: Stage[] = [
  {
    id: 1,
    number: '01',
    name: 'Code Ingestion',
    subtitle: 'Analyzing repository structure',
    description: 'Deep analysis of your codebase structure, dependencies, and architecture. Maps all modules, identifies entry points, and builds a complete dependency graph for intelligent test planning.',
    status: 'passed',
    metrics: { testsRun: 1, failures: 0, coverage: 100, duration: '3s' },
    logs: [
      '[INFO] Cloning repository...',
      '[INFO] Repository cloned successfully (142MB)',
      '[INFO] Detected language: TypeScript',
      '[INFO] Found 387 source files',
      '[INFO] Parsing import graph...',
      '[PASS] Dependency graph built — 1,247 edges',
      '[INFO] Identifying test boundaries...',
      '[PASS] Stage complete — 12 testable modules found',
    ],
    findings: [
      { severity: 'low', description: '3 unused dependencies detected', detail: 'packages lodash-es, moment, and old-utils are imported but never used in the current codebase.' },
    ],
  },
  {
    id: 2,
    number: '02',
    name: 'Scope Testing',
    subtitle: 'Requirements coverage analysis',
    description: 'Validates that every requirement, user story, and acceptance criterion has corresponding test coverage. Identifies gaps where code changes lack sufficient test scenarios.',
    status: 'passed',
    metrics: { testsRun: 24, failures: 1, coverage: 96, duration: '8s' },
    logs: [
      '[INFO] Loading requirements from Jira...',
      '[INFO] 47 requirements loaded',
      '[INFO] Mapping requirements to test cases...',
      '[PASS] 44 requirements fully covered',
      '[WARN] Requirement TF-12 has partial coverage',
      '[INFO] Generating missing test scenarios...',
      '[PASS] 3 additional test scenarios created',
      '[FAIL] 1 requirement lacks traceability',
      '[INFO] Report generated',
    ],
    findings: [
      { severity: 'medium', description: 'Requirement TF-12 missing edge case tests', detail: 'The password reset flow lacks tests for concurrent reset requests.' },
    ],
  },
  {
    id: 3,
    number: '03',
    name: 'Vision & Goal Testing',
    subtitle: 'Business goal alignment',
    description: 'Ensures every code change aligns with stated business goals and product vision. Uses NLP to compare PR descriptions, commit messages, and code against strategic objectives.',
    status: 'passed',
    metrics: { testsRun: 18, failures: 0, coverage: 100, duration: '6s' },
    logs: [
      '[INFO] Loading product vision document...',
      '[INFO] 8 strategic goals identified',
      '[INFO] Analyzing recent commits...',
      '[PASS] All commits align with Q3 objectives',
      '[INFO] Checking feature flag alignment...',
      '[PASS] Feature flags match rollout plan',
      '[INFO] Cross-referencing OKRs...',
      '[PASS] Code changes support OKR-3 (latency reduction)',
    ],
    findings: [
      { severity: 'low', description: '1 commit message could be more descriptive', detail: 'Commit a1b2c3d has a vague message that does not reference the related ticket.' },
    ],
  },
  {
    id: 4,
    number: '04',
    name: 'Feature Matrix Testing',
    subtitle: 'Traceability & impact analysis',
    description: 'Builds a comprehensive feature-to-test matrix, tracing every feature through its test cases, dependencies, and impact surface. Identifies high-risk change areas.',
    status: 'passed',
    metrics: { testsRun: 56, failures: 2, coverage: 94, duration: '14s' },
    logs: [
      '[INFO] Building feature matrix...',
      '[INFO] 23 features mapped',
      '[INFO] Running impact analysis...',
      '[PASS] Low impact: 14 features',
      '[PASS] Medium impact: 7 features',
      '[WARN] High impact: 2 features',
      '[INFO] Running targeted regression tests...',
      '[FAIL] Feature: payment-gateway — 2 tests failed',
      '[INFO] Generating impact report...',
    ],
    findings: [
      { severity: 'high', description: 'Payment gateway changes affect 8 downstream features', detail: 'The Stripe API version bump impacts refund processing, webhook handling, and receipt generation.' },
      { severity: 'medium', description: '2 feature tests require updating', detail: 'Test cases for cart-abandonment and promo-codes need new mock data.' },
    ],
  },
  {
    id: 5,
    number: '05',
    name: 'Load & Scale Testing',
    subtitle: 'Performance under stress',
    description: 'Simulates real-world traffic patterns to validate performance under load. Tests response times, throughput, and resource utilization across different scaling scenarios.',
    status: 'passed',
    metrics: { testsRun: 12, failures: 0, coverage: 100, duration: '45s' },
    logs: [
      '[INFO] Configuring load test profile...',
      '[INFO] Target: 10,000 concurrent users',
      '[INFO] Ramp-up: 5 minutes',
      '[PASS] p50 latency: 42ms (target: <50ms)',
      '[PASS] p95 latency: 128ms (target: <150ms)',
      '[PASS] p99 latency: 198ms (target: <250ms)',
      '[PASS] Throughput: 4,200 RPS',
      '[INFO] Memory usage stable at 68%',
      '[PASS] All load tests passed',
    ],
    findings: [
      { severity: 'low', description: 'Memory usage spiked to 82% during peak', detail: 'Consider increasing heap size or implementing request pooling for sustained loads.' },
    ],
  },
  {
    id: 6,
    number: '06',
    name: 'Predictive Testing',
    subtitle: 'ML defect prediction',
    description: 'Leverages machine learning models trained on historical code changes, commit patterns, and defect data to predict which areas of code are most likely to contain bugs.',
    status: 'passed',
    metrics: { testsRun: 31, failures: 3, coverage: 91, duration: '22s' },
    logs: [
      '[INFO] Loading ML model (v2.4.1)...',
      '[INFO] Model accuracy: 94.2%',
      '[INFO] Analyzing code churn patterns...',
      '[WARN] High-risk module detected: auth/service.ts',
      '[WARN] Medium-risk: payment/processor.ts',
      '[INFO] Running targeted tests on high-risk areas...',
      '[FAIL] auth/service.ts — 3 predicted failures confirmed',
      '[PASS] All other modules passed',
    ],
    findings: [
      { severity: 'critical', description: 'Auth service has 87% defect probability', detail: 'Recent changes to token validation introduced a race condition in concurrent requests.' },
      { severity: 'high', description: 'Payment processor edge case failure', detail: 'Refund amount overflow when processing transactions over $999,999.99.' },
    ],
  },
  {
    id: 7,
    number: '07',
    name: 'Security Testing',
    subtitle: 'SAST, DAST, AI fuzzing',
    description: 'Multi-layered security analysis combining static application security testing, dynamic scanning, and AI-powered fuzzing to identify vulnerabilities before they reach production.',
    status: 'running',
    metrics: { testsRun: 89, failures: 2, coverage: 98, duration: '38s' },
    logs: [
      '[INFO] Starting SAST scan...',
      '[PASS] SAST complete — 0 critical issues',
      '[INFO] Running DAST against staging...',
      '[PASS] No injection vulnerabilities found',
      '[INFO] Starting AI fuzzing...',
      '[WARN] Unusual input pattern detected in /api/search',
      '[INFO] Testing for regex denial of service...',
      '[FAIL] Regex vulnerable to ReDoS in validator.ts',
      '[INFO] Generating security report...',
      '[PASS] OWASP Top 10 scan complete',
    ],
    findings: [
      { severity: 'critical', description: 'ReDoS vulnerability in input validator', detail: 'The regex pattern in validator.ts can cause catastrophic backtracking on crafted input.' },
      { severity: 'medium', description: 'Missing rate limiting on /api/search', detail: 'The search endpoint does not have rate limiting, making it susceptible to brute-force data extraction.' },
    ],
  },
  {
    id: 8,
    number: '08',
    name: 'Visual Regression',
    subtitle: 'UI pixel-perfect validation',
    description: 'Captures and compares screenshots across different browsers and viewports. Detects even single-pixel changes in UI layout, ensuring consistent visual presentation.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Queueing visual regression tests...',
      '[INFO] 24 viewports configured',
      '[INFO] 3 browsers: Chrome, Firefox, Safari',
      '[INFO] Baseline: commit a3f7d2e',
      '[INFO] Estimated duration: 2m 30s',
      '...',
    ],
    findings: [],
  },
  {
    id: 9,
    number: '09',
    name: 'Accessibility Testing',
    subtitle: 'WCAG compliance check',
    description: 'Automated accessibility auditing against WCAG 2.1 AA standards. Tests keyboard navigation, screen reader compatibility, color contrast, and ARIA implementation.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Starting WCAG 2.1 AA audit...',
      '[INFO] Testing 47 components...',
      '[INFO] Checking color contrast ratios...',
      '[INFO] Testing keyboard navigation paths...',
      '[INFO] Validating ARIA attributes...',
      '...',
    ],
    findings: [],
  },
  {
    id: 10,
    number: '10',
    name: 'Chaos Engineering',
    subtitle: 'Fault injection & recovery',
    description: 'Proactively injects failures into the system to validate resilience. Tests circuit breakers, fallback mechanisms, retry policies, and graceful degradation under stress.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Planning chaos experiments...',
      '[INFO] 8 failure scenarios prepared',
      '[INFO] Target: kubernetes cluster (3 nodes)',
      '[INFO] Safety checks enabled',
      '[INFO] Rollback window: 30s',
      '...',
    ],
    findings: [],
  },
  {
    id: 11,
    number: '11',
    name: 'Mutation Testing',
    subtitle: 'Test quality assessment',
    description: 'Introduces small code mutations to measure test suite quality. A high mutation score indicates tests that truly verify behavior, not just coverage metrics.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Starting mutation analysis...',
      '[INFO] Target mutation operators: 24',
      '[INFO] Estimated mutants: ~1,200',
      '[INFO] This may take a few minutes...',
      '...',
    ],
    findings: [],
  },
  {
    id: 12,
    number: '12',
    name: 'Property-Based Testing',
    subtitle: 'Invariant validation',
    description: 'Generates hundreds of random test inputs to verify that fundamental properties and invariants always hold. Finds edge cases human testers would never think to write.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Configuring property-based tests...',
      '[INFO] 15 invariants to validate',
      '[INFO] Generating 500 random inputs per invariant...',
      '[INFO] Shrinking enabled for minimal reproductions',
      '...',
    ],
    findings: [],
  },
  {
    id: 13,
    number: '13',
    name: 'Edge Case Generation',
    subtitle: 'Boundary & fuzz testing',
    description: 'AI-powered generation of extreme edge cases — null inputs, maximum lengths, unicode edge cases, boundary values, and unexpected type combinations.',
    status: 'pending',
    metrics: { testsRun: 0, failures: 0, coverage: 0, duration: '--' },
    logs: [
      '[INFO] Starting edge case generation...',
      '[INFO] AI model: edge-gen-v3',
      '[INFO] Target functions: 89',
      '[INFO] Generating boundary values...',
      '[INFO] Generating fuzz inputs...',
      '...',
    ],
    findings: [],
  },
];

export const statusColors: Record<StageStatus, { bg: string; text: string; border: string; bar: string }> = {
  pending: {
    bg: 'bg-[rgba(154,154,154,0.1)]',
    text: 'text-[#9A9A9A]',
    border: 'border-[#9A9A9A]',
    bar: 'bg-[#9A9A9A]',
  },
  running: {
    bg: 'bg-[rgba(232,168,56,0.1)]',
    text: 'text-[#E8A838]',
    border: 'border-[#E8A838]',
    bar: 'bg-[#E8A838]',
  },
  passed: {
    bg: 'bg-[rgba(90,143,94,0.1)]',
    text: 'text-[#C1A3FF]',
    border: 'border-[#C1A3FF]',
    bar: 'bg-[#C1A3FF]',
  },
  failed: {
    bg: 'bg-[rgba(212,82,74,0.1)]',
    text: 'text-[#D4524A]',
    border: 'border-[#D4524A]',
    bar: 'bg-[#D4524A]',
  },
};

export const severityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'bg-[rgba(212,82,74,0.1)]', text: 'text-[#D4524A]' },
  high: { bg: 'bg-[rgba(232,125,58,0.1)]', text: 'text-[#E87D3A]' },
  medium: { bg: 'bg-[rgba(232,168,56,0.1)]', text: 'text-[#E8A838]' },
  low: { bg: 'bg-[rgba(90,143,94,0.1)]', text: 'text-[#C1A3FF]' },
};
