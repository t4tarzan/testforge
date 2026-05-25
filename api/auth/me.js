// GET /api/auth/me — returns the current signed-in user, or 401 if no session.
// Reads the tf_session cookie; the frontend never sees the JWT.
import { withSecurity } from '../_security.js';
import { getSessionFromRequest } from '../_session.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // If the DB is reachable, hydrate from the live row so plan/tests_run etc.
  // reflect current state (Stripe upgrades, usage counters).
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(process.env.DATABASE_URL);
      const rows = await db`
        SELECT id, github_id, name, email, avatar_url, login, plan, tests_run
        FROM users WHERE id = ${session.userId} LIMIT 1
      `;
      if (rows.length > 0) {
        const u = rows[0];
        return res.json({
          id: u.id,
          githubId: u.github_id,
          login: u.login,
          name: u.name,
          email: u.email,
          avatar: u.avatar_url,
          plan: u.plan,
          testsRun: u.tests_run ?? 0,
        });
      }
    } catch (e) {
      // Fall through to JWT-only response so a transient DB hiccup doesn't
      // log the user out.
      console.error('[auth/me] DB read failed:', e.message);
    }
  }

  // Fallback: respond from JWT payload only.
  return res.json({
    id: session.userId,
    githubId: session.githubId,
    login: session.login,
    email: session.email,
    plan: session.plan,
    name: session.login,
    avatar: null,
    testsRun: 0,
  });
}

export default withSecurity(handler, { skipRateLimit: true });
