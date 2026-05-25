export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let dbStatus = 'not configured';
  const dbUrl = process.env.DATABASE_URL || '';

  if (dbUrl) {
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
    status: 'ok',
    version: '0.4.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    features: { projects: true, testRuns: true, reports: true, auth: true },
  });
}
// DB redeploy
