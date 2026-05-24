import Fastify from 'fastify';
import cors from '@fastify/cors';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { setupMCPServer } from './mcp-server.js';
import { scanCodebase } from './analyzers/code-scanner.js';
import { runSecurityAnalysis } from './analyzers/security-analyzer.js';
import { runUnitAnalysis } from './analyzers/unit-analyzer.js';
import { runLoadAnalysis } from './analyzers/load-analyzer.js';
import { runAccessibilityAnalysis } from './analyzers/accessibility-analyzer.js';

const PORT = Number(process.env.TESTFORGE_MCP_PORT) || 3001;
const TMP_DIR = process.env.TMP_DIR || '/tmp/testforge-repos';

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
  app.get('/health', async () => ({ status: 'ok', version: '0.2.0' }));

  // ── Clone & Analyze (accepts git URLs) ─────────────────────────────────
  app.post('/clone-and-analyze', async (request, reply) => {
    const { repoUrl, branch = 'main' } = request.body as { repoUrl: string; branch?: string };
    if (!repoUrl) return reply.status(400).send({ error: 'repoUrl required' });

    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
    const projectPath = join(TMP_DIR, repoName + '-' + Date.now());

    try {
      // Clone repo
      mkdirSync(TMP_DIR, { recursive: true });
      console.log(`Cloning ${repoUrl} into ${projectPath}...`);
      execSync(`git clone --depth 1 --branch ${branch} ${repoUrl} ${projectPath}`, {
        timeout: 30000,
        stdio: 'pipe',
      });

      // Scan codebase
      const codebase = await scanCodebase(projectPath);

      // Run all analyzers
      const securityFindings = await runSecurityAnalysis({
        projectPath,
        fileContents: codebase.fileContents,
        dependencies: codebase.dependencies,
        devDependencies: codebase.devDependencies,
      }).catch(() => []);

      const unitReport = await runUnitAnalysis({
        projectPath,
        fileContents: codebase.fileContents,
      }).catch(() => ({ testCoverage: 0, totalTestFiles: 0, totalTests: 0, untestedFunctions: [], frameworks: [], findings: [] }));

      const loadReport = await runLoadAnalysis({
        projectPath,
        fileContents: codebase.fileContents,
        dependencies: codebase.dependencies,
      }).catch(() => ({ estimatedMaxConcurrentUsers: 0, hasRateLimiting: false, hasCaching: false, hasConnectionPooling: false, findings: [], recommendations: [] }));

      const a11yReport = await runAccessibilityAnalysis({
        projectPath,
        fileContents: codebase.fileContents,
      }).catch(() => ({ score: 0, findings: [], imagesWithoutAlt: 0, formsWithoutLabels: 0 }));

      // Clean up
      rmSync(projectPath, { recursive: true, force: true });

      return reply.send({
        repo: repoUrl,
        branch,
        analyzedAt: new Date().toISOString(),
        codebase: {
          totalFiles: codebase.totalFiles,
          totalLines: codebase.totalLines,
          endpoints: codebase.endpoints,
          techStack: codebase.techStack,
          dependencies: codebase.dependencies.length,
        },
        security: {
          findings: securityFindings.length,
          critical: securityFindings.filter((f: any) => f.severity === 'critical').length,
          high: securityFindings.filter((f: any) => f.severity === 'high').length,
          medium: securityFindings.filter((f: any) => f.severity === 'medium').length,
          low: securityFindings.filter((f: any) => f.severity === 'low').length,
          items: securityFindings.slice(0, 10),
        },
        unit: {
          coverage: unitReport.testCoverage || 0,
          testFiles: unitReport.totalTestFiles || 0,
          totalTests: unitReport.totalTests || 0,
          frameworks: unitReport.frameworks || [],
          findings: unitReport.findings?.length || 0,
        },
        load: {
          maxUsers: loadReport.estimatedMaxConcurrentUsers || 0,
          rateLimiting: loadReport.hasRateLimiting || false,
          caching: loadReport.hasCaching || false,
          recommendations: loadReport.recommendations || [],
        },
        accessibility: {
          score: a11yReport.score || 0,
          issues: a11yReport.findings?.length || 0,
          imagesWithoutAlt: a11yReport.imagesWithoutAlt || 0,
          formsWithoutLabels: a11yReport.formsWithoutLabels || 0,
        },
      });
    } catch (err: any) {
      // Clean up on error
      try { if (existsSync(projectPath)) rmSync(projectPath, { recursive: true, force: true }); } catch {}
      return reply.status(500).send({ error: err.message, repo: repoUrl });
    }
  });

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
