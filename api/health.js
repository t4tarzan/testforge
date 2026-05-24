import { getDb } from '../_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const db = getDb();
  let dbStatus = 'not configured';
  
  if (db) {
    try {
      const { drizzle } = await import('drizzle-orm');
      await db.execute(drizzle.sql`SELECT 1`);
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }
  }

  return res.json({
    status: 'ok',
    version: '0.3.0',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    features: { projects: true, testRuns: true, reports: true, auth: true },
  });
}
