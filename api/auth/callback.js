// GitHub OAuth callback.
//
// Two-step:
//   (1) GET without `code` → mint a CSRF-safe state token, store it in an
//       httpOnly cookie (10 min TTL), redirect to GitHub authorize.
//   (2) GET with `code` → verify the cookie state matches the `state` query
//       param GitHub bounced back. If yes, exchange code → token, upsert
//       user, mint session JWT, set tf_session cookie, redirect to /#/account.
//
// Why the cookie roundtrip: without it, any link of the form
//   /api/auth/callback?code=<attacker_code>&state=<anything>
// would silently sign the victim in as the attacker (CSRF login fixation).
// The cookie is the only thing tying the callback to the user that started
// the flow.
import crypto from 'crypto';
import { signSession, setSessionCookie } from '../_session.js';

const STATE_COOKIE = 'tf_oauth_state';
const STATE_MAX_AGE_SECONDS = 600; // 10 minutes

function isProd() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function stateCookieAttrs(maxAge) {
  const parts = [`Path=/api/auth`, `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (isProd()) parts.push('Secure');
  return parts;
}

// Append to Set-Cookie rather than overwrite — the session cookie may also
// need to ride along on the same response (Step 2 success).
function appendSetCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', value);
  } else {
    res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, value] : [existing, value]);
  }
}

function setStateCookie(res, value) {
  appendSetCookie(res, `${STATE_COOKIE}=${value}; ${stateCookieAttrs(STATE_MAX_AGE_SECONDS).join('; ')}`);
}

function clearStateCookie(res) {
  appendSetCookie(res, `${STATE_COOKIE}=; ${stateCookieAttrs(0).join('; ')}`);
}

function readStateCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === STATE_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

// Constant-time compare guards against timing leaks. timingSafeEqual needs
// equal-length buffers, so check that first.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export default async function handler(req, res) {
  const { code, state: returnedState } = req.query || {};

  // ── Step 1: kick off OAuth ──────────────────────────────────────────
  if (!code) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
    }
    // 32 bytes = 256 bits of entropy. Hex is URL-safe; survives GitHub's
    // bounce-back verbatim.
    const stateValue = crypto.randomBytes(32).toString('hex');
    setStateCookie(res, stateValue);

    const redirectUri = encodeURIComponent('https://testforge.run/api/auth/callback');
    const url =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=read:user%20user:email` +
      `&state=${stateValue}`;
    res.writeHead(302, { Location: url });
    return res.end();
  }

  // ── Step 2: validate state, then exchange code ──────────────────────
  const cookieState = readStateCookie(req);
  if (!cookieState || !safeEqual(cookieState, String(returnedState || ''))) {
    // Same error for "no cookie" and "mismatch" — don't leak which arm
    // failed to an attacker probing the endpoint.
    clearStateCookie(res);
    return res.status(400).json({
      error: 'OAuth state mismatch — restart the sign-in flow from the app.',
    });
  }

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
      clearStateCookie(res);
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
    setSessionCookie(res, jwt); // sets tf_session
    clearStateCookie(res);       // also appends tf_oauth_state=; Max-Age=0

    res.writeHead(302, { Location: '/#/account' });
    return res.end();
  } catch (e) {
    clearStateCookie(res);
    return res.status(500).json({ error: e.message });
  }
}
