// GET /api/reports/:id — returns a stored report joined with findings.
// Requires a session: reports are user data, not public. Returns 404 if
// the id doesn't exist — never invents data so the UI can render an
// honest empty state.
import { withSecurity } from '../_security.js';
import { requireSession } from '../_session.js';

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Report id required' });

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);

    // Scope to this user via the parent test_run. If the run was anonymous
    // (user_id IS NULL) we let it through too so old/imported rows still
    // render for whoever owns them; new writes from save-results.js always
    // set user_id.
    const rows = await sql`
      SELECT r.*, tr.branch, tr.commit_hash, tr.user_id AS run_user_id,
             tr.overall_score, tr.critical_count, tr.high_count,
             tr.medium_count, tr.low_count, p.name AS project_name,
             p.repo_url
      FROM reports r
      LEFT JOIN test_runs tr ON r.test_run_id = tr.id
      LEFT JOIN projects p ON tr.project_id = p.id
      WHERE r.test_run_id = ${id} OR r.id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Report not found', id });
    }
    const row = rows[0];
    // Auth check: if the run has an owner, it must match the requester.
    if (row.run_user_id && row.run_user_id !== session.userId) {
      return res.status(404).json({ error: 'Report not found', id });
    }

    const findings = await sql`
      SELECT * FROM findings WHERE test_run_id = ${row.test_run_id}
      ORDER BY severity, created_at
    `;
    return res.json({ ...row, findings });
  } catch (e) {
    console.error('[reports/:id] DB error:', e.message);
    return res.status(500).json({ error: 'Failed to load report' });
  }
}

export default withSecurity(handler);
