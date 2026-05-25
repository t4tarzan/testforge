// /api/auth/login is a deliberately disabled placeholder.
// Email/password sign-in isn't implemented; only GitHub OAuth is supported.
// Keep the route so old links don't 404 — return 410 Gone with guidance.
import { withSecurity } from '../_security.js';

async function handler(_req, res) {
  return res.status(410).json({
    error: 'Email/password sign-in is not available',
    next: 'Use GitHub OAuth at /api/auth/callback',
  });
}

export default withSecurity(handler, { skipRateLimit: true });
