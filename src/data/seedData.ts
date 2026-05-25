// ── Types ───────────────────────────────────────────────────────────────────

export interface SeedFile {
  path: string;
  lines: number;
  coverage: number;
}

export interface SeedRepo {
  url: string;
  name: string;
  owner: string;
  description: string;
  language: string;
  stars: number;
  branches: string[];
  defaultBranch: string;
  files: SeedFile[];
  endpoints: number;
  middlewareCount: number;
  dependencies: number;
  devDependencies: number;
}

export type TestStatus = 'passed' | 'failed' | 'warning';

export interface LogEntry {
  level: 'info' | 'pass' | 'fail' | 'warn';
  time: string;
  message: string;
}

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
  line?: number;
  cve?: string;
  exploitability?: string;
  fix?: string;
}

export interface TestResult {
  stage: string;
  id: string;
  status: TestStatus;
  duration: number;
  logs: LogEntry[];
  findings: Finding[];
  // dimension-specific fields (all optional)
  endpoints?: number;
  middleware?: number;
  uncovered?: number;
  goalsValidated?: number;
  goalsFailed?: number;
  featuresTested?: number;
  coverage?: string | number;
  testsRun?: number;
  passed?: number;
  failed?: number;
  flaky?: number;
  flowsTested?: number;
  rps?: number;
  maxConcurrent?: number;
  crashPoint?: number;
  riskScore?: number;
  flaggedModules?: string[];
  vulnerabilities?: number;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  screenshots?: number;
  diffs?: number;
  violations?: number;
  wcagAA?: number;
  experiments?: number;
  recovered?: number;
  mutationScore?: number;
  mutants?: number;
  killed?: number;
  survived?: number;
  properties?: number;
  shrinked?: number;
  contracts?: number;
  edgeCases?: number;
  failures?: number;
}

export interface PrdPhaseItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  effort: string;
  component: string;
}

export interface PrdPhase {
  phase: number;
  name: string;
  priority: string;
  duration: string;
  items: PrdPhaseItem[];
}

export interface PrdData {
  title: string;
  version: string;
  generatedAt: string;
  problemStatement: string;
  affectedComponents: string[];
  severity: string;
  phases: PrdPhase[];
}

export interface ReportSummary {
  totalStages: number;
  passed: number;
  failed: number;
  warning: number;
  criticalVulns: number;
  highVulns: number;
  mediumVulns: number;
  lowVulns: number;
  totalFindings: number;
}

export interface SeedReport {
  id: string;
  repo: SeedRepo;
  branch: string;
  commit: string;
  startedAt: string;
  completedAt: string;
  totalDuration: number;
  overallScore: number;
  status: string;
  summary: ReportSummary;
  testResults: TestResult[];
  prd: PrdData;
}

// ── Seed Repo ───────────────────────────────────────────────────────────────

export const SEED_REPO: SeedRepo = {
  url: 'https://github.com/testforge-demo/express-ecommerce-api',
  name: 'express-ecommerce-api',
  owner: 'testforge-demo',
  description: 'Express.js e-commerce REST API with JWT auth, MongoDB, Stripe payments',
  language: 'TypeScript',
  stars: 342,
  branches: ['main', 'develop', 'feature/payments', 'feature/search'],
  defaultBranch: 'main',
  files: [
    { path: 'src/routes/auth.ts', lines: 245, coverage: 78 },
    { path: 'src/routes/products.ts', lines: 189, coverage: 92 },
    { path: 'src/routes/orders.ts', lines: 312, coverage: 45 },
    { path: 'src/routes/users.ts', lines: 156, coverage: 82 },
    { path: 'src/routes/admin.ts', lines: 98, coverage: 12 },
    { path: 'src/routes/search.ts', lines: 67, coverage: 38 },
    { path: 'src/routes/payments.ts', lines: 203, coverage: 71 },
    { path: 'src/middleware/auth.ts', lines: 89, coverage: 65 },
    { path: 'src/middleware/validation.ts', lines: 134, coverage: 54 },
    { path: 'src/models/User.ts', lines: 78, coverage: 88 },
    { path: 'src/models/Order.ts', lines: 112, coverage: 76 },
    { path: 'src/utils/logger.ts', lines: 45, coverage: 100 },
  ],
  endpoints: 47,
  middlewareCount: 12,
  dependencies: 34,
  devDependencies: 28,
};

// ── Seed Test Results ───────────────────────────────────────────────────────

export const SEED_TEST_RESULTS: TestResult[] = [
  {
    stage: 'Scope Test',
    id: 'scope',
    status: 'passed',
    duration: 1200,
    endpoints: 47,
    middleware: 12,
    uncovered: 3,
    logs: [
      { level: 'info', time: '12:00:01', message: 'Scanning repository structure...' },
      { level: 'info', time: '12:00:02', message: `Found ${SEED_REPO.endpoints} API endpoints` },
      { level: 'info', time: '12:00:02', message: `Found ${SEED_REPO.middlewareCount} middleware functions` },
      { level: 'pass', time: '12:00:03', message: 'Scope analysis complete — 94% coverage' },
    ],
    findings: [],
  },
  {
    stage: 'Vision/Goal Test',
    id: 'vision',
    status: 'passed',
    duration: 3400,
    goalsValidated: 8,
    goalsFailed: 0,
    logs: [
      { level: 'info', time: '12:00:03', message: 'Loading business goals from PRD...' },
      { level: 'info', time: '12:00:04', message: 'Goal: Users can register and login → VALIDATED' },
      { level: 'info', time: '12:00:04', message: 'Goal: Users can browse products → VALIDATED' },
      { level: 'info', time: '12:00:05', message: 'Goal: Users can place orders → VALIDATED' },
      { level: 'info', time: '12:00:05', message: 'Goal: Admins can manage products → VALIDATED' },
      { level: 'pass', time: '12:00:06', message: 'All 8 business goals validated' },
    ],
    findings: [],
  },
  {
    stage: 'Feature Matrix Test',
    id: 'feature-matrix',
    status: 'passed',
    duration: 5600,
    featuresTested: 23,
    coverage: '94%',
    logs: [
      { level: 'info', time: '12:00:06', message: 'Building feature-requirements traceability matrix...' },
      { level: 'info', time: '12:00:07', message: '23 features mapped to 47 requirements' },
      { level: 'info', time: '12:00:08', message: '3 uncovered requirements detected' },
      { level: 'pass', time: '12:00:09', message: 'Feature matrix: 94% traceability coverage' },
    ],
    findings: [
      { severity: 'low', message: 'Password reset flow not linked to requirement REQ-12' },
      { severity: 'low', message: 'Wishlist feature has no associated requirements' },
      { severity: 'low', message: 'Order tracking missing requirement mapping' },
    ],
  },
  {
    stage: 'Unit Test',
    id: 'unit',
    status: 'passed',
    duration: 18400,
    testsRun: 156,
    passed: 153,
    failed: 3,
    coverage: 78,
    logs: [
      { level: 'info', time: '12:00:10', message: 'Generating unit tests from source...' },
      { level: 'info', time: '12:00:12', message: '156 test cases generated' },
      { level: 'pass', time: '12:00:25', message: '153 tests passed' },
      { level: 'fail', time: '12:00:25', message: '3 tests failed — see findings' },
    ],
    findings: [
      { severity: 'medium', file: 'src/routes/orders.ts', line: 89, message: 'Order total calculation fails with decimal quantities' },
      { severity: 'medium', file: 'src/routes/payments.ts', line: 134, message: 'Stripe webhook signature verification missing' },
      { severity: 'low', file: 'src/middleware/validation.ts', line: 45, message: 'Email regex allows invalid TLDs' },
    ],
  },
  {
    stage: 'Integration Test',
    id: 'integration',
    status: 'warning',
    duration: 22100,
    testsRun: 48,
    passed: 46,
    flaky: 2,
    logs: [
      { level: 'info', time: '12:00:26', message: 'Testing service interactions...' },
      { level: 'pass', time: '12:00:42', message: '46/48 integration tests passed' },
      { level: 'warn', time: '12:00:42', message: '2 flaky tests detected in auth flow' },
    ],
    findings: [
      { severity: 'medium', message: 'Auth middleware race condition — intermittent 401s (flaky)' },
      { severity: 'medium', message: 'Payment webhook timeout after 5s — retry logic untested (flaky)' },
    ],
  },
  {
    stage: 'E2E Test',
    id: 'e2e',
    status: 'passed',
    duration: 45200,
    flowsTested: 28,
    passed: 28,
    logs: [
      { level: 'info', time: '12:00:43', message: 'Simulating 28 user workflows...' },
      { level: 'info', time: '12:01:08', message: 'User registration flow → PASS' },
      { level: 'info', time: '12:01:15', message: 'Complete purchase flow → PASS' },
      { level: 'info', time: '12:01:22', message: 'Admin product management → PASS' },
      { level: 'pass', time: '12:01:28', message: 'All 28 user flows validated' },
    ],
    findings: [],
  },
  {
    stage: 'Load & Scale Test',
    id: 'load',
    status: 'failed',
    duration: 67800,
    rps: 450,
    maxConcurrent: 1200,
    crashPoint: 1200,
    logs: [
      { level: 'info', time: '12:01:29', message: 'Starting load test at 100 concurrent users...' },
      { level: 'info', time: '12:01:35', message: '500 concurrent: p95=120ms, OK' },
      { level: 'info', time: '12:01:42', message: '1000 concurrent: p95=890ms, degraded' },
      { level: 'fail', time: '12:01:48', message: '1200 concurrent: Server crashed — MongoDB connection pool exhausted' },
      { level: 'fail', time: '12:01:48', message: 'CRITICAL: API unavailable under peak load' },
    ],
    findings: [
      { severity: 'critical', message: 'MongoDB connection pool maxes at 1000 concurrent users' },
      { severity: 'high', message: 'No circuit breaker pattern — cascade failure on DB timeout' },
      { severity: 'high', message: 'p95 latency exceeds 500ms at >800 concurrent users' },
    ],
  },
  {
    stage: 'Predictive Model',
    id: 'predictive',
    status: 'warning',
    duration: 12300,
    riskScore: 72,
    flaggedModules: ['auth', 'orders', 'payments'],
    logs: [
      { level: 'info', time: '12:01:49', message: 'Running ML risk analysis on codebase...' },
      { level: 'info', time: '12:01:51', message: 'Auth module: HIGH risk (complexity score 8.4/10)' },
      { level: 'info', time: '12:01:52', message: 'Orders module: MEDIUM risk (recent changes, low coverage)' },
      { level: 'warn', time: '12:01:52', message: 'Payments module: HIGH risk (external dependency failures)' },
    ],
    findings: [
      { severity: 'high', message: 'Auth module: 73% probability of production bug within 30 days' },
      { severity: 'medium', message: 'Orders module: Code churn 3x above average — instability risk' },
      { severity: 'medium', message: 'Payments: Stripe API version deprecated in 90 days' },
    ],
  },
  {
    stage: 'Security Scan',
    id: 'security',
    status: 'failed',
    duration: 28500,
    vulnerabilities: 6,
    critical: 1,
    high: 2,
    medium: 2,
    low: 1,
    logs: [
      { level: 'info', time: '12:01:53', message: 'Starting security vulnerability scan...' },
      { level: 'info', time: '12:01:55', message: 'SAST: Scanning source code for injection vulnerabilities...' },
      { level: 'info', time: '12:02:01', message: 'DAST: Testing running application endpoints...' },
      { level: 'info', time: '12:02:08', message: 'Fuzzing: Testing 47 endpoints with edge case inputs...' },
      { level: 'fail', time: '12:02:18', message: '6 vulnerabilities found — 1 CRITICAL, 2 HIGH' },
    ],
    findings: [
      { severity: 'critical', cve: 'CVE-2024-XXXX', file: 'src/routes/orders.ts', line: 89, message: 'NoSQL Injection: `orderId` parameter directly used in MongoDB query without sanitization. Attacker can extract all orders.', exploitability: 'High', fix: 'Use parameterized queries with mongoose.Types.ObjectId validation' },
      { severity: 'high', cve: 'CVE-2024-YYYY', file: 'src/routes/admin.ts', line: 12, message: 'Authentication Bypass: /admin/* routes missing JWT middleware. Any unauthenticated user can access admin endpoints.', exploitability: 'Critical', fix: 'Add requireAuth middleware to all admin route handlers' },
      { severity: 'high', cve: 'CVE-2024-ZZZZ', file: 'src/routes/search.ts', line: 34, message: 'Reflected XSS: Search query reflected in JSON response without HTML escaping. Allows script injection.', exploitability: 'Medium', fix: 'Sanitize search output with DOMPurify or escape HTML entities' },
      { severity: 'medium', file: 'src/routes/auth.ts', line: 67, message: 'Missing Rate Limiting: Login endpoint accepts unlimited requests. Vulnerable to brute force attacks.', exploitability: 'Medium', fix: 'Add express-rate-limit middleware: max 5 attempts per 15 minutes per IP' },
      { severity: 'medium', file: 'src/routes/users.ts', line: 45, message: 'Sensitive Data Exposure: GET /api/users returns password hashes in response body.', exploitability: 'Low', fix: 'Add `.select("-password")` to user query in response' },
      { severity: 'low', file: 'src/app.ts', line: 23, message: 'CORS Misconfiguration: `origin: "*"` allows any domain to make authenticated requests.', exploitability: 'Low', fix: 'Whitelist specific origins: ["https://shop.example.com"]' },
    ],
  },
  {
    stage: 'Visual Regression',
    id: 'visual',
    status: 'passed',
    duration: 8900,
    screenshots: 24,
    diffs: 0,
    logs: [
      { level: 'info', time: '12:02:19', message: 'Capturing 24 UI screenshots across breakpoints...' },
      { level: 'info', time: '12:02:24', message: 'Comparing against baseline (commit a1b2c3d)...' },
      { level: 'pass', time: '12:02:28', message: '0 visual diffs detected — UI is stable' },
    ],
    findings: [],
  },
  {
    stage: 'Accessibility Test',
    id: 'accessibility',
    status: 'warning',
    duration: 11200,
    violations: 12,
    wcagAA: 87,
    logs: [
      { level: 'info', time: '12:02:29', message: 'Running WCAG 2.1 AA compliance audit...' },
      { level: 'info', time: '12:02:33', message: ' axe-core: 12 accessibility violations found' },
      { level: 'warn', time: '12:02:33', message: 'WCAG AA compliance: 87% — below recommended 95%' },
    ],
    findings: [
      { severity: 'medium', message: '8 images missing alt text on product thumbnails' },
      { severity: 'medium', message: '2 form inputs missing associated labels' },
      { severity: 'low', message: '1 button has insufficient color contrast (3.2:1, needs 4.5:1)' },
      { severity: 'low', message: '1 page missing skip navigation link' },
    ],
  },
  {
    stage: 'Chaos Engineering',
    id: 'chaos',
    status: 'passed',
    duration: 45600,
    experiments: 8,
    recovered: 8,
    logs: [
      { level: 'info', time: '12:02:34', message: 'Injecting 8 failure scenarios...' },
      { level: 'info', time: '12:02:40', message: 'DB connection drop → System recovered in 2.3s ✓' },
      { level: 'info', time: '12:02:47', message: 'Stripe API timeout → Fallback to queue ✓' },
      { level: 'info', time: '12:02:55', message: 'Memory pressure (512MB) → Graceful degradation ✓' },
      { level: 'info', time: '12:03:05', message: 'Network partition (50% loss) → Retry with backoff ✓' },
      { level: 'pass', time: '12:03:15', message: 'All 8 chaos experiments recovered successfully' },
    ],
    findings: [
      { severity: 'low', message: 'Recovery time for DB drop (2.3s) exceeds SLO of 1s' },
      { severity: 'low', message: 'Consider adding Redis cache layer for Stripe fallback' },
    ],
  },
  {
    stage: 'Mutation Test',
    id: 'mutation',
    status: 'failed',
    duration: 52300,
    mutationScore: 23,
    mutants: 342,
    killed: 79,
    survived: 263,
    logs: [
      { level: 'info', time: '12:03:16', message: 'Generating 342 mutants across codebase...' },
      { level: 'info', time: '12:03:20', message: 'Running test suite against mutated code...' },
      { level: 'info', time: '12:03:45', message: '79 mutants killed (23%)' },
      { level: 'fail', time: '12:03:45', message: '263 mutants survived — test suite needs hardening' },
    ],
    findings: [
      { severity: 'high', file: 'src/routes/orders.ts', message: 'Order validation: 45/52 boundary condition mutants survived' },
      { severity: 'high', file: 'src/routes/auth.ts', message: 'Token expiry: 18/22 mutants survived — no tests for expired JWT' },
      { severity: 'medium', file: 'src/routes/payments.ts', message: 'Payment amount: 12/15 arithmetic mutants survived' },
    ],
  },
  {
    stage: 'Property-Based Test',
    id: 'property',
    status: 'passed',
    duration: 9800,
    properties: 18,
    shrinked: 3,
    logs: [
      { level: 'info', time: '12:03:46', message: 'Generating property-based tests...' },
      { level: 'info', time: '12:03:48', message: 'Testing 18 properties with 1000 random inputs each...' },
      { level: 'info', time: '12:03:54', message: '3 counter-examples found and minimized' },
      { level: 'pass', time: '12:03:56', message: 'All properties hold after counter-example fixes' },
    ],
    findings: [
      { severity: 'low', message: 'sortProducts() fails when price is negative (edge case from property test)' },
      { severity: 'low', message: 'parseDate() rejects ISO 8601 dates with timezone offsets' },
      { severity: 'low', message: 'validateEmail() accepts empty string as valid' },
    ],
  },
  {
    stage: 'Contract Test',
    id: 'contract',
    status: 'passed',
    duration: 15600,
    contracts: 12,
    violations: 0,
    logs: [
      { level: 'info', time: '12:03:57', message: 'Verifying API contracts against OpenAPI spec...' },
      { level: 'info', time: '12:04:00', message: '12 consumer-provider contracts validated' },
      { level: 'pass', time: '12:04:13', message: 'All API contracts honored — zero breaking changes' },
    ],
    findings: [],
  },
  {
    stage: 'Edge Case Generation',
    id: 'edge-cases',
    status: 'warning',
    duration: 31200,
    edgeCases: 67,
    failures: 4,
    logs: [
      { level: 'info', time: '12:04:14', message: 'Generating edge cases from code analysis...' },
      { level: 'info', time: '12:04:18', message: '67 edge cases generated (null, empty, overflow, unicode, special chars)' },
      { level: 'warn', time: '12:04:35', message: '4 edge cases caused unexpected failures' },
    ],
    findings: [
      { severity: 'medium', message: 'Product name with 1000 chars causes DB write failure' },
      { severity: 'medium', message: 'Order with 0 items completes but sets total to NaN' },
      { severity: 'low', message: 'Unicode emoji in search crashes response serializer' },
      { severity: 'low', message: 'Price field accepts negative values without validation' },
    ],
  },
];

// ── Overall Report Summary ──────────────────────────────────────────────────

export const SEED_REPORT: SeedReport = {
  id: 'TF-2026-001',
  repo: SEED_REPO,
  branch: 'main',
  commit: 'a1b2c3d',
  startedAt: '2026-01-15T12:00:00Z',
  completedAt: '2026-01-15T12:04:35Z',
  totalDuration: 275000,
  overallScore: 68,
  status: 'completed',
  summary: {
    totalStages: 20,
    passed: 8,
    failed: 3,
    warning: 2,
    criticalVulns: 1,
    highVulns: 2,
    mediumVulns: 5,
    lowVulns: 8,
    totalFindings: 45,
  },
  testResults: SEED_TEST_RESULTS,
  prd: {
    title: 'Security Hardening & Performance Scaling — express-ecommerce-api',
    version: '1.0',
    generatedAt: '2026-01-15T12:04:36Z',
    problemStatement: 'The express-ecommerce-api codebase has critical security vulnerabilities and performance bottlenecks that must be addressed before production deployment. Key issues include a NoSQL injection vulnerability, authentication bypass, and API instability under load.',
    affectedComponents: ['orders', 'admin', 'search', 'auth', 'users', 'payments', 'database-config', 'app-config'],
    severity: 'critical',
    phases: [
      {
        phase: 1,
        name: 'Critical Security Fixes',
        priority: 'P0',
        duration: '3 days',
        items: [
          { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical', effort: '4h', component: 'orders' },
          { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical', effort: '2h', component: 'admin' },
          { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high', effort: '3h', component: 'search' },
        ],
      },
      {
        phase: 2,
        name: 'Authentication & Data Protection',
        priority: 'P1',
        duration: '5 days',
        items: [
          { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium', effort: '4h', component: 'auth' },
          { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium', effort: '1h', component: 'users' },
          { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low', effort: '2h', component: 'app-config' },
        ],
      },
      {
        phase: 3,
        name: 'Performance & Scale',
        priority: 'P1',
        duration: '7 days',
        items: [
          { id: 'PERF-001', title: 'Implement MongoDB connection pooling', severity: 'high', effort: '8h', component: 'database-config' },
          { id: 'PERF-002', title: 'Add circuit breaker for external APIs', severity: 'high', effort: '6h', component: 'payments' },
          { id: 'PERF-003', title: 'Implement Redis caching layer', severity: 'medium', effort: '12h', component: 'database-config' },
        ],
      },
      {
        phase: 4,
        name: 'Test Suite Hardening',
        priority: 'P2',
        duration: '10 days',
        items: [
          { id: 'TEST-001', title: 'Add boundary condition tests for order validation', severity: 'high', effort: '8h', component: 'orders' },
          { id: 'TEST-002', title: 'Add JWT expiry and refresh token tests', severity: 'high', effort: '6h', component: 'auth' },
          { id: 'TEST-003', title: 'Stabilize flaky auth middleware tests', severity: 'medium', effort: '4h', component: 'auth' },
        ],
      },
    ],
  },
};

// ── Mock User Data ──────────────────────────────────────────────────────────

export type UserPlan = 'free' | 'starter' | 'standard' | 'pro' | 'enterprise';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  plan: UserPlan;
  creditsUsed: number;
  creditsTotal: number;
  testsRun: number;
  passRate: number;
  repos: number;
  teamSize: number;
  joinedAt: string;
}

export const MOCK_USER: MockUser = {
  id: 'usr_123',
  name: 'Alex Chen',
  email: 'alex@example.com',
  avatar: 'AC',
  plan: 'standard',
  creditsUsed: 1247,
  creditsTotal: 2000,
  testsRun: 47,
  passRate: 82,
  repos: 5,
  teamSize: 3,
  joinedAt: '2025-11-01',
};

export interface TestHistoryEntry {
  id: string;
  repo: string;
  branch: string;
  date: string;
  status: string;
  score: number;
  findings: number;
}

export const MOCK_TEST_HISTORY: TestHistoryEntry[] = [
  { id: 'TF-2026-047', repo: 'express-ecommerce-api', branch: 'main', date: '2026-01-15', status: 'completed', score: 68, findings: 16 },
  { id: 'TF-2026-046', repo: 'express-ecommerce-api', branch: 'develop', date: '2026-01-14', status: 'completed', score: 64, findings: 19 },
  { id: 'TF-2026-045', repo: 'react-dashboard', branch: 'main', date: '2026-01-13', status: 'completed', score: 91, findings: 3 },
  { id: 'TF-2026-044', repo: 'payment-service', branch: 'feature/stripe-v2', date: '2026-01-12', status: 'completed', score: 73, findings: 11 },
  { id: 'TF-2026-043', repo: 'auth-microservice', branch: 'main', date: '2026-01-11', status: 'completed', score: 85, findings: 7 },
  { id: 'TF-2026-042', repo: 'express-ecommerce-api', branch: 'main', date: '2026-01-10', status: 'completed', score: 61, findings: 21 },
  { id: 'TF-2026-041', repo: 'notification-service', branch: 'develop', date: '2026-01-09', status: 'failed', score: 34, findings: 28 },
  { id: 'TF-2026-040', repo: 'search-service', branch: 'main', date: '2026-01-08', status: 'completed', score: 79, findings: 9 },
];

export interface ApiKeyEntry {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
}

export const MOCK_API_KEYS: ApiKeyEntry[] = [
  { id: 'key_1', name: 'Production CI/CD', key: 'tf_live_51HYs...xK9m', createdAt: '2026-01-01', lastUsed: '2026-01-15', status: 'active' },
  { id: 'key_2', name: 'Local Development', key: 'tf_test_42Kj...9LqP', createdAt: '2025-12-15', lastUsed: '2026-01-14', status: 'active' },
  { id: 'key_3', name: 'Team Shared', key: 'tf_live_73Np...4WxZ', createdAt: '2025-11-20', lastUsed: '2025-12-28', status: 'revoked' },
];

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Developer' | 'Viewer';
  avatar: string;
  status: 'active' | 'pending';
}

export const MOCK_TEAM_MEMBERS: TeamMember[] = [
  { id: 'usr_123', name: 'Alex Chen', email: 'alex@example.com', role: 'Owner', avatar: 'AC', status: 'active' },
  { id: 'usr_456', name: 'Sarah Kim', email: 'sarah@example.com', role: 'Admin', avatar: 'SK', status: 'active' },
  { id: 'usr_789', name: 'Jordan Lee', email: 'jordan@example.com', role: 'Developer', avatar: 'JL', status: 'active' },
  { id: 'usr_abc', name: 'Pending Invite', email: 'morgan@example.com', role: 'Viewer', avatar: '--', status: 'pending' },
];

// ── Usage Chart Data (30 days) ──────────────────────────────────────────────

export interface UsageDataPoint {
  date: string;
  runs: number;
  credits: number;
}

export const MOCK_USAGE_DATA: UsageDataPoint[] = [
  { date: 'Dec 17', runs: 12, credits: 45 },
  { date: 'Dec 18', runs: 18, credits: 62 },
  { date: 'Dec 19', runs: 15, credits: 51 },
  { date: 'Dec 20', runs: 22, credits: 78 },
  { date: 'Dec 21', runs: 8, credits: 30 },
  { date: 'Dec 22', runs: 10, credits: 38 },
  { date: 'Dec 23', runs: 25, credits: 92 },
  { date: 'Dec 24', runs: 14, credits: 55 },
  { date: 'Dec 25', runs: 6, credits: 22 },
  { date: 'Dec 26', runs: 19, credits: 71 },
  { date: 'Dec 27', runs: 28, credits: 105 },
  { date: 'Dec 28', runs: 16, credits: 60 },
  { date: 'Dec 29', runs: 21, credits: 80 },
  { date: 'Dec 30', runs: 30, credits: 115 },
  { date: 'Dec 31', runs: 11, credits: 42 },
  { date: 'Jan 1', runs: 9, credits: 35 },
  { date: 'Jan 2', runs: 24, credits: 88 },
  { date: 'Jan 3', runs: 32, credits: 120 },
  { date: 'Jan 4', runs: 17, credits: 65 },
  { date: 'Jan 5', runs: 26, credits: 98 },
  { date: 'Jan 6', runs: 20, credits: 75 },
  { date: 'Jan 7', runs: 35, credits: 130 },
  { date: 'Jan 8', runs: 14, credits: 52 },
  { date: 'Jan 9', runs: 29, credits: 108 },
  { date: 'Jan 10', runs: 38, credits: 142 },
  { date: 'Jan 11', runs: 22, credits: 82 },
  { date: 'Jan 12', runs: 31, credits: 118 },
  { date: 'Jan 13', runs: 27, credits: 102 },
  { date: 'Jan 14', runs: 40, credits: 155 },
  { date: 'Jan 15', runs: 33, credits: 125 },
];

// ── Invoice Data ────────────────────────────────────────────────────────────

export interface Invoice {
  date: string;
  amount: string;
  status: string;
}

export const MOCK_INVOICES: Invoice[] = [
  { date: 'Jan 15, 2026', amount: '$149.00', status: 'Paid' },
  { date: 'Dec 15, 2025', amount: '$149.00', status: 'Paid' },
  { date: 'Nov 15, 2025', amount: '$149.00', status: 'Paid' },
];

// ── Repo Cards Data ─────────────────────────────────────────────────────────

export interface RepoCard {
  id: string;
  name: string;
  owner: string;
  status: 'active' | 'inactive';
  branches: number;
  runs: number;
  lastRun: string;
  branchList: string;
}

export const MOCK_REPOS: RepoCard[] = [
  { id: 'r1', name: 'express-ecommerce-api', owner: 'testforge-demo', status: 'active', branches: 4, runs: 47, lastRun: 'Jan 15', branchList: 'main (default), develop, feature/payments, feature/search' },
  { id: 'r2', name: 'payment-service', owner: 'acme-corp', status: 'active', branches: 3, runs: 23, lastRun: 'Jan 14', branchList: 'main (default), develop, feature/stripe-v2' },
  { id: 'r3', name: 'auth-gateway', owner: 'acme-corp', status: 'active', branches: 2, runs: 31, lastRun: 'Jan 11', branchList: 'main (default), develop' },
  { id: 'r4', name: 'frontend-dashboard', owner: 'acme-corp', status: 'inactive', branches: 5, runs: 12, lastRun: 'Jan 10', branchList: 'main (default), develop, feature/v2, staging, hotfix/auth' },
  { id: 'r5', name: 'notification-service', owner: 'acme-corp', status: 'active', branches: 2, runs: 8, lastRun: 'Jan 9', branchList: 'main (default), develop' },
  { id: 'r6', name: 'node-api-starter', owner: 'personal', status: 'inactive', branches: 1, runs: 5, lastRun: 'Dec 28', branchList: 'main (default)' },
];
