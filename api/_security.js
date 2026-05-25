// Shared security middleware for all Vercel API endpoints
import crypto from 'crypto';

// ── Rate Limiter (in-memory, per-IP) ────────────────────────────────────
const rateStore = new Map();

export function checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const key = ip || 'anonymous';
  const record = rateStore.get(key) || { count: 0, resetAt: now + windowMs };
  
  if (now > record.resetAt) { record.count = 1; record.resetAt = now + windowMs; }
  else { record.count++; }
  rateStore.set(key, record);
  
  // Cleanup old entries every 1000 requests
  if (rateStore.size > 500) {
    for (const [k, v] of rateStore) { if (now > v.resetAt) rateStore.delete(k); }
  }
  
  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt,
  };
}

// ── API Key Verification ────────────────────────────────────────────────
let dbCache = null;

export async function verifyApiKey(key) {
  if (!key || !key.startsWith('tf_')) return false;
  if (!process.env.DATABASE_URL) return true; // No DB = allow all
  
  try {
    const { neon } = await import('@neondatabase/serverless');
    if (!dbCache) dbCache = neon(process.env.DATABASE_URL);
    
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const rows = await dbCache`SELECT id FROM api_keys WHERE key_hash = ${keyHash} AND revoked_at IS NULL LIMIT 1`;
    
    if (rows.length > 0) {
      await dbCache`UPDATE api_keys SET last_used = NOW() WHERE key_hash = ${keyHash}`;
      return true;
    }
    return false;
  } catch { return false; }
}

// ── Apply security headers ──────────────────────────────────────────────
export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!res.getHeader('Access-Control-Allow-Origin') || res.getHeader('Access-Control-Allow-Origin') === '*') {
    res.setHeader('Access-Control-Allow-Origin', 'https://testforge.run');
  }
}

// ── Validate repo URL ───────────────────────────────────────────────────
export function isValidRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url.trim());
}

// ── Wrap handler with security ──────────────────────────────────────────
export function withSecurity(handler) {
  return async (req, res) => {
    applySecurityHeaders(res);
    
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rate = checkRateLimit(ip, 60, 60000); // 60 req/min default
    
    res.setHeader('X-RateLimit-Remaining', rate.remaining);
    res.setHeader('X-RateLimit-Reset', rate.resetAt);
    
    if (!rate.allowed) {
      res.setHeader('Retry-After', Math.ceil((rate.resetAt - Date.now()) / 1000));
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.', retryAfter: Math.ceil((rate.resetAt - Date.now()) / 1000) });
    }
    
    return handler(req, res);
  };
}
