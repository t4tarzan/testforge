import crypto from 'crypto';
import { withSecurity } from './_security.js';

// One-click unsubscribe target for the digest. The link carries the email and
// an HMAC token (signed with UNSUB_SECRET) so it can't be forged. Returns a
// small HTML page either way. Also accepts POST for the RFC 8058
// List-Unsubscribe-Post one-click flow.

function expectedToken(email) {
  return crypto.createHmac('sha256', process.env.UNSUB_SECRET || '').update(email).digest('hex');
}

function safeEqual(a, b) {
  const ab = Buffer.from(a || '', 'utf8');
  const bb = Buffer.from(b || '', 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function page(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — TestForge</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F7F7FB;color:#12101A;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#fff;border:1px solid #D9D9D3;border-radius:16px;padding:40px;max-width:420px;text-align:center}
h1{font-size:20px;margin:0 0 8px;color:#574a7d}p{color:#6B6B6B;line-height:1.6;font-size:15px}
a{color:#574a7d}</style></head>
<body><div class="card">${body}</div></body></html>`;
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.UNSUB_SECRET || !process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const email = String(req.query?.e || req.body?.e || '').trim().toLowerCase();
  const token = String(req.query?.t || req.body?.t || '');

  const html = (code, body) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(code).send(page(code === 200 ? 'Unsubscribed' : 'Invalid link', body));
  };

  if (!email || !token || !safeEqual(token, expectedToken(email))) {
    return html(400, '<h1>Invalid unsubscribe link</h1><p>This link is malformed or expired. Email <a href="mailto:vinayak@whitenoiseacademy.com">vinayak@whitenoiseacademy.com</a> and we’ll remove you.</p>');
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    await db`
      UPDATE newsletter_subscribers SET unsubscribed_at = now()
      WHERE email = ${email} AND unsubscribed_at IS NULL
    `;
    return html(200, '<h1>You’re unsubscribed</h1><p>You won’t get the TestForge Findings digest anymore. Changed your mind? Re-subscribe anytime at <a href="https://testforge.run/in-the-wild">testforge.run</a>.</p>');
  } catch (err) {
    req.log?.error?.('unsubscribe_failed', { err: err.message });
    return html(500, '<h1>Something went wrong</h1><p>We couldn’t process that just now. Please try again.</p>');
  }
}

export default withSecurity(handler, { publicCors: true, maxRequests: 30 });
