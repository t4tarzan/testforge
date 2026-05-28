import crypto from 'crypto';
import { withSecurity } from './_security.js';

// Recipient list for the digest send job. Server-to-server only: the local
// job authenticates with the shared DIGEST_SECRET so the prod DB credentials
// never leave Vercel. Returns active (non-unsubscribed) subscriber emails.

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a || '', 'utf8');
  const bb = Buffer.from(b || '', 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.DIGEST_SECRET;
  if (!secret) return res.status(500).json({ error: 'Server misconfigured', missing: ['DIGEST_SECRET'] });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!timingSafeEqual(token, secret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured', missing: ['DATABASE_URL'] });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    // Table may not exist yet if no one has subscribed — treat as empty.
    const exists = await db`SELECT to_regclass('public.newsletter_subscribers') AS t`;
    if (!exists[0]?.t) return res.status(200).json({ count: 0, emails: [] });

    const rows = await db`
      SELECT email FROM newsletter_subscribers
      WHERE unsubscribed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 50000
    `;
    const emails = rows.map((r) => r.email);
    return res.status(200).json({ count: emails.length, emails });
  } catch (err) {
    req.log?.error?.('digest_recipients_failed', { err: err.message });
    return res.status(500).json({ error: 'Could not load recipients' });
  }
}

export default withSecurity(handler, { maxRequests: 30 });
