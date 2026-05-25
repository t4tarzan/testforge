// /api/status — public status page data. Polled by the website (and any
// external uptime monitor) at testforge.run/api/status. Public CORS on
// purpose so third-party badges can embed it.
//
// Checks run in parallel with a hard 5s budget each so one slow upstream
// doesn't drag the whole endpoint past Vercel's 10s function limit.
import { withSecurity } from './_security.js';

const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev';

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

async function checkUrl(url) {
  const res = await withTimeout(fetch(url, { method: 'GET' }), 5000);
  return res.ok ? 'operational' : 'degraded';
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) return 'not_configured';
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(process.env.DATABASE_URL);
  await withTimeout(db`SELECT 1`, 5000);
  return 'operational';
}

async function safeCheck(name, fn) {
  try {
    return { name, status: await fn() };
  } catch (e) {
    return { name, status: 'down', error: e.message };
  }
}

async function handler(req, res) {
  const checks = await Promise.all([
    safeCheck('MCP Server', () => checkUrl(`${MCP_SERVER}/health`)),
    safeCheck('Database', () => checkDatabase()),
    safeCheck('npm Package', () =>
      checkUrl('https://registry.npmjs.org/@whitenoisenpm/testforge-mcp/latest')
    ),
  ]);

  // Web Platform is always operational from this endpoint's own perspective —
  // if it weren't, the request wouldn't have reached this code path. Mark
  // it green explicitly so the website's status widget is honest.
  const services = [{ name: 'Web Platform', status: 'operational' }, ...checks];

  const overall = services.every((s) => s.status === 'operational')
    ? 'all_systems_operational'
    : services.some((s) => s.status === 'down')
      ? 'major_outage'
      : 'partial_outage';

  // Short cache header — uptime monitors poll fast, but we don't need to
  // re-check Neon every request.
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');

  return res.json({
    status: overall,
    updatedAt: new Date().toISOString(),
    services,
  });
}

export default withSecurity(handler, { publicCors: true, skipRateLimit: true });
