// Tiny structured logger.
// One-line JSON to stdout — picked up by Vercel logs as-is and parseable
// by any downstream collector (Sentry, Logflare, Datadog). No deps.
//
// Each request gets a correlation id (set by withSecurity) so handlers
// can log with `req.log.info('something happened', { extra: 'data' })`
// and the lines come out tagged with the same id.

import crypto from 'crypto';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toLowerCase()] || LEVELS.info;

function emit(level, message, ctx) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(ctx || {}),
  };
  // console.log goes to stdout which Vercel routes to project logs.
  // error level → console.error so it lights up the "Error" filter.
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

export function newRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

export function makeLogger(requestId, route) {
  const base = { rid: requestId, route };
  return {
    debug: (msg, ctx) => emit('debug', msg, { ...base, ...ctx }),
    info: (msg, ctx) => emit('info', msg, { ...base, ...ctx }),
    warn: (msg, ctx) => emit('warn', msg, { ...base, ...ctx }),
    error: (msg, ctx) => emit('error', msg, { ...base, ...ctx }),
  };
}
