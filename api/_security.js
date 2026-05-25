// Shared security middleware for all Vercel API endpoints.
// Every handler should be exported as `withSecurity(handler, opts)`.
// That wrapper handles CORS preflight, security headers, and rate limiting
// in one place — handlers don't set those themselves any more.
import crypto from 'crypto';

// ── CORS allowlist ──────────────────────────────────────────────────────
// Reflected origin (Vary: Origin), credentials enabled. Anything not on this
// list is rejected for cross-site browser requests; server-to-server calls
// (no Origin header) pass through.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/testforge\.run$/,
  /^https:\/\/[a-z0-9-]+(?:--[a-z0-9-]+)?\.vercel\.app$/, // preview deployments
  /^http:\/\/localhost:(?:9999|3001|5173)$/,
  /^http:\/\/127\.0\.0\.1:(?:9999|3001|5173)$/,
];

function originIsAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

// Apply CORS headers. If publicCors=true, allow any origin (for /badge etc).
// Otherwise reflect a matching origin only.
function applyCors(req, res, { publicCors = false } = {}) {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (publicCors) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return true;
  }
  if (!origin) {
    // Server-to-server call (no browser Origin). Don't set ACAO; let it through.
    return true;
  }
  if (originIsAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return true;
  }
  return false; // disallowed cross-site request
}

// ── Rate Limiter ────────────────────────────────────────────────────────
// Primary: Upstash Redis (atomic, shared across every Vercel function
// instance, free tier covers launch). Provision via Vercel marketplace →
// Upstash Redis; it auto-injects UPSTASH_REDIS_REST_URL and _TOKEN.
//
// Fallback: in-memory Map. Per-serverless-instance, effectively useless
// under real load, but lets local dev and pre-launch deploys keep working
// without Upstash configured. A console.warn fires on the first request so
// it's visible in Vercel logs.
//
// Limiters are keyed (`maxRequests:windowMs`) and cached per process so we
// don't spin up a new client on every call.
const limiterCache = new Map();
const memoryStore = new Map();
let warnedAboutFallback = false;

function hasUpstashCreds() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

async function getUpstashLimiter(maxRequests, windowMs) {
  const cacheKey = `${maxRequests}:${windowMs}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey);

  const { Redis } = await import('@upstash/redis');
  const { Ratelimit } = await import('@upstash/ratelimit');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(maxRequests, `${Math.round(windowMs / 1000)} s`),
    analytics: false,
    prefix: 'tf_rl',
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

function checkMemoryFallback(ip, maxRequests, windowMs) {
  const now = Date.now();
  const key = ip || 'anonymous';
  const record = memoryStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }
  memoryStore.set(key, record);
  if (memoryStore.size > 500) {
    for (const [k, v] of memoryStore) if (now > v.resetAt) memoryStore.delete(k);
  }
  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

export async function checkRateLimit(ip, maxRequests = 60, windowMs = 60000) {
  if (!hasUpstashCreds()) {
    if (!warnedAboutFallback) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL/_TOKEN not set — using in-memory ' +
          'fallback. This does not actually rate-limit on serverless. ' +
          'Provision Upstash Redis on Vercel Marketplace.'
      );
      warnedAboutFallback = true;
    }
    return checkMemoryFallback(ip, maxRequests, windowMs);
  }

  try {
    const limiter = await getUpstashLimiter(maxRequests, windowMs);
    const result = await limiter.limit(ip || 'anonymous');
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    };
  } catch (err) {
    // If Upstash itself is down, fail open rather than locking everyone out.
    console.error('[rate-limit] Upstash error, falling open:', err.message);
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

// ── API Key Verification ────────────────────────────────────────────────
let dbCache = null;

export async function verifyApiKey(key) {
  if (!key || !key.startsWith('tf_')) return null;
  if (!process.env.DATABASE_URL) return null;

  try {
    const { neon } = await import('@neondatabase/serverless');
    if (!dbCache) dbCache = neon(process.env.DATABASE_URL);

    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const rows = await dbCache`SELECT id, user_id FROM api_keys WHERE key_hash = ${keyHash} AND revoked_at IS NULL LIMIT 1`;

    if (rows.length > 0) {
      await dbCache`UPDATE api_keys SET last_used = NOW() WHERE key_hash = ${keyHash}`;
      return { keyId: rows[0].id, userId: rows[0].user_id };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Security headers (no CORS bits) ─────────────────────────────────────
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

// ── Repo URL validation (used by /api/analyze, /api/test) ───────────────
export function isValidRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url.trim());
}

// ── Master wrapper ──────────────────────────────────────────────────────
// Wrap every handler with this. Options:
//   publicCors  — allow `*` origin (use for /badge, /status, /docs RSS)
//   maxRequests — rate limit override (default 60/min)
//   skipRateLimit — for /health and other always-on endpoints
export function withSecurity(handler, opts = {}) {
  const { publicCors = false, maxRequests = 60, skipRateLimit = false } = opts;

  return async (req, res) => {
    applySecurityHeaders(res);
    const corsOk = applyCors(req, res, { publicCors });

    if (!corsOk) {
      // Cross-site request from a disallowed origin. Refuse outright.
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    if (!skipRateLimit) {
      const ip =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown';
      const rate = await checkRateLimit(ip, maxRequests, 60000);
      res.setHeader('X-RateLimit-Remaining', rate.remaining);
      res.setHeader('X-RateLimit-Reset', rate.resetAt);
      if (!rate.allowed) {
        const retryAfter = Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
      }
    }

    return handler(req, res);
  };
}
