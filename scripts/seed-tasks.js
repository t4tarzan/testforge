// Seed enterprise tasks — comprehensive product roadmap
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = postgres(DATABASE_URL, { max: 1 });

const tasks = [
  // ═══ STAGE 1: FOUNDATIONS (what we have + quick wins) ═══
  { title: 'Publish @testforge/mcp to npm', desc: 'cd mcp-server && npm publish --access public. Makes npx @testforge/mcp install work for real.', category: 'npm_package', priority: 'critical', stage: 1 },
  { title: 'GitHub OAuth Login', desc: 'Replace mock auth with real GitHub OAuth. Use Vercel + GitHub OAuth app. Store user in Neon DB.', category: 'auth', priority: 'critical', stage: 1 },
  { title: 'User table + real auth flow', desc: 'Create users table in DB. Store GitHub user data. JWT session management.', category: 'auth', priority: 'critical', stage: 1 },
  { title: 'Wire Dashboard charts to analysisStore', desc: 'Dashboard already reads analysisStore. Update Recharts data dynamically when real data exists.', category: 'dashboard', priority: 'high', stage: 1 },
  { title: 'Save test results to Neon DB', desc: 'After Fly.io analysis completes, save results to test_runs + findings + reports tables via Vercel API.', category: 'reports', priority: 'high', stage: 1 },
  { title: 'Dashboard: test history list', desc: 'Show list of past test runs. Click to view full report. Pull from Neon DB.', category: 'dashboard', priority: 'high', stage: 1 },
  { title: 'Report page: pull from DB', desc: 'TestReport page currently uses seed data. Pull real report from Neon when available.', category: 'reports', priority: 'high', stage: 1 },

  // ═══ STAGE 2: ANALYZER COMPLETENESS ═══
  { title: 'Contract Testing Analyzer', desc: 'Analyze API contracts. Detect OpenAPI/Swagger specs, verify endpoint signatures, find breaking changes.', category: 'analyzers', priority: 'high', stage: 2 },
  { title: 'Visual Regression Analyzer', desc: 'Compare screenshots for visual diffs. Detect layout shifts, missing elements, style regressions.', category: 'analyzers', priority: 'high', stage: 2 },
  { title: 'Edge Case Generator', desc: 'AI-based fuzzing. Generate edge case inputs for API endpoints. Find boundary bugs.', category: 'analyzers', priority: 'medium', stage: 2 },
  { title: 'Property-Based Testing', desc: 'Generate property invariants from code patterns. Test with random inputs.', category: 'analyzers', priority: 'medium', stage: 2 },
  { title: 'Chaos Engineering (real impl)', desc: 'Replace heuristic chaos with real fault injection. Kill services, simulate latency, test recovery.', category: 'analyzers', priority: 'medium', stage: 2 },
  { title: 'Mutation Testing (real impl)', desc: 'Replace heuristic with real mutation testing. Inject code mutations, measure kill rate.', category: 'analyzers', priority: 'medium', stage: 2 },
  { title: 'Predictive Model (real impl)', desc: 'Use historical findings to predict likely failure points. ML-based risk scoring.', category: 'analyzers', priority: 'medium', stage: 2 },
  { title: 'Pipeline page: real data wiring', desc: 'Connect pipeline visualization to actual test results. Show live progress for running tests.', category: 'pipeline', priority: 'high', stage: 2 },

  // ═══ STAGE 3: DASHBOARD & ANALYTICS ═══
  { title: 'Real-time test progress (SSE)', desc: 'Stream test progress from Fly.io to Dashboard via SSE. Show live stage updates.', category: 'dashboard', priority: 'high', stage: 3 },
  { title: 'Dashboard: quality trends over time', desc: 'Show quality score trends across multiple test runs. Compare current vs previous.', category: 'dashboard', priority: 'medium', stage: 3 },
  { title: 'Dashboard: team analytics', desc: 'If multiple users/orgs, show team-wide metrics. Test velocity, pass rates, coverage trends.', category: 'dashboard', priority: 'medium', stage: 3 },
  { title: 'Dashboard: export PDF report', desc: 'Generate downloadable PDF report from dashboard with all charts and findings.', category: 'dashboard', priority: 'low', stage: 3 },
  { title: 'PRD Generator: full real data', desc: 'Replace all mock sections with real data from analysis. Dynamic PRD from findings.', category: 'reports', priority: 'high', stage: 3 },
  { title: 'PRD Generator: save to DB', desc: 'Save generated PRDs to reports table. Enable viewing history.', category: 'reports', priority: 'medium', stage: 3 },

  // ═══ STAGE 4: ENTERPRISE FEATURES ═══
  { title: 'Organization/Team management', desc: 'Create organizations. Invite team members. Role-based access (admin/member/viewer).', category: 'enterprise', priority: 'high', stage: 4 },
  { title: 'GitHub App integration', desc: 'Install as GitHub App. Auto-run tests on PR. Post results as PR comments.', category: 'enterprise', priority: 'high', stage: 4 },
  { title: 'CI/CD webhook endpoint', desc: 'Accept webhooks from GitHub/GitLab. Auto-trigger tests on push/PR. Return status checks.', category: 'enterprise', priority: 'high', stage: 4 },
  { title: 'Stripe payment integration', desc: 'Connect Stripe for paid plans. Free tier + Pro + Enterprise. Usage-based billing.', category: 'enterprise', priority: 'high', stage: 4 },
  { title: 'Pricing page: real plans', desc: 'Dynamic pricing from DB. Feature comparison. Upgrade/downgrade flow.', category: 'enterprise', priority: 'medium', stage: 4 },
  { title: 'Rate limiting & API keys', desc: 'Rate limit API by user/org. API key generation. Usage tracking.', category: 'enterprise', priority: 'medium', stage: 4 },
  { title: 'SLA monitoring & status page', desc: 'Uptime monitoring for Fly.io MCP. Public status page. Incident history.', category: 'infrastructure', priority: 'medium', stage: 4 },
  { title: 'Audit logging', desc: 'Log all test runs, user actions, API calls. GDPR compliance ready.', category: 'enterprise', priority: 'medium', stage: 4 },
  { title: 'SSO / SAML integration', desc: 'Enterprise SSO via SAML/OIDC. Okta, Azure AD, Google Workspace.', category: 'auth', priority: 'low', stage: 4 },

  // ═══ STAGE 5: POLISH & SCALE ═══
  { title: 'The Integrator: real engine', desc: 'Build actual merge/dependency conflict analyzer. Cross-reference PRs, deps, tests.', category: 'pipeline', priority: 'low', stage: 5 },
  { title: 'Dark mode support', desc: 'Add dark mode toggle. System preference detection. Full color palette for dark mode.', category: 'ui_ux', priority: 'low', stage: 5 },
  { title: 'Mobile responsive audit', desc: 'Test all pages on mobile. Fix layout issues. Touch-friendly controls.', category: 'ui_ux', priority: 'medium', stage: 5 },
  { title: 'Accessibility audit (our own)', desc: 'Run our own a11y analyzer on our platform. Fix all WCAG issues.', category: 'ui_ux', priority: 'medium', stage: 5 },
  { title: 'Load test MCP server', desc: 'Benchmark Fly.io MCP. Determine max concurrent analyses. Auto-scale config.', category: 'infrastructure', priority: 'medium', stage: 5 },
  { title: 'Multi-region Fly.io deploy', desc: 'Deploy MCP servers in multiple regions. Route to nearest region.', category: 'infrastructure', priority: 'low', stage: 5 },
  { title: 'Terraform/Pulumi infra as code', desc: 'Infrastructure as code for Fly.io + Vercel + Neon. Reproducible deploys.', category: 'infrastructure', priority: 'low', stage: 5 },
  { title: 'API documentation page', desc: 'Dedicated /api-docs page with OpenAPI spec. Interactive try-it-out.', category: 'docs', priority: 'medium', stage: 5 },
  { title: 'Video tutorials', desc: 'Create demo videos for each feature. Embed in docs.', category: 'docs', priority: 'low', stage: 5 },
  { title: 'Blog/Changelog', desc: 'Product blog for announcements. Changelog page tracking releases.', category: 'docs', priority: 'low', stage: 5 },
];

async function seed() {
  console.log('🌱 Seeding enterprise tasks...');

  // Clear existing
  await sql`TRUNCATE TABLE enterprise_tasks CASCADE`;

  for (const t of tasks) {
    await sql`
      INSERT INTO enterprise_tasks (title, description, category, priority, status, stage)
      VALUES (${t.title}, ${t.desc}, ${t.category}, ${t.priority}, 'pending', ${t.stage})
    `;
  }
  console.log(`✅ ${tasks.length} tasks seeded`);

  // Show summary
  const byStage = await sql`SELECT stage, COUNT(*) as count, COUNT(*) FILTER (WHERE priority = 'critical') as critical FROM enterprise_tasks GROUP BY stage ORDER BY stage`;
  console.log('\n📊 TASK SUMMARY:');
  for (const row of byStage) {
    console.log(`  Stage ${row.stage}: ${row.count} tasks (${row.critical} critical)`);
  }

  await sql.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
