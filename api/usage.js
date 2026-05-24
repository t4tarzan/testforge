// API Usage Dashboard — track usage per user/org
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.DATABASE_URL) return res.json({ testsRun: 0, testsThisMonth: 0, remainingQuota: 100 });

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);

    const [totalRuns] = await db`SELECT COUNT(*) as count FROM test_runs`;
    const [thisMonth] = await db`SELECT COUNT(*) as count FROM test_runs WHERE completed_at > NOW() - INTERVAL '30 days'`;
    const [avgScore] = await db`SELECT ROUND(AVG(overall_score)) as avg FROM test_runs WHERE overall_score IS NOT NULL`;
    const [totalFindings] = await db`SELECT SUM(total_findings) as sum FROM test_runs`;

    return res.json({
      testsRun: Number(totalRuns?.count || 0),
      testsThisMonth: Number(thisMonth?.count || 0),
      remainingQuota: Math.max(0, 100 - Number(thisMonth?.count || 0)),
      averageScore: Number(avgScore?.avg || 0),
      totalFindingsFound: Number(totalFindings?.sum || 0),
      plan: 'free',
      limits: { testsPerMonth: 100, repositories: 5, teamMembers: 1 },
    });
  } catch (e) {
    return res.json({ error: e.message });
  }
}
