import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  // Mock auth — any email/password works
  return res.json({
    token: 'mock_jwt_token_testforge_2026',
    user: {
      id: 'usr_123',
      name: 'Alex Chen',
      email,
      avatar: 'AC',
      plan: 'standard',
      creditsUsed: 1247,
      creditsTotal: 2000,
      testsRun: 47,
      passRate: 82,
      repos: 5,
    },
  });
}
