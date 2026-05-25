import { withSecurity } from './_security.js';
async function handler(req, res) {
  applySecurityHeaders(res);
  let dbStatus = 'not configured';

  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      await sql`SELECT 1`;
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'error: ' + e.message;
    }
  }

  return res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    version: '0.5.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    features: { projects: true, testRuns: true, reports: true, auth: true },
  });
}

export default withSecurity(handler, { skipRateLimit: true });
