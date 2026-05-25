// /api/gate — plan limits & usage. GET returns current usage + remaining;
// POST {action:'test_run'} attempts to consume one test from the quota.
//
// Usage is computed from real data rather than a denormalized counter:
//   testsThisMonth = COUNT(test_runs) where user_id = X AND started_at >= month_start
//   reposUsed      = COUNT(projects)  where user_id = X
// This avoids the "tests_this_month" reset-cron problem.
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

export const PLANS = {
  free:       { testsPerMonth: 5,        repos: 1,        rateLimit: 10,  name: 'Free' },
  pro:        { testsPerMonth: 100,      repos: 10,       rateLimit: 60,  name: 'Pro' },
  enterprise: { testsPerMonth: Infinity, repos: Infinity, rateLimit: 300, name: 'Enterprise' },
};

function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const userId = session.userId;
    const plan = session.plan || 'free';
    const limits = PLANS[plan] || PLANS.free;

    const monthStart = monthStartIso();
    const [{ count: testsUsed }] = await db`
      SELECT COUNT(*)::int AS count FROM test_runs
      WHERE user_id = ${userId} AND started_at >= ${monthStart}
    `;
    const [{ count: reposUsed }] = await db`
      SELECT COUNT(*)::int AS count FROM projects WHERE user_id = ${userId}
    `;

    const testsRemaining =
      limits.testsPerMonth === Infinity ? Infinity : limits.testsPerMonth - testsUsed;
    const reposRemaining =
      limits.repos === Infinity ? Infinity : limits.repos - reposUsed;

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (action === 'test_run') {
        if (limits.testsPerMonth !== Infinity && testsUsed >= limits.testsPerMonth) {
          return res.status(402).json({
            allowed: false,
            reason: `Monthly limit reached (${testsUsed}/${limits.testsPerMonth})`,
            upgradeUrl: '/#/pricing',
          });
        }
        // The actual increment happens when save-results.js writes the row;
        // this endpoint just authorizes the attempt.
        return res.json({
          allowed: true,
          testsUsed,
          testsRemaining: testsRemaining === Infinity ? null : Math.max(0, testsRemaining - 1),
        });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }

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
