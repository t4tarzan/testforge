// POST /api/auth/logout — clears the session cookie. GET also works so
// users can hit it directly from a browser bookmark.
import { withSecurity } from '../_security.js';
import { clearSessionCookie } from '../_session.js';

async function handler(req, res) {
  clearSessionCookie(res);
  if (req.method === 'GET') {
    // Top-level navigation → bounce back to landing.
    res.writeHead(302, { Location: '/' });
    return res.end();
  }
  return res.json({ ok: true });
}

export default withSecurity(handler, { skipRateLimit: true });
