// Seed the Neon PostgreSQL database with initial data
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...');

  // Check if data already exists
  const existing = await db.execute(sql`SELECT COUNT(*) as count FROM projects`);
  if (existing[0]?.count > 0) {
    console.log('Database already has data, skipping seed.');
    await client.end();
    return;
  }

  // Create project
  const projectId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  await db.execute(sql`
    INSERT INTO projects (id, name, repo_url, local_path, branch, tech_stack)
    VALUES (${projectId}, 'express-ecommerce-api', 
      'https://github.com/testforge-demo/express-ecommerce-api',
      '/projects/express-ecommerce-api', 'main',
      '["Node.js","Express","MongoDB","JWT"]'::jsonb)
  `);
  console.log('  ✅ Project created');

  // Create test run
  const runId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  await db.execute(sql`
    INSERT INTO test_runs (id, project_id, branch, commit_hash, status, overall_score,
      started_at, completed_at, config, total_findings, critical_count, high_count, medium_count, low_count)
    VALUES (${runId}, ${projectId}, 'main', 'a1b2c3d', 'completed', 68,
      '2026-05-20T10:00:00Z', '2026-05-20T10:05:30Z', '{"depth":"normal"}'::jsonb,
      16, 1, 2, 5, 8)
  `);
  console.log('  ✅ Test run created');

  // Create findings
  const findings = [
    { dim: 'security', sev: 'critical', title: 'NoSQL Injection in /api/orders', file: 'src/routes/orders.ts', line: 45, fix: 'Use parameterized queries or an ORM. Replace $where with proper MongoDB query operators.' },
    { dim: 'security', sev: 'critical', title: 'Missing auth on /admin/* routes', file: 'src/routes/admin.ts', line: 1, fix: 'Add JWT authentication middleware to all admin routes.' },
    { dim: 'security', sev: 'high', title: 'XSS in search results', file: 'src/routes/search.ts', line: 32, fix: 'Sanitize user input before rendering in HTML responses.' },
    { dim: 'security', sev: 'medium', title: 'Rate limiting missing on auth', file: 'src/routes/auth.ts', line: 12, fix: 'Add rate limiting middleware to /auth/login and /auth/register endpoints.' },
    { dim: 'security', sev: 'medium', title: 'Password hash in API response', file: 'src/services/user.ts', line: 78, fix: 'Exclude password field from user projection in GET responses.' },
    { dim: 'security', sev: 'low', title: 'CORS wildcard origin', file: 'src/server.ts', line: 15, fix: 'Restrict CORS to specific allowed origins.' },
    { dim: 'load', sev: 'medium', title: 'No connection pooling', file: 'src/db.ts', line: 5, fix: 'Configure MongoDB connection pool with minPoolSize and maxPoolSize.' },
    { dim: 'load', sev: 'medium', title: 'No response caching', file: 'src/server.ts', line: 1, fix: 'Add Redis caching layer for product catalog queries.' },
    { dim: 'load', sev: 'low', title: 'No compression middleware', file: 'src/server.ts', line: 8, fix: 'Add compression middleware to reduce response sizes.' },
    { dim: 'unit', sev: 'medium', title: 'Low test coverage (45%)', file: 'src/', line: 0, fix: 'Write unit tests for core business logic. Aim for 80%+ coverage.' },
    { dim: 'accessibility', sev: 'low', title: 'Missing alt text on images', file: 'src/views/', line: 0, fix: 'Add descriptive alt attributes to all img elements.' },
    { dim: 'predictive', sev: 'high', title: 'Missing input validation', file: 'src/routes/', line: 0, fix: 'Add Zod or Joi validation for all API endpoints.' },
    { dim: 'predictive', sev: 'high', title: 'No global error handler', file: 'src/server.ts', line: 1, fix: 'Add Express error handling middleware.' },
    { dim: 'predictive', sev: 'medium', title: 'process.exit() calls detected', file: 'src/server.ts', line: 50, fix: 'Use graceful shutdown: close server, drain connections, then exit.' },
    { dim: 'chaos', sev: 'low', title: 'Database latency injection', file: 'src/', line: 0, fix: 'Implement circuit breaker pattern for database calls.' },
    { dim: 'mutation', sev: 'medium', title: 'Mutation score: 47%', file: 'src/', line: 0, fix: 'Add boundary condition tests and error path tests.' },
  ];

  for (const f of findings) {
    await db.execute(sql`
      INSERT INTO findings (test_run_id, dimension, severity, title, file_path, line_number, fix_suggestion, status)
      VALUES (${runId}, ${f.dim}, ${f.sev}, ${f.title}, ${f.file}, ${f.line}, ${f.fix}, 'open')
    `);
  }
  console.log(`  ✅ ${findings.length} findings created`);

  // Create report
  const reportContent = {
    phases: [
      {
        name: 'Critical Security Fixes', priority: 'P0', effort: '2-3 days',
        items: [
          { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical', component: 'OrderController' },
          { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical', component: 'AuthMiddleware' },
          { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high', component: 'SearchService' },
        ],
      },
      {
        name: 'Authentication & Data Protection', priority: 'P1', effort: '3-4 days',
        items: [
          { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium', component: 'AuthController' },
          { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium', component: 'UserService' },
          { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low', component: 'ServerConfig' },
        ],
      },
    ],
    meta: { generatedAt: new Date().toISOString(), version: '1.0', model: 'testforge-v1' },
  };

  await db.execute(sql`
    INSERT INTO reports (test_run_id, title, content, format)
    VALUES (${runId}, 'Security Hardening & Performance Scaling — express-ecommerce-api', ${JSON.stringify(reportContent)}::jsonb, 'json')
  `);
  console.log('  ✅ Report created');

  console.log('\n🎉 Database seeded successfully!');
  await client.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
