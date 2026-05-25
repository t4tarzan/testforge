// Session helper — signed JWT in an httpOnly cookie.
// Replaces the old `x-github-user` header trust which was forgeable.
//
// Cookie:  tf_session     httpOnly, secure (prod), sameSite=Lax, 30d
// Algo:    HS256 with SESSION_SECRET (≥32 bytes random)
// Payload: { sub: userId(UUID), gh: githubId, login, plan, email }
//
// On Vercel, configure SESSION_SECRET in project env. The frontend never
// sees the JWT — it only reads /api/auth/me which validates the cookie.

import { SignJWT, jwtVerify } from 'jose';

const COOKIE_NAME = 'tf_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

let cachedSecret = null;
function getSecret() {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    // Fail loudly during request — better than silently accepting bad sessions.
    throw new Error(
      'SESSION_SECRET is not configured (need ≥32 chars). Add it in Vercel env.'
    );
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export async function signSession(user) {
  const payload = {
    sub: user.id, // users.id UUID
    gh: String(user.githubId ?? ''),
    login: user.login,
    plan: user.plan || 'free',
    email: user.email || null,
  };
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return {
      userId: payload.sub,
      githubId: payload.gh,
      login: payload.login,
      plan: payload.plan,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (isProd) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

// Read & verify session from a request. Returns the session payload
// (with userId etc.) or null. Routes that require auth should call
// `requireSession(req, res)` instead, which sends 401 on failure.
export async function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return verifySession(cookies[COOKIE_NAME]);
}

export async function requireSession(req, res) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return session;
}
