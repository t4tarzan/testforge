const SEED = [{
  id: 'TF-2026-001', projectId: 'proj_001', branch: 'main',
  commitHash: 'a1b2c3d', status: 'completed', overallScore: 68,
  totalFindings: 16, criticalCount: 1, highCount: 2, mediumCount: 5, lowCount: 8,
  startedAt: '2026-05-20T10:00:00Z', completedAt: '2026-05-20T10:05:30Z',
  config: { depth: 'normal' },
}];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;

  if (process.env.DATABASE_URL) {
    try {
      const { default: postgres } = await import('postgres');
      const { drizzle } = await import('drizzle-orm/postgres-js');
      const { sql } = await import('drizzle-orm');
      const client = postgres(process.env.DATABASE_URL, { max: 3, connect_timeout: 5 });
      const db = drizzle(client);

      if (id) {
        const rows = await db.execute(sql`SELECT * FROM test_runs WHERE id = ${id} LIMIT 1`);
        await client.end();
        if (rows.length > 0) return res.json(rows[0]);
      } else {
        const rows = await db.execute(sql`SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50`);
        await client.end();
        if (rows.length > 0) return res.json(rows);
      }
    } catch (e) {
      console.error('[test-runs] DB error:', e.message);
    }
  }

  return res.json(SEED);
}
