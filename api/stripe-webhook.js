// Stripe webhook — auto-upgrade user plan on a successful subscription.
//
// Three things matter here:
//   1. We MUST verify the Stripe signature against the *raw* request body.
//      Vercel's default body parser would mutate the bytes (whitespace,
//      key ordering) and the signature would never validate. We turn the
//      body parser off and read the stream ourselves.
//   2. Stripe retries failed deliveries; the same event can land twice.
//      We insert the event id into a stripe_events table and short-circuit
//      on PK conflict, so a replay never double-upgrades anyone.
//   3. We identify the user by metadata.userId (set when we created the
//      checkout session) rather than by customer_email, because OAuth
//      users may have an email like `login@github` that doesn't match
//      the Stripe customer record.

import { withSecurity } from './_security.js';

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY is not set' });
  }
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL is not set' });
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  const rawBody = await readRawBody(req);

  let event;
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('[stripe-webhook] signature verification failed:', e.message);
    return res.status(400).json({ error: `Signature verification failed: ${e.message}` });
  }

  const { neon } = await import('@neondatabase/serverless');
  const db = neon(process.env.DATABASE_URL);

  // Idempotency: ON CONFLICT DO NOTHING returns 0 rows when the event id
  // already exists, telling us it was processed before.
  const inserted = await db`
    INSERT INTO stripe_events (id, type)
    VALUES (${event.id}, ${event.type})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;
  if (inserted.length === 0) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const obj = event.data.object;
      const plan = obj.metadata?.plan || 'pro';
      const userId = obj.metadata?.userId || null;
      const customerId = obj.customer || null;

      if (userId) {
        await db`
          UPDATE users
          SET plan = ${plan},
              stripe_customer_id = COALESCE(${customerId}, stripe_customer_id),
              updated_at = NOW()
          WHERE id = ${userId}
        `;
        console.log(`[stripe-webhook] ${event.type} → user ${userId} → plan ${plan}`);
      } else if (customerId) {
        // Older sessions without userId metadata — fall back to customer id.
        await db`
          UPDATE users
          SET plan = ${plan}, updated_at = NOW()
          WHERE stripe_customer_id = ${customerId}
        `;
        console.log(`[stripe-webhook] ${event.type} → customer ${customerId} → plan ${plan}`);
      } else {
        console.warn(`[stripe-webhook] ${event.type} with no userId or customer; skipped`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const obj = event.data.object;
      const customerId = obj.customer;
      if (customerId) {
        await db`
          UPDATE users SET plan = 'free', updated_at = NOW()
          WHERE stripe_customer_id = ${customerId}
        `;
      }
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    // We've already inserted the event id, so a retry would short-circuit
    // and we'd never fix it. Delete the row so Stripe's retry will run.
    await db`DELETE FROM stripe_events WHERE id = ${event.id}`;
    console.error('[stripe-webhook] handler error, undid idempotency row:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export default withSecurity(handler, { skipRateLimit: true });
