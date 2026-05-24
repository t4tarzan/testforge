const { getDb } = require('../_db.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let dbStatus = 'not configured';
  const db = getDb();
  
  if (db) {
    try {
      const { sql } = require('drizzle-orm');
      await db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch (err) {
      console.error('[health] DB check failed:', err.message);
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
};
