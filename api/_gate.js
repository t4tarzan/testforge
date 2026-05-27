// Shared plan/quota logic. Read plan live from the DB so a freshly-upgraded
// user is on their new limits immediately — the JWT-embedded plan can be
// stale for up to 30 days after a webhook flips users.plan.

export const PLANS = {
  free:       { testsPerMonth: 5,        repos: 1,        rateLimit: 10,  name: 'Free' },
  pro:        { testsPerMonth: 100,      repos: 10,       rateLimit: 60,  name: 'Pro' },
  enterprise: { testsPerMonth: Infinity, repos: Infinity, rateLimit: 300, name: 'Enterprise' },
};

export function monthStartIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function getDb() {
  const { neon } = await import('@neondatabase/serverless');
  return neon(process.env.DATABASE_URL);
}

export async function getPlanForUser(userId, fallbackPlan = 'free') {
  if (!process.env.DATABASE_URL) return fallbackPlan;
  try {
    const db = await getDb();
    const rows = await db`SELECT plan FROM users WHERE id = ${userId} LIMIT 1`;
    return rows[0]?.plan || fallbackPlan;
  } catch {
    // If the lookup fails we fall back to the JWT-embedded plan rather than
    // 500-ing the caller — gate.js / save-results.js will surface the real
    // error if the rest of the request can't proceed.
    return fallbackPlan;
  }
}

export async function getQuota(userId, sessionPlan) {
  const db = await getDb();
  const plan = await getPlanForUser(userId, sessionPlan);
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
  return { plan, limits, testsUsed, reposUsed, testsRemaining, reposRemaining };
}

// Returns null when allowed, or {status, body} to short-circuit the response.
export async function denyIfOverTestQuota(userId, sessionPlan) {
  const { limits, testsUsed } = await getQuota(userId, sessionPlan);
  if (limits.testsPerMonth !== Infinity && testsUsed >= limits.testsPerMonth) {
    return {
      status: 402,
      body: {
        allowed: false,
        reason: `Monthly limit reached (${testsUsed}/${limits.testsPerMonth})`,
        upgradeUrl: '/#/pricing',
      },
    };
  }
  return null;
}
