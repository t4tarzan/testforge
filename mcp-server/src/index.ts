import Fastify from 'fastify';
import cors from '@fastify/cors';
import { setupMCPServer } from './mcp-server.js';

const PORT = Number(process.env.TESTFORGE_MCP_PORT) || 3001;

async function main() {
  const app = Fastify({ 
    logger: { level: process.env.LOG_LEVEL || 'info' }
  });

  // Enable CORS for IDE connections
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

  // Setup MCP protocol routes
  await setupMCPServer(app);

  // API routes for reports
  app.get('/api/reports/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const { format = 'json' } = request.query as { format?: string };
    
    try {
      // This would fetch from the database
      // For now, return the seed report structure
      return {
        id: runId,
        title: 'Test Report',
        overallScore: 68,
        criticalCount: 1,
        highCount: 2,
        mediumCount: 5,
        lowCount: 8,
        format,
        phases: [
          { name: 'Critical Security Fixes', priority: 'P0', items: [
            { id: 'SEC-001', title: 'Fix NoSQL Injection in /api/orders', severity: 'critical' },
            { id: 'SEC-002', title: 'Add JWT middleware to /admin/* routes', severity: 'critical' },
            { id: 'SEC-003', title: 'Sanitize search output to prevent XSS', severity: 'high' },
          ]},
          { name: 'Authentication & Data Protection', priority: 'P1', items: [
            { id: 'SEC-004', title: 'Add rate limiting to auth endpoints', severity: 'medium' },
            { id: 'SEC-005', title: 'Remove password field from user responses', severity: 'medium' },
            { id: 'SEC-006', title: 'Restrict CORS to whitelisted origins', severity: 'low' },
          ]},
        ]
      };
    } catch (err: any) {
      reply.status(404).send({ error: 'Report not found', message: err.message });
    }
  });

  app.get('/api/reports/latest', async () => {
    return {
      id: 'TF-2026-001',
      title: 'Security Hardening & Performance Scaling — express-ecommerce-api',
      overallScore: 68,
      criticalCount: 1,
      highCount: 2,
      mediumCount: 5,
      lowCount: 8,
    };
  });

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║   TestForge MCP Server                       ║
║   Running on http://localhost:${PORT}           ║
║                                              ║
║   Tools:                                     ║
║   • testforge_analyze                        ║
║   • testforge_test                           ║
║   • testforge_quick_scan                     ║
║   • testforge_report                         ║
║                                              ║
║   Health: http://localhost:${PORT}/health       ║
║                                              ║
╚══════════════════════════════════════════════╝
`);
  } catch (err) {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  }
}

main().catch(console.error);
