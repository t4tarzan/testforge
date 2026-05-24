export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.json([{
    id: 'TF-2026-001', projectId: 'proj_001', branch: 'main',
    commitHash: 'a1b2c3d', status: 'completed', overallScore: 68,
    totalFindings: 16, criticalCount: 1, highCount: 2, mediumCount: 5, lowCount: 8,
    startedAt: '2026-05-20T10:00:00Z', completedAt: '2026-05-20T10:05:30Z',
    config: { depth: 'normal' },
  }]);
}
