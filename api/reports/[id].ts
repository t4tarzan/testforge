import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { id } = req.query;

  return res.json({
    id: (id as string) || 'TF-2026-001',
    title: 'Security Hardening & Performance Scaling — express-ecommerce-api',
    overallScore: 68,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 5,
    lowCount: 8,
    phases: [
      {
        name: 'Critical Security Fixes',
        priority: 'P0',
        effort: '2-3 days',
        items: [
          { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical', component: 'OrderController' },
          { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical', component: 'AuthMiddleware' },
          { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high', component: 'SearchService' },
        ],
      },
      {
        name: 'Authentication & Data Protection',
        priority: 'P1',
        effort: '3-4 days',
        items: [
          { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium', component: 'AuthController' },
          { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium', component: 'UserService' },
          { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low', component: 'ServerConfig' },
        ],
      },
      {
        name: 'Performance & Load Handling',
        priority: 'P1',
        effort: '3-5 days',
        items: [
          { id: 'PERF-001', title: 'Add connection pooling for MongoDB', severity: 'medium', component: 'Database' },
          { id: 'PERF-002', title: 'Implement response caching (Redis)', severity: 'medium', component: 'Middleware' },
          { id: 'PERF-003', title: 'Add compression middleware', severity: 'low', component: 'ServerConfig' },
        ],
      },
    ],
    generatedAt: new Date().toISOString(),
  });
}
