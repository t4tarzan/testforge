// Shared plan/quota logic. Read plan live from the DB so a freshly-upgraded
// user is on their new limits immediately — the JWT-embedded plan can be
// stale for up to 30 days after a webhook flips users.plan.

// Tier 2 ("Generate & Run" — LLM writes Vitest tests + sandbox executes them)
// is gated by a SEPARATE monthly quota. Free / Pro get 0 iterations and the
// /generate-and-run endpoint returns 402 with upgradeUrl. Premium gets a
// "taste" allotment as an upsell trigger toward Forge; Forge is the headline
// Tier-2 plan; Enterprise lifts the cap entirely.
export const PLANS = {
  free:       { testsPerMonth: 5,        tier2IterationsPerMonth: 0,        repos: 1,        rateLimit: 10,  name: 'Free' },
  pro:        { testsPerMonth: 100,      tier2IterationsPerMonth: 0,        repos: 10,       rateLimit: 60,  name: 'Pro' },
  premium:    { testsPerMonth: 250,      tier2IterationsPerMonth: 20,       repos: 25,       rateLimit: 90,  name: 'Premium' },
  forge:      { testsPerMonth: 500,      tier2IterationsPerMonth: 100,      repos: 50,       rateLimit: 120, name: 'Forge' },
  enterprise: { testsPerMonth: Infinity, tier2IterationsPerMonth: Infinity, repos: Infinity, rateLimit: 300, name: 'Enterprise' },
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
  // tier2_iterations table is created lazily on first managed-side use; an
  // absent table reads as zero iterations consumed.
  let tier2Used = 0;
  try {
    const [row] = await db`
      SELECT COUNT(*)::int AS count FROM tier2_iterations
      WHERE user_id = ${userId} AND created_at >= ${monthStart}
    `;
    tier2Used = row?.count ?? 0;
  } catch {
    tier2Used = 0;
  }
  const testsRemaining =
    limits.testsPerMonth === Infinity ? Infinity : limits.testsPerMonth - testsUsed;
  const reposRemaining =
    limits.repos === Infinity ? Infinity : limits.repos - reposUsed;
  const tier2Remaining =
    limits.tier2IterationsPerMonth === Infinity
      ? Infinity
      : Math.max(0, limits.tier2IterationsPerMonth - tier2Used);
  return {
    plan,
    limits,
    testsUsed,
    reposUsed,
    tier2Used,
    testsRemaining,
    reposRemaining,
    tier2Remaining,
  };
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

// Tier-2 gate. Free / Pro have a quota of 0, so any call is rejected. Forge
// has 100/month, Enterprise unlimited. Caller is responsible for inserting
// the row into `tier2_iterations` after a successful generation.
export async function denyIfOverTier2Quota(userId, sessionPlan) {
  const { plan, limits, tier2Used, tier2Remaining } = await getQuota(userId, sessionPlan);
  if (limits.tier2IterationsPerMonth === 0) {
    return {
      status: 402,
      body: {
        allowed: false,
        reason: 'Tier 2 (Generate & Run) requires the Forge plan or higher.',
        plan,
        upgradeUrl: '/#/pricing',
      },
    };
  }
  if (
    limits.tier2IterationsPerMonth !== Infinity &&
    tier2Used >= limits.tier2IterationsPerMonth
  ) {
    return {
      status: 402,
      body: {
        allowed: false,
        reason: `Monthly Tier 2 iteration limit reached (${tier2Used}/${limits.tier2IterationsPerMonth}).`,
        plan,
        tier2Remaining: tier2Remaining === Infinity ? null : tier2Remaining,
        upgradeUrl: '/#/pricing',
      },
    };
  }
  return null;
}

// Record one successful Tier-2 iteration for billing/quota. Idempotency is
// handled by the caller via a unique generationId. Lazy table create so
// existing deployments don't need a migration step before the first call.
export async function recordTier2Iteration(userId, generationId, meta = {}) {
  const db = await getDb();
  await db`
    CREATE TABLE IF NOT EXISTS tier2_iterations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      meta JSONB
    )
  `;
  await db`
    INSERT INTO tier2_iterations (id, user_id, meta)
    VALUES (${generationId}, ${userId}, ${JSON.stringify(meta)})
    ON CONFLICT (id) DO NOTHING
  `;
}
