// /api/usage — analytics for the signed-in user. Returns 0s if they have
// no data yet (the UI shows an empty state, not seed numbers).
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

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

    const [totalRuns] = await db`
      SELECT COUNT(*)::int AS count
      FROM test_runs WHERE user_id = ${userId}
    `;
    const [thisMonth] = await db`
      SELECT COUNT(*)::int AS count
      FROM test_runs
      WHERE user_id = ${userId}
        AND completed_at > NOW() - INTERVAL '30 days'
    `;
    const [avgScore] = await db`
      SELECT ROUND(AVG(overall_score))::int AS avg
      FROM test_runs
      WHERE user_id = ${userId} AND overall_score IS NOT NULL
    `;
    const [totalFindings] = await db`
      SELECT COALESCE(SUM(total_findings), 0)::int AS sum
      FROM test_runs WHERE user_id = ${userId}
    `;

    return res.json({
      testsRun: totalRuns.count,
      testsThisMonth: thisMonth.count,
      averageScore: avgScore.avg ?? 0,
      totalFindingsFound: totalFindings.sum,
      plan: session.plan || 'free',
    });
  } catch (e) {
    console.error('[usage] DB error:', e.message);
    return res.status(500).json({ error: 'Failed to compute usage' });
  }
}

export default withSecurity(handler);
