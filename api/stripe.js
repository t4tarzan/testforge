// /api/stripe — pricing info (GET) and checkout session (POST).
// POST requires a session; the user can only initiate checkout for
// themselves. We pass userId + plan in session metadata so the webhook
// can update the right account regardless of email mismatches.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

// Price ids live in env vars so the same code works against test mode and
// live mode without edits. Fallbacks here only fire if Vinayak forgot to
// configure them — better than crashing, with a console warning.
// Enterprise is contact-sales only (no self-serve checkout), so no
// STRIPE_PRICE_ENTERPRISE lookup here.
function getPriceId(plan) {
  if (plan === 'team') {
    return process.env.STRIPE_PRICE_TEAM || null;
  }
  return process.env.STRIPE_PRICE_PRO || process.env.STRIPE_PRICE_ID || null;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      plans: [
        {
          id: 'free',
          name: 'Free — Self-Host',
          price: 0,
          oss: true,
          features: [
            'OSS, runs on your machine (npx)',
            'All 21 Tier-1 dimensions, unlimited',
            'Tier 2 — Generate & Run with your own OpenRouter key',
            'Code never leaves your machine',
            'Local SQLite history',
            'Community support (GitHub issues)',
          ],
        },
        {
          id: 'pro',
          name: 'Pro',
          price: 49,
          features: [
            'Managed — we host everything',
            '100 tests/month',
            '10 repositories',
            'Private repos supported',
            'Tier 2 — Generate & Run: 20 LLM iterations/mo (the AI taste)',
            'Qwen 3.7 Max + DeepSeek V4 Flash (we manage the keys)',
            'Cross-machine history dashboard',
            'CI/CD webhook + Slack/Discord notifications',
            'Priority email support',
          ],
        },
        {
          id: 'team',
          name: 'Team',
          price: 199,
          features: [
            'Everything in Pro, plus:',
            '500 tests/month',
            '50 repositories',
            'Tier 2 — Generate & Run: 200 LLM iterations/mo',
            'Iterative test → fix → re-test loop',
            'Multi-user / org accounts',
            'Shared history + audit trail',
            'Custom rules persistence',
            'Higher API rate limits',
            'Dedicated support',
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise',
          price: null,
          contactSales: true,
          features: [
            'Unlimited tests + Tier-2 iterations',
            'Unlimited repositories',
            'Custom AI model selection',
            'SSO/SAML',
            'On-prem / VPC deployment',
            'API access',
            'SLA guarantee',
            'Dedicated account manager',
            'Custom integrations',
          ],
        },
      ],
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const { plan } = req.body || {};
  // Enterprise is contact-sales only; reject any self-serve attempt with a
  // hint to mail sales rather than 400'ing silently.
  if (plan === 'enterprise') {
    return res.status(400).json({
      error: 'Enterprise is contact-sales only',
      contact: 'sales@testforge.run',
    });
  }
  if (plan !== 'pro' && plan !== 'team') {
    return res.status(400).json({ error: 'plan must be "pro" or "team"' });
  }
  const priceId = getPriceId(plan);
  if (!priceId) {
    console.error(`[stripe] no price id configured for plan=${plan}`);
    return res.status(500).json({ error: `No price configured for ${plan}` });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Derive return URLs from the request so previews and self-hosted
    // deploys don't all bounce users back to prod.
    const origin =
      req.headers.origin ||
      (req.headers.host ? `https://${req.headers.host}` : 'https://testforge.run');

    const checkout = await stripe.checkout.sessions.create({
      // Use the authenticated user's email — never trust the request body.
      customer_email: session.email || undefined,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/#/account?checkout=success`,
      cancel_url: `${origin}/#/pricing?checkout=canceled`,
      // Metadata reaches the webhook verbatim. userId lets us identify
      // the account even if their email doesn't match Stripe's records.
      metadata: { plan, userId: session.userId, source: 'testforge-web' },
      // Same metadata on the subscription so subscription.updated /
      // subscription.deleted events also carry it.
      subscription_data: {
        metadata: { plan, userId: session.userId, source: 'testforge-web' },
      },
    });

    return res.json({ ok: true, checkoutUrl: checkout.url });
  } catch (e) {
    console.error('[stripe] checkout failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

export default withSecurity(handler);
