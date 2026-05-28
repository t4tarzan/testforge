import { withSecurity } from './_security.js';

// Newsletter signup — opt-in list for the "TestForge Findings" digest.
// Public + rate-limited. Stores the email in Neon (lazily creating the table
// so no separate migration deploy is needed). The periodic send job reads
// this table and broadcasts via Resend.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const source = String(req.body?.source || 'in-the-wild').slice(0, 60);

  if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured', missing: ['DATABASE_URL'] });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);

    await db`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL,
        source varchar(60) NOT NULL DEFAULT 'in-the-wild',
        created_at timestamptz NOT NULL DEFAULT now(),
        unsubscribed_at timestamptz
      )
    `;
    await db`
      CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
      ON newsletter_subscribers (email)
    `;

    // Idempotent: a repeat signup is a success, not an error. Re-subscribing a
    // previously-unsubscribed email clears the unsubscribe flag.
    await db`
      INSERT INTO newsletter_subscribers (email, source)
      VALUES (${email}, ${source})
      ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL
    `;

    return res.status(200).json({ ok: true });
  } catch (err) {
    req.log?.error?.('newsletter_signup_failed', { err: err.message });
    return res.status(500).json({ error: 'Could not save your signup. Please try again.' });
  }
}

export default withSecurity(handler, { publicCors: true, maxRequests: 10 });
