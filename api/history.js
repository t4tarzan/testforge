// GET /api/history — the signed-in user's recent test runs.
// Strictly scoped to their user_id. No anonymous fallback.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const rows = await db`
      SELECT tr.*, p.name AS project_name, p.repo_url
      FROM test_runs tr
      LEFT JOIN projects p ON tr.project_id = p.id
      WHERE tr.user_id = ${session.userId}
      ORDER BY tr.completed_at DESC NULLS LAST
      LIMIT 20
    `;
    return res.json(rows);
  } catch (e) {
    console.error('[history] DB error:', e.message);
    return res.status(500).json({ error: 'Failed to load history' });
  }
}

export default withSecurity(handler);
