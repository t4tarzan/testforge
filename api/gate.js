// Plan limits & quota enforcement
export const PLANS = {
  free: { testsPerMonth: 5, repos: 1, rateLimit: 10, name: 'Free' },
  pro: { testsPerMonth: 100, repos: 10, rateLimit: 60, name: 'Pro' },
  enterprise: { testsPerMonth: Infinity, repos: Infinity, rateLimit: 300, name: 'Enterprise' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-User');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const githubUser = req.headers['x-github-user'] || 'anonymous';
  if (!process.env.DATABASE_URL) {
    return res.json({ plan: 'free', limits: PLANS.free, usage: { tests: 0, repos: 0 }, allowed: true });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);

    // Get or create user
    let user = null;
    if (githubUser !== 'anonymous') {
      const rows = await db`SELECT * FROM users WHERE login = ${githubUser} LIMIT 1`;
      user = rows[0];
    }

    const plan = user?.plan || 'free';
    const limits = PLANS[plan] || PLANS.free;
    const testsUsed = user?.tests_this_month || 0;
    const reposUsed = user?.repos_used || 0;

    // Check limits
    const testsRemaining = limits.testsPerMonth === Infinity ? Infinity : limits.testsPerMonth - testsUsed;
    const reposRemaining = limits.repos === Infinity ? Infinity : limits.repos - reposUsed;

    // POST: track a test usage
    if (req.method === 'POST' && user) {
      const { action } = req.body || {};
      if (action === 'test_run') {
        // Check if over limit
        if (testsUsed >= limits.testsPerMonth && limits.testsPerMonth !== Infinity) {
          return res.status(402).json({
            allowed: false,
            reason: `Monthly limit reached (${testsUsed}/${limits.testsPerMonth})`,
            upgradeUrl: '/#/pricing',
          });
        }
        await db`UPDATE users SET tests_this_month = tests_this_month + 1, tests_run = tests_run + 1 WHERE login = ${githubUser}`;
        return res.json({ allowed: true, testsUsed: testsUsed + 1, testsRemaining: testsRemaining - 1 });
      }
    }

    return res.json({
      plan,
      planName: limits.name,
      limits,
      usage: { testsUsed, reposUsed, testsRemaining, reposRemaining },
      allowed: testsRemaining > 0 || limits.testsPerMonth === Infinity,
      upgradeUrl: plan === 'free' ? '/#/pricing' : null,
    });
  } catch (e) {
    return res.json({ plan: 'free', limits: PLANS.free, usage: { tests: 0 }, allowed: true, error: e.message });
  }
}
