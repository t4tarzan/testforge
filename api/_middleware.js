// Simple API key verification middleware
// Check X-API-Key header against stored keys

const VALID_KEYS = (process.env.API_KEYS || '').split(',').filter(Boolean);

export function verifyApiKey(req) {
  const key = req.headers?.['x-api-key'] || req.query?.api_key;
  if (!VALID_KEYS.length) return true; // No keys configured = open access
  return VALID_KEYS.includes(key);
}

// Simple in-memory rate limiter
const rateLimit = new Map();

export function checkRateLimit(key, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimit.get(key) || { count: 0, resetAt: now + windowMs };
  
  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
  } else {
    record.count++;
  }
  
  rateLimit.set(key, record);
  
  // Cleanup old entries periodically
  if (rateLimit.size > 1000) {
    for (const [k, v] of rateLimit) {
      if (now > v.resetAt) rateLimit.delete(k);
    }
  }
  
  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetAt: record.resetAt,
  };
}
