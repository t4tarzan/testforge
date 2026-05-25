import { withSecurity } from './_security.js';
// Stripe Webhook — auto-upgrade user plan on payment
// Set this as webhook endpoint in Stripe Dashboard:
// https://testforge.run/api/stripe-webhook
// Events: checkout.session.completed

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sig = req.headers['stripe-signature'];
  if (!process.env.STRIPE_WEBHOOK_SECRET || !sig) {
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const plan = session.metadata?.plan || 'pro';
      const email = session.customer_email;

      if (email && process.env.DATABASE_URL) {
        const { neon } = await import('@neondatabase/serverless');
        const db = neon(process.env.DATABASE_URL);
        await db`
          UPDATE users SET plan = ${plan}, stripe_customer_id = ${session.customer || ''}
          WHERE email = ${email}
        `;
        console.log(`Upgraded ${email} to ${plan}`);
      }
    }

    return res.json({ received: true });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}

export default withSecurity(handler, { skipRateLimit: true });
