import { createClient } from '../src/db/client';
import { reports, findings, testRuns } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const id = pathParts[pathParts.length - 1];
  const format = url.searchParams.get('format') || 'json';

  try {
    const db = createClient();

    if (req.method === 'GET') {
      if (!db || id === 'latest') {
        // Return seed/mock report
        return Response.json({
          id: 'TF-2026-001',
          title: 'Security Hardening & Performance Scaling — express-ecommerce-api',
          overallScore: 68,
          criticalCount: 1,
          highCount: 2,
          mediumCount: 5,
          lowCount: 8,
          format,
          phases: [
            {
              name: 'Critical Security Fixes',
              priority: 'P0',
              effort: '2-3 days',
              items: [
                { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical', component: 'OrderController', finding: 'User input in $where query allows NoSQL injection' },
                { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical', component: 'AuthMiddleware', finding: '5 admin routes accessible without authentication' },
                { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high', component: 'SearchService', finding: 'User search terms rendered unsanitized in results page' },
              ],
            },
            {
              name: 'Authentication & Data Protection',
              priority: 'P1',
              effort: '3-4 days',
              items: [
                { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium', component: 'AuthController', finding: 'Login/register endpoints have no rate limiting — brute force risk' },
                { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium', component: 'UserService', finding: 'GET /api/users returns hashed passwords in response' },
                { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low', component: 'ServerConfig', finding: 'Wildcard CORS origin (*) allows any domain to make authenticated requests' },
              ],
            },
            {
              name: 'Performance & Load Handling',
              priority: 'P1',
              effort: '3-5 days',
              items: [
                { id: 'PERF-001', title: 'Add connection pooling for MongoDB', severity: 'medium', component: 'Database', finding: 'Default MongoDB driver creates one connection — 45 concurrent connection bottleneck' },
                { id: 'PERF-002', title: 'Implement response caching (Redis)', severity: 'medium', component: 'Middleware', finding: 'Product catalog queries take 200-800ms, no caching layer' },
                { id: 'PERF-003', title: 'Add compression middleware', severity: 'low', component: 'ServerConfig', finding: 'JSON responses not compressed — 40-60% bandwidth waste on large payloads' },
              ],
            },
            {
              name: 'Monitoring & Observability',
              priority: 'P2',
              effort: '2-3 days',
              items: [
                { id: 'OBS-001', title: 'Add structured logging (Pino/Winston)', severity: 'low', component: 'Logging', finding: 'Console.log used throughout — no log levels, correlation IDs, or structured output' },
                { id: 'OBS-002', title: 'Add health check endpoint', severity: 'low', component: 'ServerConfig', finding: 'No /health endpoint — load balancers cannot determine service health' },
                { id: 'OBS-003', title: 'Add error tracking (Sentry/Bugsnag)', severity: 'low', component: 'ErrorHandling', finding: 'Errors only logged to console — no aggregation, alerting, or error tracking' },
              ],
            },
          ],
          generatedAt: '2026-05-20T10:05:30Z',
        }, { headers });
      }

      const report = await db.select().from(reports).where(eq(reports.testRunId, id));
      if (!report.length) {
        return Response.json({ error: 'Report not found' }, { status: 404, headers });
      }

      // Also get the test run and findings
      const run = await db.select().from(testRuns).where(eq(testRuns.id, id)).limit(1);
      const runFindings = await db.select().from(findings).where(eq(findings.testRunId, id));

      return Response.json({
        ...report[0],
        testRun: run[0] || null,
        findings: runFindings,
      }, { headers });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}

