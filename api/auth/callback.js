// GitHub OAuth callback.
// Two-step: (1) redirect user to GitHub authorize, (2) exchange code for
// token, upsert the user, mint a session JWT, set cookie, redirect to app.
import { signSession, setSessionCookie } from '../_session.js';

export default async function handler(req, res) {
  const { code } = req.query || {};

  // ── Step 1: kick off OAuth ──────────────────────────────────────────
  if (!code) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
    }
    const stateStr = Math.random().toString(36).substring(2);
    const redirectUri = encodeURIComponent('https://testforge.run/api/auth/callback');
    const url =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=read:user%20user:email` +
      `&state=${stateStr}`;
    res.writeHead(302, { Location: url });
    return res.end();
  }

  // ── Step 2: exchange code, upsert user, mint session ────────────────
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser = await userRes.json();

    // Primary email if not public on profile.
    let email = ghUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      email = emails.find((e) => e.primary)?.email || emails[0]?.email;
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not configured' });
    }
    if (!ghUser.id) {
      return res.status(502).json({ error: 'GitHub did not return a user id' });
    }

    // Upsert and read back the row so we have the canonical users.id UUID
    // to encode in the JWT (downstream queries scope by users.id, not login).
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const rows = await db`
      INSERT INTO users (github_id, name, email, avatar_url, login, last_login_at)
      VALUES (
        ${String(ghUser.id)},
        ${ghUser.name || ghUser.login},
        ${email || ''},
        ${ghUser.avatar_url || ''},
        ${ghUser.login},
        NOW()
      )
      ON CONFLICT (github_id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        avatar_url = EXCLUDED.avatar_url,
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING id, github_id, name, email, avatar_url, login, plan
    `;
    const user = rows[0];

    const jwt = await signSession({
      id: user.id,
      githubId: user.github_id,
      login: user.login,
      plan: user.plan,
      email: user.email,
    });
    setSessionCookie(res, jwt);

    // Redirect to the account page. No user data in the URL — the frontend
    // calls /api/auth/me to read who's signed in.
    res.writeHead(302, { Location: '/#/account' });
    return res.end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
