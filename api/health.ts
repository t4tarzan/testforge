import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.json({
    status: 'ok',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    features: { projects: true, testRuns: true, reports: true, auth: true },
  });
}
