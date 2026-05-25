import { withSecurity } from './_security.js';
// Stripe Checkout — create payment sessions
// Requires STRIPE_SECRET_KEY + STRIPE_PRICE_ID in Vercel env

async function handler(req, res) {
  // GET: return pricing info
  if (req.method === 'GET') {
    return res.json({
      plans: [
        { id: 'free', name: 'Free', price: 0, features: ['5 tests/month', 'Public repos', 'Basic reports', 'Community support'] },
        { id: 'pro', name: 'Pro', price: 29, features: ['100 tests/month', 'Private repos', 'Full 13-dimension reports', 'CI/CD webhook', 'Priority support'] },
        { id: 'enterprise', name: 'Enterprise', price: 199, features: ['Unlimited tests', 'SSO/SAML', 'Team management', 'SLA guarantee', 'Dedicated support', 'Custom integrations'] },
      ],
    });
  }

  // POST: create checkout session
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({
      ok: false,
      message: 'Stripe not configured. Add STRIPE_SECRET_KEY to enable payments.',
      checkoutUrl: null,
    });
  }

  try {
    const { plan, email } = req.body || {};
    const priceIds = {
      pro: process.env.STRIPE_PRICE_ID || 'price_1TaqhbSEIejCLOFDhq2TOg9b',
      enterprise: 'price_1TaqhbSEIejCLOFDIu8fIUtM',
    };

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      mode: 'subscription',
      line_items: [{ price: priceIds[plan] || priceIds.pro, quantity: 1 }],
      success_url: 'https://testforge.run/#/account?checkout=success',
      cancel_url: 'https://testforge.run/#/pricing?checkout=canceled',
      metadata: { plan, source: 'testforge-web' },
    });

    return res.json({ ok: true, checkoutUrl: session.url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export default withSecurity(handler);
