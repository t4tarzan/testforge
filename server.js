// testforge-disable-file authentication-bypass
//
// Local-dev API shim. NOT deployed — production runs the real handlers
// in `api/*.js` as Vercel serverless functions. This file exists only so
// `npm run dev` can boot a Vite + an API together; the responses here
// are intentionally minimal (no mock JWTs, no fake user records) so
// nobody mistakes them for real behavior. For end-to-end local dev
// against the real handlers, run `vercel dev` instead of `npm run dev`.

import express from 'express';
import cors from 'cors';

const app = express();

// CORS allowlist — restrict to local Vite (9999) + the optional alt
// dev port (3000). Anything else gets refused. Closes the "CORS with
// default config" finding TestForge surfaced against this file.
const DEV_ORIGINS = new Set([
  'http://localhost:9999',
  'http://127.0.0.1:9999',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl / server-to-server (no Origin header)
    if (!origin) return cb(null, true);
    if (DEV_ORIGINS.has(origin)) return cb(null, true);
    cb(new Error('CORS: origin not allowed in dev'));
  },
}));
app.use(express.json());

// Health — public by design, no auth needed.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    devMode: true,
    timestamp: new Date().toISOString(),
    note: 'Dev shim. Production runs api/*.js on Vercel.',
  });
});

// Auth login — dev stub. No token issued. Real auth happens via
// api/auth/callback.js (GitHub OAuth) when running `vercel dev` or in
// production. Returning a fake token here was misleading; removed.
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  res.json({
    ok: true,
    devMode: true,
    message: 'Dev shim accepts the request but issues no token. ' +
      'Run `vercel dev` to exercise the real GitHub OAuth flow.',
    echo: { email },
  });
});

// Read-only collection stubs — empty arrays. Real handlers in
// api/projects.js, api/test-runs.js, api/reports/[id].js, etc. read
// from Neon. These dev stubs intentionally return nothing rather than
// stale demo data so the frontend's empty-state code paths get
// exercised.
app.get('/api/projects', (_req, res) => res.json([]));
app.get('/api/test-runs', (_req, res) => res.json([]));
app.get('/api/reports/:id', (_req, res) => res.status(404).json({ error: 'Not found (dev)' }));

// Live forwarders to the Fly.io MCP. /api/analyze + /api/test exist in
// production as Vercel functions that proxy to the MCP; the dev shim
// preserves the same behavior so the frontend works end-to-end against
// real MCP output during local dev.
const MCP_URL = 'https://testforge-mcp.fly.dev';

app.post('/api/analyze', async (req, res) => {
  const { repoUrl } = req.body || {};
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' });
  try {
    const upstream = await fetch(`${MCP_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: repoUrl }),
    });
    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: 'MCP unreachable in dev', detail: String(err) });
  }
});

app.post('/api/test', async (req, res) => {
  const { repoUrl, dimensions } = req.body || {};
  if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' });
  try {
    const upstream = await fetch(`${MCP_URL}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: repoUrl, dimensions, branch: 'main' }),
    });
    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: 'MCP unreachable in dev', detail: String(err) });
  }
});

app.get('/api/test/status', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id query param required' });
  try {
    const upstream = await fetch(`${MCP_URL}/test/${id}/progress`);
    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: 'MCP unreachable in dev', detail: String(err) });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`[dev shim] API listening on http://localhost:${PORT}`);
  console.log(`           For real handlers + GitHub OAuth, run \`vercel dev\` instead.`);
});
