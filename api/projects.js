// GET /api/projects — list projects owned by the signed-in user.
// Returns 401 if not authenticated. Empty list (not seed data) if the user
// has no projects yet — the UI shows an empty state.
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
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT id, user_id, name, repo_url, local_path, branch, tech_stack,
             created_at, updated_at
      FROM projects
      WHERE user_id = ${session.userId}
      ORDER BY updated_at DESC
    `;
    return res.json(rows);
  } catch (e) {
    console.error('[projects] DB error:', e.message);
    return res.status(500).json({ error: 'Failed to load projects' });
  }
}

export default withSecurity(handler);
