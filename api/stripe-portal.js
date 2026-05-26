// POST /api/stripe-portal — create a Stripe Customer Portal session for
// the signed-in user. Returns { url } that the client navigates to so
// the user can update payment method, cancel/downgrade, view invoices —
// the standard "manage your subscription" flow Stripe hosts for us.
//
// We look up the user's stripe_customer_id from the DB rather than trust
// the request body. If the user has never upgraded (no customer id yet)
// we return 409 with an `upgradeUrl` so the UI can show "subscribe first"
// instead of crashing.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const rows = await db`
      SELECT stripe_customer_id, plan FROM users WHERE id = ${session.userId} LIMIT 1
    `;
    const customerId = rows[0]?.stripe_customer_id;

    if (!customerId) {
      // Never paid → no Stripe customer record exists. Tell the client to
      // direct the user to upgrade instead of attempting a portal session.
      return res.status(409).json({
        error: 'No active subscription',
        plan: rows[0]?.plan || 'free',
        upgradeUrl: '/#/pricing',
      });
    }

    // Derive the return URL from the request so this works on previews
    // and self-hosted deploys, not just prod.
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://testforge.run');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/#/account?tab=billing`,
    });

    return res.json({ url: portal.url });
  } catch (e) {
    console.error('[stripe-portal] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export default withSecurity(handler);
