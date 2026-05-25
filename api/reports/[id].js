import { withSecurity } from '../_security.js';
const SEED = {
  id: 'TF-2026-001',
  title: 'Security Hardening & Performance Scaling — express-ecommerce-api',
  overallScore: 68, criticalCount: 1, highCount: 2, mediumCount: 5, lowCount: 8,
  phases: [
    { name: 'Critical Security Fixes', priority: 'P0', effort: '2-3 days',
      items: [
        { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical', component: 'OrderController' },
        { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical', component: 'AuthMiddleware' },
        { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high', component: 'SearchService' },
      ],
    },
    { name: 'Authentication & Data Protection', priority: 'P1', effort: '3-4 days',
      items: [
        { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium', component: 'AuthController' },
        { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium', component: 'UserService' },
        { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low', component: 'ServerConfig' },
      ],
    },
  ],
  generatedAt: new Date().toISOString(),
};

async function handler(req, res) {
  const { id } = req.query;
  const reportId = id || 'TF-2026-001';

  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      const rows = await sql`SELECT * FROM reports WHERE test_run_id = ${reportId} LIMIT 1`;
      if (rows.length > 0) {
        const findings = await sql`SELECT * FROM findings WHERE test_run_id = ${reportId} ORDER BY severity, created_at`;
        return res.json({ ...rows[0], findings });
      }
    } catch (e) {
      console.error('[reports] DB error:', e.message);
    }
  }

  return res.json({ ...SEED, id: reportId });
}

export default withSecurity(handler);
