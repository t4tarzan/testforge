// /api/analyze — thin proxy to the MCP server on Fly.io.
// We don't fabricate analysis results when the upstream is slow or down.
// The client should surface the error and offer retry/queueing.
import { withSecurity, isValidRepoUrl } from './_security.js';

const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev';

// Clone + multi-dimension analysis of a real repo takes far longer than the
// old 9s budget allowed (that comment predated Vercel's 300s ceiling). Give
// the upstream 120s; the function ceiling below sits well above it so we can
// still return a clean response/timeout.
const UPSTREAM_TIMEOUT_MS = 120_000;

// Allow the function to run long enough for a real analysis (Vercel default is
// now 300s on all plans).
export const config = { maxDuration: 300 };

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      mcpServer: MCP_SERVER,
      endpoints: {
        analyze: `${MCP_SERVER}/clone-and-analyze`,
        test: `${MCP_SERVER}/test`,
        health: `${MCP_SERVER}/health`,
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { repoUrl, branch = 'main' } = req.body || {};
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl required' });
  }
  if (!isValidRepoUrl(repoUrl)) {
    return res.status(400).json({ error: 'repoUrl must be a public GitHub URL' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${MCP_SERVER}/clone-and-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, branch }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Pass through the upstream status and body verbatim — the MCP server
    // is the source of truth, including for errors.
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(body);
  } catch (e) {
    clearTimeout(timeout);
    const isTimeout = e.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'MCP server timed out' : 'MCP server unreachable',
      detail: e.message,
      mcpServer: MCP_SERVER,
      // Hint the client toward async polling. Avoids fabricated numbers in
      // the UI while the user waits for the real analysis to land.
      retry: {
        endpoint: `${MCP_SERVER}/clone-and-analyze`,
        method: 'POST',
        body: { repoUrl, branch },
      },
    });
  }
}

export default withSecurity(handler);
