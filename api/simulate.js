// /api/simulate — public, guarded proxy for LIVE simulations.
//
// A real sim BUILDS AND BOOTS UNTRUSTED REPO CODE on the shared VPS, so a public
// browser trigger is a genuine abuse surface. Guardrails here:
//   1. ALLOWLIST ONLY — the client sends a showcase `slug`, never a repo URL.
//      Only repos we curated can be run. (Arbitrary-repo runs must be
//      session-gated — not exposed here.)
//   2. SERVER-FORCED params — small, bounded ramp regardless of client input, so
//      one run is cheap (~minute) and can't be inflated.
//   3. TIGHT per-IP start limit (a few/min) on top of the normal rate limit.
//   4. The upstream /simulate is itself secret-gated; we inject the bearer.
//
// Flow (the upstream is async): POST {slug} → {jobId}; GET ?jobId=… → job state.
import { withSecurity, checkRateLimit } from './_security.js';

const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://mcp.testforge.run';
const UPSTREAM_TIMEOUT_MS = 30_000; // POST/GET are quick; the sim runs async upstream

// Curated, runnable repos a visitor may trigger live. Keep in sync with
// src/data/simulationShowcase/*.json (slugs). NEVER accept a raw repo URL here.
const ALLOWLIST = {
  'welcome-to-docker': 'https://github.com/docker/welcome-to-docker',
};

// Forced, bounded sim parameters for public runs — small ramps so a live demo
// stays ~1 minute and can't be turned into a resource sink.
const PUBLIC_SIM_PARAMS = {
  dimensions: ['load', 'agent', 'chaos'],
  concurrencyLevels: [10, 50, 100],
  durationPerLevelSec: 3,
  agentLevels: [25, 50, 100],
  faultType: 'restart',
};

const bearerHeaders = () => ({
  'Content-Type': 'application/json',
  ...(process.env.TESTFORGE_RUN_SECRET ? { Authorization: `Bearer ${process.env.TESTFORGE_RUN_SECRET}` } : {}),
});

// Pass an upstream JSON response through. Vercel's res lacks Express's .type(),
// so set the header explicitly and use .json()/.end().
function sendUpstream(res, status, text) {
  res.setHeader('Content-Type', 'application/json');
  try { return res.status(status).json(JSON.parse(text)); }
  catch { return res.status(status).end(text); }
}

async function startSim(req, res) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress || 'unknown';
  // Extra-tight limit on STARTS specifically (separate key from the poll limit).
  const start = await checkRateLimit(`simstart:${ip}`, 3, 60_000);
  if (!start.allowed) {
    const retryAfter = Math.max(1, Math.ceil((start.resetAt - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many live runs — try again shortly.', retryAfter });
  }

  const slug = (req.body || {}).slug;
  const repoUrl = ALLOWLIST[slug];
  if (!repoUrl) {
    return res.status(400).json({ error: 'Unknown or non-allowlisted showcase slug', slug, allowed: Object.keys(ALLOWLIST) });
  }
  if (!process.env.TESTFORGE_RUN_SECRET) {
    return res.status(503).json({ error: 'Live simulations not configured (TESTFORGE_RUN_SECRET missing on the proxy).' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${MCP_SERVER}/simulate`, {
      method: 'POST',
      headers: bearerHeaders(),
      body: JSON.stringify({ repoUrl, ...PUBLIC_SIM_PARAMS }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await upstream.text();
    if (!upstream.ok) return sendUpstream(res, upstream.status, text);
    const payload = JSON.parse(text);
    // Hand back our own poll URL, not the upstream path.
    return res.status(202).json({ jobId: payload.jobId, slug, statusUrl: `/api/simulate?jobId=${payload.jobId}` });
  } catch (e) {
    clearTimeout(timeout);
    return res.status(e.name === 'AbortError' ? 504 : 502).json({ error: 'MCP unreachable', detail: e.message });
  }
}

async function pollSim(req, res) {
  const jobId = req.query.jobId;
  if (!jobId || !/^sim_[a-z0-9]+$/.test(jobId)) {
    return res.status(400).json({ error: 'valid jobId required' });
  }
  if (!process.env.TESTFORGE_RUN_SECRET) {
    return res.status(503).json({ error: 'Live simulations not configured.' });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${MCP_SERVER}/simulate/${jobId}`, {
      method: 'GET',
      headers: bearerHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await upstream.text();
    return sendUpstream(res, upstream.status, text);
  } catch (e) {
    clearTimeout(timeout);
    return res.status(e.name === 'AbortError' ? 504 : 502).json({ error: 'MCP unreachable', detail: e.message });
  }
}

async function handler(req, res) {
  if (req.method === 'POST') return startSim(req, res);
  if (req.method === 'GET') return pollSim(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

// maxRequests is generous to allow polling; STARTS get the tighter limit above.
export default withSecurity(handler, { maxRequests: 90 });
