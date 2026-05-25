// Phase 3: Enterprise Readiness — comprehensive audit + plan
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = postgres(DATABASE_URL, { max: 1 });

const tasks = [
  // ═══════════════════════════════════════════════════════════════
  // STAGE 13: DATA ISOLATION & MULTI-TENANCY
  // ═══════════════════════════════════════════════════════════════
  { title: 'Add user_id to projects table', desc: 'projects.user_id → users.id FK. Every project belongs to a user. Migrate existing data.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Add user_id to test_runs table', desc: 'test_runs.user_id → users.id FK. Filter test history by user.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Filter /api/projects by user', desc: 'Accept X-GitHub-User header. Return only user projects. Default for anonymous: all public.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Filter /api/history by user', desc: 'Return only test runs belonging to the authenticated user.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Filter /api/test-runs by user', desc: 'Same as history — user-specific data isolation.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Save user_id on test run creation', desc: '/api/save-results should associate runs with the user who triggered them.', cat: 'enterprise', pri: 'critical', stage: 13 },
  { title: 'Organization-scoped data', desc: 'Projects/test runs scoped to org. Members see org data. Org admin controls.', cat: 'enterprise', pri: 'high', stage: 13 },

  // ═══════════════════════════════════════════════════════════════
  // STAGE 14: SECURITY HARDENING
  // ═══════════════════════════════════════════════════════════════
  { title: 'API key authentication middleware', desc: 'All /api/* endpoints should accept X-API-Key header. Verify against api_keys table.', cat: 'enterprise', pri: 'critical', stage: 14 },
  { title: 'Rate limiting on all endpoints', desc: '10 req/min for free, 60 for pro, 300 for enterprise. Return 429 with Retry-After.', cat: 'enterprise', pri: 'critical', stage: 14 },
  { title: 'Input validation on all POST endpoints', desc: 'Validate repoUrl format, email format, required fields. Return 400 with clear messages.', cat: 'enterprise', pri: 'high', stage: 14 },
  { title: 'CORS restriction', desc: 'Restrict CORS to testforge.run only. Remove wildcard origin on sensitive endpoints.', cat: 'enterprise', pri: 'high', stage: 14 },
  { title: 'Helmet.js security headers', desc: 'Add CSP, HSTS, X-Frame-Options, X-Content-Type-Options headers to all responses.', cat: 'enterprise', pri: 'medium', stage: 14 },
  { title: 'SQL injection audit', desc: 'Verify all DB queries use parameterized statements. No string concatenation.', cat: 'enterprise', pri: 'high', stage: 14 },

  // ═══════════════════════════════════════════════════════════════
  // STAGE 15: UX POLISH & EMPTY STATES
  // ═══════════════════════════════════════════════════════════════
  { title: 'Empty states on all dashboard tabs', desc: 'Repos: Connect your first repo. Test Runs: Run your first test. API Keys: Generate first key.', cat: 'ui_ux', pri: 'high', stage: 15 },
  { title: 'Loading skeletons on dashboard', desc: 'Shimmer/skeleton cards while data loads. Not just spinners.', cat: 'ui_ux', pri: 'medium', stage: 15 },
  { title: 'Error boundaries on all pages', desc: 'React error boundaries. Friendly error messages with retry button. Never blank white screen.', cat: 'ui_ux', pri: 'high', stage: 15 },
  { title: 'Toast notifications for actions', desc: 'Success/error toasts for: key generated, repo connected, test started, plan changed.', cat: 'ui_ux', pri: 'medium', stage: 15 },
  { title: 'Mobile responsive audit', desc: 'Test all pages at 375px. Fix overflow, button sizes, table scrolling.', cat: 'ui_ux', pri: 'high', stage: 15 },
  { title: 'Keyboard navigation', desc: 'Tab through forms. Enter to submit. Escape to close modals. Focus indicators.', cat: 'ui_ux', pri: 'low', stage: 15 },

  // ═══════════════════════════════════════════════════════════════
  // STAGE 16: RELIABILITY & MONITORING
  // ═══════════════════════════════════════════════════════════════
  { title: 'Global error handler on MCP server', desc: 'Fastify error handler. Never crash on unhandled errors. Log and return 500.', cat: 'infrastructure', pri: 'high', stage: 16 },
  { title: 'Request logging with correlation IDs', desc: 'Add X-Request-ID to all API responses. Log request/response for debugging.', cat: 'infrastructure', pri: 'medium', stage: 16 },
  { title: 'Health check endpoint enhancements', desc: '/api/health should check DB connectivity, Fly.io status, Stripe connectivity.', cat: 'infrastructure', pri: 'high', stage: 16 },
  { title: 'Fly.io auto-scaling config', desc: 'Configure auto-scaling: min 2 machines, max 5. Scale on CPU > 70%.', cat: 'infrastructure', pri: 'medium', stage: 16 },
  { title: 'Database backup strategy', desc: 'Neon point-in-time recovery enabled. Weekly manual backup verification.', cat: 'infrastructure', pri: 'high', stage: 16 },
  { title: 'Uptime monitoring (external)', desc: 'Set up uptime monitor (BetterStack/Checkly). Alert on >1% error rate or >2s latency.', cat: 'infrastructure', pri: 'medium', stage: 16 },

  // ═══════════════════════════════════════════════════════════════
  // STAGE 17: ONBOARDING & DOCS
  // ═══════════════════════════════════════════════════════════════
  { title: 'First-run onboarding flow', desc: 'After GitHub login: welcome modal → quick tour → run first test → see results.', cat: 'docs', pri: 'high', stage: 17 },
  { title: 'Interactive demo/tutorial', desc: 'Guided walkthrough on managed page: paste example repo, see results, explore report.', cat: 'docs', pri: 'medium', stage: 17 },
  { title: 'FAQ page with real questions', desc: 'Common questions: limits, pricing, self-hosting, MCP setup, data privacy.', cat: 'docs', pri: 'medium', stage: 17 },
  { title: 'Changelog page', desc: 'Track all releases with dates. Link to GitHub releases.', cat: 'docs', pri: 'low', stage: 17 },
  { title: 'Video walkthrough (Loom-style)', desc: '2-min product demo video embedded on homepage.', cat: 'docs', pri: 'low', stage: 17 },
];

async function seed() {
  console.log('🌱 Seeding enterprise-readiness tasks...');
  for (const t of tasks) {
    await sql`
      INSERT INTO enterprise_tasks (title, description, category, priority, status, stage)
      VALUES (${t.title}, ${t.desc}, ${t.cat}, ${t.pri}, 'pending', ${t.stage})
    `;
  }
  
  const byStage = await sql`SELECT stage, COUNT(*) as c, COUNT(*) FILTER (WHERE priority = 'critical') as crit FROM enterprise_tasks WHERE stage >= 13 GROUP BY stage ORDER BY stage`;
  console.log(`\n📊 ${tasks.length} enterprise-readiness tasks seeded:`);
  for (const r of byStage) console.log(`  Stage ${r.stage}: ${r.c} tasks (${r.crit} critical)`);
  
  await sql.end();
}
seed().catch(e => { console.error(e); process.exit(1); });
