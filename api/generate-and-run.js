// /api/generate-and-run — managed-side Tier 2 proxy.
//
// Tier 2 (LLM generates Vitest tests + sandbox executes them) is the Forge
// plan feature. This route:
//   1. Requires a session (no anon access — every iteration is metered)
//   2. Reads plan LIVE from the users table via _gate.js
//   3. Rejects with 402 if the plan doesn't include Tier 2, or if the
//      monthly iteration quota is exhausted
//   4. Proxies the request to the upstream MCP on Fly.io
//   5. Records the successful iteration so the next call sees the new count
//
// Self-host MCP (npx @whitenoisenpm/testforge-mcp serve) does NOT go through
// this route — it talks directly to /generate-and-run on the user's own
// localhost:33221 with their own OPENROUTER_API_KEY. They pay OpenRouter
// directly; we don't meter them.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';
import { denyIfOverTier2Quota, recordTier2Iteration, getQuota } from './_gate.js';

const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev';
// Tier-2 takes ~45-90s for 3 findings; budget for that plus headroom. Vercel
// Pro Functions allow up to 5 min — we use a chunk of that here.
const UPSTREAM_TIMEOUT_MS = 180_000;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  const userId = session.userId;
  const sessionPlan = session.plan || 'free';

  // Plan + quota gate. Forge gets 100/mo, Enterprise unlimited, everyone
  // else gets a 402 with an upgradeUrl.
  const deny = await denyIfOverTier2Quota(userId, sessionPlan);
  if (deny) return res.status(deny.status).json(deny.body);

  const body = req.body || {};
  if (!Array.isArray(body.findings) || body.findings.length === 0) {
    return res.status(400).json({ error: 'findings: Finding[] required' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${MCP_SERVER}/generate-and-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Managed MCP gates Tier-2 behind this shared secret; self-host MCP
        // ignores it. Set TESTFORGE_RUN_SECRET in Vercel + on the VPS.
        ...(process.env.TESTFORGE_RUN_SECRET ? { Authorization: `Bearer ${process.env.TESTFORGE_RUN_SECRET}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).type('application/json').send(text);
    }

    const payload = await upstream.json();

    // Record the iteration ONLY when the upstream actually processed something.
    // A 200 with processed=0 / empty results doesn't count against the quota.
    if (payload && payload.processed > 0 && payload.generationId) {
      try {
        await recordTier2Iteration(userId, payload.generationId, {
          cluster: payload.cluster,
          provider: payload.provider,
          generationMs: payload.generationMs,
          runMs: payload.runMs,
          numTotalTests: payload.run?.numTotalTests ?? null,
          numPassedTests: payload.run?.numPassedTests ?? null,
        });
      } catch (err) {
        // Quota record failure shouldn't fail the request — surface in logs.
        console.error('[generate-and-run] recordTier2Iteration failed:', err.message);
      }
    }

    // Attach the live remaining count so the dashboard can render it without
    // a second round-trip.
    let quotaSnapshot = null;
    try {
      const q = await getQuota(userId, sessionPlan);
      quotaSnapshot = {
        plan: q.plan,
        tier2Used: q.tier2Used,
        tier2Remaining: q.tier2Remaining === Infinity ? null : q.tier2Remaining,
        tier2Limit:
          q.limits.tier2IterationsPerMonth === Infinity
            ? null
            : q.limits.tier2IterationsPerMonth,
      };
    } catch {
      quotaSnapshot = null;
    }

    return res.status(200).json({ ...payload, quota: quotaSnapshot });
  } catch (e) {
    clearTimeout(timeout);
    const isTimeout = e.name === 'AbortError';
    return res.status(isTimeout ? 504 : 502).json({
      error: isTimeout ? 'MCP generate-and-run timed out' : 'MCP server unreachable',
      detail: e.message,
      mcpServer: MCP_SERVER,
    });
  }
}

export default withSecurity(handler);
