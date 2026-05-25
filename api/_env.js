// Centralized env-var contract. Imported once at module load by every
// handler that needs a particular variable, via `requireEnv(...)`.
//
// Why not validate everything at boot?
//   - Vercel serverless instances cold-start per request; "boot" is each
//     cold start. We don't want to crash 1/N requests because a route
//     that doesn't need Stripe is co-located with a missing STRIPE key.
//   - Instead each handler declares what it needs. If a required var is
//     missing, the call returns 500 with a clear message in the body
//     instead of failing silently or returning bogus data.
//
// Usage:
//   const env = requireEnv('DATABASE_URL', 'SESSION_SECRET');
//   env.DATABASE_URL  // typed string, guaranteed non-empty

const KNOWN_VARS = new Set([
  'DATABASE_URL',
  'SESSION_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_PRO',
  'STRIPE_PRICE_ENTERPRISE',
  'MCP_SERVER_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]);

export class MissingEnvError extends Error {
  constructor(names) {
    super(`Missing required env vars: ${names.join(', ')}`);
    this.name = 'MissingEnvError';
    this.missing = names;
  }
}

// Returns an object with the requested env vars, or throws MissingEnvError
// if any are missing/empty. Validates against KNOWN_VARS so typos in
// handler code surface at first request, not in production.
export function requireEnv(...names) {
  const out = {};
  const missing = [];
  for (const name of names) {
    if (!KNOWN_VARS.has(name)) {
      throw new Error(`Unknown env var '${name}' — add it to KNOWN_VARS in api/_env.js`);
    }
    const value = process.env[name];
    if (!value || value.length === 0) {
      missing.push(name);
      continue;
    }
    out[name] = value;
  }
  if (missing.length > 0) throw new MissingEnvError(missing);
  return out;
}

// Same shape but returns null instead of throwing — useful for optional
// vars where you want a graceful degraded mode.
export function optionalEnv(...names) {
  const out = {};
  for (const name of names) {
    out[name] = process.env[name] || null;
  }
  return out;
}
