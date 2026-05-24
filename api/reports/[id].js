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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;
  const reportId = id || 'TF-2026-001';

  if (process.env.DATABASE_URL) {
    try {
      const { default: postgres } = await import('postgres');
      const { drizzle } = await import('drizzle-orm/postgres-js');
      const { sql } = await import('drizzle-orm');
      const client = postgres(process.env.DATABASE_URL, { max: 3, connect_timeout: 5 });
      const db = drizzle(client);

      const rows = await db.execute(sql`SELECT * FROM reports WHERE test_run_id = ${reportId} LIMIT 1`);
      if (rows.length > 0) {
        const findings = await db.execute(sql`SELECT * FROM findings WHERE test_run_id = ${reportId} ORDER BY severity, created_at`);
        await client.end();
        return res.json({ ...rows[0], findings });
      }
      await client.end();
    } catch (e) {
      console.error('[reports] DB error:', e.message);
    }
  }

  return res.json({ ...SEED, id: reportId });
}
