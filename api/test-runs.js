const { getDb } = require('../_db.js');

const SEED_RUNS = [{
  id: 'TF-2026-001', projectId: 'proj_001', branch: 'main',
  commitHash: 'a1b2c3d', status: 'completed', overallScore: 68,
  totalFindings: 16, criticalCount: 1, highCount: 2, mediumCount: 5, lowCount: 8,
  startedAt: '2026-05-20T10:00:00Z', completedAt: '2026-05-20T10:05:30Z',
  config: { depth: 'normal' },
}];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;
  const db = getDb();

  if (!db) return res.json(SEED_RUNS);

  try {
    const { sql } = require('drizzle-orm');
    if (id) {
      const rows = await db.execute(sql`SELECT * FROM test_runs WHERE id = ${id} LIMIT 1`);
      return res.json(rows[0] || null);
    }
    const rows = await db.execute(sql`SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50`);
    return res.json(rows.length > 0 ? rows : SEED_RUNS);
  } catch (err) {
    console.error('[test-runs]', err.message);
    return res.json(SEED_RUNS);
  }
};
