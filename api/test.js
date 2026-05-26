// /api/test — thin proxy to the MCP server's /test endpoint.
//
//   GET  /api/test?id=<runId>  → progress for a test run
//   POST /api/test             → start a new test run
//
// Critical: on upstream failure we DO NOT fabricate a testRunId. The
// previous behavior returned a fake `TF-{timestamp}` id that no actual
// test was ever associated with — the UI showed "test queued" but nothing
// ran. Now we 502/504 like /api/analyze and let the client retry.
import { withSecurity, isValidRepoUrl } from './_security.js';

const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev';
const UPSTREAM_TIMEOUT_MS = 9000; // Vercel functions get ~10s; leave headroom.

async function fetchWithTimeout(url, init = {}, ms = UPSTREAM_TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function passThrough(res, upstream, body) {
  res.status(upstream.status);
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') || 'application/json'
  );
  return res.send(body);
}

function upstreamError(res, e, retryHint) {
  const isTimeout = e?.name === 'AbortError';
  return res.status(isTimeout ? 504 : 502).json({
    error: isTimeout ? 'MCP server timed out' : 'MCP server unreachable',
    detail: e?.message,
    mcpServer: MCP_SERVER,
    retry: retryHint,
  });
}

async function handler(req, res) {
  // ── GET /api/test?id=<runId> ────────────────────────────────────────
  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: 'id (test run id) required' });
    }
    try {
      const upstream = await fetchWithTimeout(
        `${MCP_SERVER}/test/${encodeURIComponent(id)}/progress`
      );
      const body = await upstream.text();
      return passThrough(res, upstream, body);
    } catch (e) {
      return upstreamError(res, e, {
        endpoint: `${MCP_SERVER}/test/${id}/progress`,
        method: 'GET',
      });
    }
  }

  // ── POST /api/test ──────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { repoUrl, dimensions, branch } = req.body || {};
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' });
  }
  // Vercel proxy only accepts public GitHub URLs — local file paths only
  // make sense for the on-machine MCP, not the cloud one.
  if (!isValidRepoUrl(repoUrl)) {
    return res.status(400).json({ error: 'repoUrl must be a public GitHub URL' });
  }

  try {
    const upstream = await fetchWithTimeout(`${MCP_SERVER}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: repoUrl,
        dimensions: dimensions || ['security', 'unit', 'load', 'accessibility'],
        branch: branch || 'main',
      }),
    });
    const body = await upstream.text();
    return passThrough(res, upstream, body);
  } catch (e) {
    // No fake testRunId fallback. Clients must see the real failure and
    // retry — fabricating an id let the UI claim "test queued" forever.
    return upstreamError(res, e, {
      endpoint: `${MCP_SERVER}/test`,
      method: 'POST',
      body: { projectPath: repoUrl, dimensions, branch },
    });
  }
}

export default withSecurity(handler);
