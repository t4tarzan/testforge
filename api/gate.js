// /api/gate — plan limits & usage. GET returns current usage + remaining;
// POST {action:'test_run'} authorizes one test against the quota.
//
// Plan is read live from users.plan via _gate.js — the session JWT's plan
// field is only used as a fallback if the DB lookup fails.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';
import { PLANS, getQuota, denyIfOverTestQuota } from './_gate.js';

export { PLANS };

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const userId = session.userId;
    const sessionPlan = session.plan || 'free';

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (action === 'test_run') {
        const deny = await denyIfOverTestQuota(userId, sessionPlan);
        if (deny) return res.status(deny.status).json(deny.body);
        const { testsUsed, testsRemaining } = await getQuota(userId, sessionPlan);
        // The actual increment happens when save-results.js writes the row;
        // this endpoint just authorizes the attempt.
        return res.json({
          allowed: true,
          testsUsed,
          testsRemaining:
            testsRemaining === Infinity ? null : Math.max(0, testsRemaining - 1),
        });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

    const { plan, limits, testsUsed, reposUsed, testsRemaining, reposRemaining } =
      await getQuota(userId, sessionPlan);

    return res.json({
      plan,
      planName: limits.name,
      limits: {
        testsPerMonth: limits.testsPerMonth === Infinity ? null : limits.testsPerMonth,
        repos: limits.repos === Infinity ? null : limits.repos,
        rateLimit: limits.rateLimit,
      },
      usage: {
        testsUsed,
        reposUsed,
        testsRemaining: testsRemaining === Infinity ? null : testsRemaining,
        reposRemaining: reposRemaining === Infinity ? null : reposRemaining,
      },
      allowed: testsRemaining === Infinity || testsRemaining > 0,
      upgradeUrl: plan === 'free' ? '/#/pricing' : null,
    });
  } catch (e) {
    console.error('[gate] error:', e.message);
    return res.status(500).json({ error: 'Failed to compute usage' });
  }
}

export default withSecurity(handler);
