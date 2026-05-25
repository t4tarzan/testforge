import { withSecurity } from './_security.js';
const SEED = [{
  id: 'TF-2026-001', projectId: 'proj_001', branch: 'main',
  commitHash: 'a1b2c3d', status: 'completed', overallScore: 68,
  totalFindings: 16, criticalCount: 1, highCount: 2, mediumCount: 5, lowCount: 8,
  startedAt: '2026-05-20T10:00:00Z', completedAt: '2026-05-20T10:05:30Z',
  config: { depth: 'normal' },
}];

async function handler(req, res) {
  const { id } = req.query;

  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);

      if (id) {
        const rows = await sql`SELECT * FROM test_runs WHERE id = ${id} LIMIT 1`;
        if (rows.length > 0) return res.json(rows[0]);
      } else {
        const rows = await sql`SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50`;
        if (rows.length > 0) return res.json(rows);
      }
    } catch (e) {
      console.error('[test-runs] DB error:', e.message);
    }
  }

  return res.json(SEED);
}

export default withSecurity(handler);
