// Dev API server — mirrors Vercel serverless functions during local development
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    features: { projects: true, testRuns: true, reports: true, auth: true },
  });
});

// Auth login
app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  await new Promise(r => setTimeout(r, 300));
  res.json({
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
});

// Projects
app.get('/api/projects', (_req, res) => {
  res.json([{
    id: 'proj_001',
    name: 'express-ecommerce-api',
    repoUrl: 'https://github.com/example/express-ecommerce-api',
    localPath: '/projects/express-ecommerce-api',
    branch: 'main',
    techStack: ['Node.js', 'Express', 'MongoDB', 'JWT'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }]);
});

// Test Runs
app.get('/api/test-runs', (_req, res) => {
  res.json([{
    id: 'TF-2026-001',
    projectId: 'proj_001',
    branch: 'main',
    commitHash: 'a1b2c3d',
    status: 'completed',
    overallScore: 68,
    totalFindings: 16,
    criticalCount: 1,
    highCount: 2,
    mediumCount: 5,
    lowCount: 8,
    startedAt: '2026-05-20T10:00:00Z',
    completedAt: '2026-05-20T10:05:30Z',
    config: { depth: 'normal' },
  }]);
});

// Reports
app.get('/api/reports/:id', (_req, res) => {
  res.json({
    id: 'TF-2026-001',
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
    ],
    generatedAt: new Date().toISOString(),
  });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`[API Dev Server] Running on http://localhost:${PORT}`);
});
