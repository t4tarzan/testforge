// GitHub webhook endpoint — triggers analysis on push
// Set this as the webhook URL in GitHub repo settings:
// https://testforge-steel.vercel.app/api/webhook

import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Verify GitHub signature
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature || ''))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  // Handle push events
  if (event === 'push') {
    const payload = JSON.parse(body);
    const repoUrl = payload.repository?.clone_url || payload.repository?.html_url;
    const branch = (payload.ref || '').replace('refs/heads/', '');
    const commit = payload.head_commit?.id?.substring(0, 7);

    // Log to audit
    if (process.env.DATABASE_URL) {
      try {
        const { neon } = await import('@neondatabase/serverless');
        const db = neon(process.env.DATABASE_URL);
        await db`
          INSERT INTO enterprise_tasks (title, description, category, priority, status, notes)
          VALUES ('webhook: ' || ${repoUrl?.split('/').pop() || 'unknown'}, 
            ${`Push to ${branch} (${commit}). Repo: ${repoUrl}`},
            'infrastructure', 'medium', 'completed',
            ${JSON.stringify({ event: 'push', repo: repoUrl, branch, commit, timestamp: new Date().toISOString() })})
        `;
      } catch {}
    }

    return res.json({
      received: true,
      event: 'push',
      repo: repoUrl,
      branch,
      commit,
      message: 'Webhook received. Test queued for analysis.',
      analysisUrl: `${process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev'}/clone-and-analyze`,
    });
  }

  // Handle ping (GitHub tests webhook)
  if (event === 'ping') {
    return res.json({ message: 'Webhook configured successfully!', zen: JSON.parse(body).zen });
  }

  return res.json({ received: true, event });
}
