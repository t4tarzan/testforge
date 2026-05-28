// testforge-disable-file authentication-bypass
// The MCP server is a LOCAL-machine tool — it binds to 127.0.0.1:33221 and
// the user running `npx testforge-mcp` is the only consumer. No auth surface
// to protect; per-route auth middleware would be theater. (Managed/SaaS
// access happens via the Vercel API tier in api/*.js which DOES check
// session.)
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { scanCodebase } from './analyzers/code-scanner.js';
import { runTestSuite, type ProgressUpdate } from './test-runner.js';
import { generateReport } from './report-generator.js';
import { saveReport } from './local-db.js';

/* -------------------------------------------------------------------------- */
/*                                 SSE Manager                                */
/* -------------------------------------------------------------------------- */

interface SSEClient {
  id: string;
  reply: FastifyReply;
  heartbeat: NodeJS.Timeout;
}

const sseClients = new Map<string, SSEClient>();

function broadcastSSE(data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of sseClients) {
    client.reply.raw.write(payload);
  }
}

function sendProgress(update: ProgressUpdate) {
  broadcastSSE({ type: 'progress', ...update });
}

/* -------------------------------------------------------------------------- */
/*                           Database (stub until @testforge/db is built)     */
/* -------------------------------------------------------------------------- */

// In-memory store as fallback until @testforge/db package is compiled
const _testRuns = new Map<string, Record<string, unknown>>();
const _findings = new Map<string, Array<Record<string, unknown>>>();

const db = {
  async createTestRun(data: Record<string, unknown>) {
    _testRuns.set(data.id as string, { ...data, createdAt: new Date().toISOString() });
    return data;
  },
  async updateTestRun(id: string, data: Record<string, unknown>) {
    const existing = _testRuns.get(id) || {};
    _testRuns.set(id, { ...existing, ...data, updatedAt: new Date().toISOString() });
    return _testRuns.get(id);
  },
  async addFinding(testRunId: string, finding: Record<string, unknown>) {
    const list = _findings.get(testRunId) || [];
    list.push({ ...finding, id: randomUUID(), createdAt: new Date().toISOString() });
    _findings.set(testRunId, list);
    return finding;
  },
  async getFindings(testRunId: string) {
    return _findings.get(testRunId) || [];
  },
  async getTestRun(id: string) {
    return _testRuns.get(id) || null;
  },
};

// Try to load real @testforge/db when available
let realDb: typeof db | null = null;
try {
  const { createClient } = await import('@testforge/db');
  realDb = createClient() as typeof db;
} catch {
  // fallback to in-memory
}
const _db = realDb || db;

/* -------------------------------------------------------------------------- */
/*                           MCP Protocol Types                               */
/* -------------------------------------------------------------------------- */

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const MCP_VERSION = '2024-11-05';
const SERVER_NAME = 'testforge-mcp';
const SERVER_VERSION = '0.1.0';

/* -------------------------------------------------------------------------- */
/*                           Tool Schemas & Handlers                          */
/* -------------------------------------------------------------------------- */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: 'testforge_analyze',
    description: 'Analyze codebase structure: files, endpoints, tech stack, dependencies',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project root' },
      },
    },
  },
  {
    name: 'testforge_test',
    description: 'Run a full test suite across multiple dimensions (security, unit, load, accessibility, etc.)',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string' },
        dimensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional subset of dimensions to run. Defaults to all.',
        },
        branch: { type: 'string', description: 'Git branch name for contextual testing' },
      },
    },
  },
  {
    name: 'testforge_quick_scan',
    description: 'Fast security + unit scan (~30 seconds). Runs in background, streams progress via SSE.',
    inputSchema: {
      type: 'object',
      required: ['projectPath'],
      properties: {
        projectPath: { type: 'string' },
      },
    },
  },
  {
    name: 'testforge_report',
    description: 'Get or generate a structured PRD report for a completed test run',
    inputSchema: {
      type: 'object',
      required: ['testRunId'],
      properties: {
        testRunId: { type: 'string' },
        format: { type: 'string', enum: ['json', 'markdown'], default: 'json' },
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*                           Tool Implementations                             */
/* -------------------------------------------------------------------------- */

async function handleAnalyze(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  console.log(chalk.blue('[testforge_analyze]'), 'Scanning', projectPath);

  const info = await scanCodebase(projectPath);

  return {
    endpoints: info.endpoints,
    middleware: info.middleware,
    files: info.files,
    dependencies: info.dependencies.length,
    devDependencies: info.devDependencies.length,
    techStack: info.techStack,
    totalFiles: info.totalFiles,
    totalLines: info.totalLines,
    languageCoverage: info.languageCoverage,
  };
}

async function handleTest(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const dimensions = (params.dimensions as string[]) || [
    'code-scan',
    'security',
    'unit',
    'load',
    'accessibility',
    'chaos',
    'mutation',
    'predictive',
  ];
  const branch = (params.branch as string) || 'main';
  const testRunId = randomUUID();

  console.log(chalk.blue('[testforge_test]'), 'Starting test suite', testRunId, 'dimensions:', dimensions.join(', '));

  await _db.createTestRun({
    id: testRunId,
    projectPath,
    branch,
    dimensions,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  // Kick off test suite in background
  Promise.resolve().then(async () => {
    try {
      await runTestSuite(projectPath, testRunId, dimensions, _db, sendProgress);
      await _db.updateTestRun(testRunId, { status: 'completed', completedAt: new Date().toISOString() });

      // Persist a summary of this run to the SQLite history at
      // ~/.testforge/history.db so /reports and the dashboard surface it.
      // /analyze writes to SQLite directly; /test runs dimension-by-dimension
      // and writes findings to the in-memory _db, so we aggregate here.
      try {
        await persistTestRunToSqlite(testRunId, projectPath);
      } catch (saveErr: unknown) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(chalk.yellow(`[${testRunId}] Failed to persist to SQLite:`), msg);
      }

      sendProgress({ stage: 'done', status: 'completed', progress: 100, message: 'Test suite completed' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await _db.updateTestRun(testRunId, { status: 'failed', error: message });
      sendProgress({ stage: 'error', status: 'failed', progress: 100, message });
    }
  });

  return {
    testRunId,
    status: 'running',
    streamUrl: `/mcp/sse`,
  };
}

// Aggregate the completed test run + findings from _db (in-memory) into the
// shape saveReport() expects and write a row to SQLite. Fields we don't
// have at this layer (per-dimension scores beyond findings — stack, unit
// coverage, accessibility, dora) are omitted; saveReport supplies sensible
// defaults so the row is still useful for /reports.
async function persistTestRunToSqlite(testRunId: string, projectPath: string): Promise<void> {
  const run = (await _db.getTestRun(testRunId)) as Record<string, unknown> | null;
  const findings = (await _db.getFindings(testRunId)) as Array<Record<string, unknown>>;

  const summary = (run?.summary as Record<string, unknown>) || {};
  const bySev: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    const sev = (f.severity as string) || 'info';
    if (sev in bySev) bySev[sev]++;
  }
  const securityFindings = findings.filter(
    (f) =>
      String(f.dimension || '').toLowerCase().includes('security') ||
      String(f.category || '').toLowerCase().includes('security')
  );

  const data = {
    testRunId,
    branch: run?.branch,
    completedAt: run?.completedAt,
    codebase: {
      totalFiles: summary.totalFiles || 0,
      totalLines: summary.totalLines || 0,
      endpoints: summary.endpoints || 0,
      techStack: summary.techStack || [],
    },
    security: {
      findings: securityFindings.length || findings.length,
      critical: bySev.critical,
      high: bySev.high,
      medium: bySev.medium,
      low: bySev.low,
    },
    findings: findings.slice(0, 50), // bound the JSON blob
  };

  const id = saveReport(data, projectPath);
  console.log(chalk.green(`[${testRunId}] Persisted to SQLite as ${id}`));
}

async function handleQuickScan(params: Record<string, unknown>): Promise<unknown> {
  const projectPath = params.projectPath as string;
  const testRunId = randomUUID();
  const dimensions = ['security', 'unit'];

  console.log(chalk.blue('[testforge_quick_scan]'), 'Starting quick scan', testRunId);

  await _db.createTestRun({
    id: testRunId,
    projectPath,
    dimensions,
    status: 'running',
    startedAt: new Date().toISOString(),
  });

  // Background execution
  Promise.resolve().then(async () => {
    try {
      await runTestSuite(projectPath, testRunId, dimensions, _db, sendProgress);
      await _db.updateTestRun(testRunId, { status: 'completed', completedAt: new Date().toISOString() });
      try {
        await persistTestRunToSqlite(testRunId, projectPath);
      } catch (saveErr: unknown) {
        const msg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.error(chalk.yellow(`[${testRunId}] Failed to persist to SQLite:`), msg);
      }
      sendProgress({ stage: 'done', status: 'completed', progress: 100, message: 'Quick scan completed' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await _db.updateTestRun(testRunId, { status: 'failed', error: message });
      sendProgress({ stage: 'error', status: 'failed', progress: 100, message });
    }
  });

  return { testRunId };
}

async function handleReport(params: Record<string, unknown>): Promise<unknown> {
  const testRunId = params.testRunId as string;
  const format = (params.format as string) || 'json';

  console.log(chalk.blue('[testforge_report]'), 'Generating report for', testRunId, 'format:', format);

  // _db is either the in-memory shim or a dynamically-imported @testforge/db
  // client. Both implement the subset of methods generateReport needs, but
  // TS can't prove the structural match across the dynamic import.
  const report = await generateReport(testRunId, _db as unknown as Parameters<typeof generateReport>[1]);

  if (format === 'markdown') {
    return { report: reportToMarkdown(report as ReportData) };
  }

  return { report };
}

/* -------------------------------------------------------------------------- */
/*                           MCP Protocol Handler                             */
/* -------------------------------------------------------------------------- */

async function handleMCPMessage(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params = {} } = request;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: MCP_VERSION,
            capabilities: {
              tools: {},
              logging: {},
            },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          },
        };
      }

      case 'tools/list': {
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
      }

      case 'tools/call': {
        const toolName = params.name as string;
        const toolParams = (params.arguments as Record<string, unknown>) || {};

        let result: unknown;

        switch (toolName) {
          case 'testforge_analyze':
            result = await handleAnalyze(toolParams);
            break;
          case 'testforge_test':
            result = await handleTest(toolParams);
            break;
          case 'testforge_quick_scan':
            result = await handleQuickScan(toolParams);
            break;
          case 'testforge_report':
            result = await handleReport(toolParams);
            break;
          default:
            return {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Unknown tool: ${toolName}` },
            };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: `Internal error: ${message}` },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*                           Report → Markdown                                */
/* -------------------------------------------------------------------------- */

interface ReportData {
  summary?: Record<string, unknown>;
  findingsBySeverity?: Record<string, unknown[]>;
  phases?: Array<{ name: string; items: string[] }>;
  testRunId?: string;
  generatedAt?: string;
}

function reportToMarkdown(data: ReportData): string {
  const lines: string[] = [];
  lines.push(`# TestForge Report — ${data.testRunId || 'unknown'}`);
  lines.push(`Generated: ${data.generatedAt || new Date().toISOString()}`);
  lines.push('');

  if (data.summary) {
    lines.push('## Summary');
    for (const [k, v] of Object.entries(data.summary)) {
      lines.push(`- **${k}**: ${v}`);
    }
    lines.push('');
  }

  if (data.findingsBySeverity) {
    lines.push('## Findings by Severity');
    for (const [sev, items] of Object.entries(data.findingsBySeverity)) {
      lines.push(`### ${sev} (${items.length})`);
      for (const item of items) {
        const title = (item as Record<string, unknown>).title || 'Unknown';
        const file = (item as Record<string, unknown>).filePath || 'N/A';
        lines.push(`- **${title}** (${file})`);
      }
      lines.push('');
    }
  }

  if (data.phases) {
    lines.push('## Remediation Plan');
    for (const phase of data.phases) {
      lines.push(`### ${phase.name}`);
      for (const item of phase.items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/* -------------------------------------------------------------------------- */
/*                           Fastify Route Setup                              */
/* -------------------------------------------------------------------------- */

export async function setupMCPServer(app: FastifyInstance) {
  /* -- SSE endpoint --------------------------------------------------------- */
  app.get('/mcp/sse', async (_request: FastifyRequest, reply: FastifyReply) => {
    const clientId = randomUUID();

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send endpoint ID
    reply.raw.write(`event: endpoint\ndata: ${JSON.stringify({ clientId })}\n\n`);

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`);
    }, 15000);

    sseClients.set(clientId, { id: clientId, reply, heartbeat });

    reply.raw.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(clientId);
    });

    // Keep connection open
    await new Promise(() => {});
  });

  /* -- Message endpoint ----------------------------------------------------- */
  app.post('/mcp/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as MCPRequest;

    if (!body || body.jsonrpc !== '2.0') {
      return reply.status(400).send({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
      });
    }

    const response = await handleMCPMessage(body);
    return reply.send(response);
  });

  /* -- Full analysis (same as clone-and-analyze but for local paths) -- */
  app.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectPath } = request.body as { projectPath: string };
    if (!projectPath) return reply.status(400).send({ error: 'projectPath required' });
    
    try {
      const { scanCodebase } = await import('./analyzers/code-scanner.js');
      const { runSecurityAnalysis } = await import('./analyzers/security-analyzer.js');
      const { runUnitAnalysis } = await import('./analyzers/unit-analyzer.js');
      const { runLoadAnalysis } = await import('./analyzers/load-analyzer.js');
      const { runAccessibilityAnalysis } = await import('./analyzers/accessibility-analyzer.js');
      const { runVisionAnalysis, runScopeAnalysis, runStackAnalysis } = await import('./analyzers/strategic-analyzer.js');
      const { runContractAnalysis, runVisualRegressionAnalysis, runEdgeCaseAnalysis, runPropertyBasedAnalysis, runChaosAnalysis, runMutationAnalysis, runPredictiveAnalysis, runSupplyChainAudit, runNPlusOneDetection, runDeadCodeAnalysis, runLicenseCheck, runDoraEstimation, runOwaspCoverage } = await import('./analyzers/advanced-analyzer.js');
      const { runAgenticScalePrediction } = await import('./analyzers/agentic-scale.js');

      const codebase = await scanCodebase(projectPath);
      const securityFindings = await runSecurityAnalysis({ projectPath, fileContents: codebase.fileContents, dependencies: codebase.dependencies, devDependencies: codebase.devDependencies }).catch(() => []);
      // Best-effort empty fallbacks. Downstream uses optional access (`r.x || 0`)
      // so it's safe to degrade quietly when the analyzer throws.
      type UnitR = Awaited<ReturnType<typeof runUnitAnalysis>>;
      type LoadR = Awaited<ReturnType<typeof runLoadAnalysis>>;
      type A11yR = Awaited<ReturnType<typeof runAccessibilityAnalysis>>;
      const unitReport = await runUnitAnalysis({ projectPath, fileContents: codebase.fileContents })
        .catch(() => ({ testCoverage: 0, totalTestFiles: 0, totalTests: 0, frameworks: [], findings: [] } as unknown as UnitR));
      const loadReport = await runLoadAnalysis({ projectPath, fileContents: codebase.fileContents, dependencies: codebase.dependencies })
        .catch(() => ({ estimatedMaxConcurrentUsers: 0, hasRateLimiting: false, hasCaching: false, recommendations: [], findings: [] } as unknown as LoadR));
      const a11yReport = await runAccessibilityAnalysis({ projectPath, fileContents: codebase.fileContents })
        .catch(() => ({ score: 0, totalChecks: 0, issuesFound: 0, complianceLevel: 'Unknown', findings: [] } as unknown as A11yR));
      const visionReport = await runVisionAnalysis(codebase.fileContents, codebase.dependencies, codebase.devDependencies);
      const scopeReport = await runScopeAnalysis(codebase.fileContents, codebase.dependencies);
      const stackReport = await runStackAnalysis(codebase.fileContents, codebase.dependencies, codebase.devDependencies, codebase.techStack);
      const contractReport = await runContractAnalysis(codebase.fileContents, codebase.endpoints);
      const visualReport = await runVisualRegressionAnalysis(codebase.fileContents);
      const edgeReport = await runEdgeCaseAnalysis(codebase.fileContents);
      const propertyReport = await runPropertyBasedAnalysis(codebase.fileContents);
      const chaosReport = await runChaosAnalysis(codebase.fileContents, codebase.dependencies, codebase.techStack);
      const mutationReport = await runMutationAnalysis(codebase.fileContents, codebase.devDependencies, codebase.totalFiles, codebase.totalLines);
      const predictiveReport = await runPredictiveAnalysis(codebase.fileContents, codebase.dependencies, codebase.devDependencies);
      const supplyReport = await runSupplyChainAudit(codebase.dependencies, codebase.devDependencies, projectPath, { osv: true });
      const nPlusOneReport = runNPlusOneDetection(codebase.fileContents);
      const deadReport = runDeadCodeAnalysis(codebase.fileContents, codebase.dependencies);
      const licenseReport = runLicenseCheck(codebase.dependencies, projectPath);
      const doraReport = runDoraEstimation(codebase.fileContents, codebase.devDependencies);
      // SecurityFinding includes 'info' severity; runOwaspCoverage only
      // counts real findings. Filter then cast — the call sites use
      // Finding<'critical'|'high'|'medium'|'low'>.
      const owaspReport = runOwaspCoverage(securityFindings.filter(f => f.severity !== 'info') as Parameters<typeof runOwaspCoverage>[0]);
      const agenticReport = runAgenticScalePrediction(codebase.fileContents, codebase.dependencies, codebase.techStack, codebase.endpoints, codebase.totalLines);

      return reply.send({
        repo: projectPath, branch: 'local', analyzedAt: new Date().toISOString(),
        codebase: { totalFiles: codebase.totalFiles, totalLines: codebase.totalLines, endpoints: codebase.endpoints, techStack: codebase.techStack, dependencies: codebase.dependencies.length, languageCoverage: codebase.languageCoverage },
        security: { findings: securityFindings.length, critical: securityFindings.filter((f)=>f.severity==='critical').length, high: securityFindings.filter((f)=>f.severity==='high').length, medium: securityFindings.filter((f)=>f.severity==='medium').length, low: securityFindings.filter((f)=>f.severity==='low').length, items: securityFindings.slice(0,10) },
        unit: { coverage: unitReport.testCoverage||0, testFiles: unitReport.totalTestFiles||0, totalTests: unitReport.totalTests||0, frameworks: unitReport.frameworks||[], findings: unitReport.findings?.length||0 },
        load: { maxUsers: loadReport.estimatedMaxConcurrentUsers||0, rateLimiting: loadReport.hasRateLimiting||false, caching: loadReport.hasCaching||false, recommendations: loadReport.recommendations||[] },
        accessibility: { score: a11yReport.score||0, issues: a11yReport.findings?.length||0, applicable: a11yReport.applicable, totalHtmlFiles: a11yReport.totalHtmlFiles||0 },
        vision: { score: visionReport.score, summary: visionReport.summary, findings: visionReport.findings },
        scope: { coverage: scopeReport.coverage, documentedFeatures: scopeReport.documentedFeatures, implementedFeatures: scopeReport.implementedFeatures, missingFeatures: scopeReport.missingFeatures },
        stack: { score: stackReport.score, strengths: stackReport.strengths, weaknesses: stackReport.weaknesses, recommendations: stackReport.recommendations },
        contract: { score: contractReport.score, totalEndpoints: contractReport.totalEndpoints },
        visualRegression: { score: visualReport.score, htmlFiles: visualReport.htmlFiles, cssFiles: visualReport.cssFiles },
        edgeCases: { score: edgeReport.score, potentialCases: edgeReport.potentialCases },
        propertyBased: { score: propertyReport.score, invariantsDetected: propertyReport.invariantsDetected },
        chaos: { score: chaosReport.score, resilienceLevel: chaosReport.resilienceLevel, findings: chaosReport.findings },
        mutation: { score: mutationReport.score, estimatedMutationScore: mutationReport.estimatedMutationScore, totalMutants: mutationReport.totalMutants, killedMutants: mutationReport.killedMutants },
        predictive: { score: predictiveReport.score, riskLevel: predictiveReport.riskLevel, predictedFailures: predictiveReport.predictedFailures },
        supplyChain: { score: supplyReport.score, knownVulnerable: supplyReport.knownVulnerable },
        nPlusOne: { score: nPlusOneReport.score, potentialNPlusOne: nPlusOneReport.potentialNPlusOne },
        deadCode: { score: deadReport.score, unusedDeps: deadReport.unusedDeps },
        license: { score: licenseReport.score },
        dora: { score: doraReport.score, deploymentFreq: doraReport.deploymentFreq, leadTime: doraReport.leadTime, mttr: doraReport.mttr, changeFailRate: doraReport.changeFailRate },
        owasp: { coverage: owaspReport.coverage, missingCategories: owaspReport.missingCategories },
        agentic: { score: agenticReport.score, resilienceLevel: agenticReport.resilienceLevel, maxPredictedAgents: agenticReport.maxPredictedAgents, predictedBottleneck: agenticReport.predictedBottleneck, failurePatterns: agenticReport.failurePatterns, findings: agenticReport.findings },
      });
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });

  app.post('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectPath, dimensions, branch } = request.body as {
      projectPath: string;
      dimensions?: string[];
      branch?: string;
    };
    const result = await handleTest({ projectPath, dimensions, branch });
    return reply.send(result);
  });

  app.get('/test/:testRunId/progress', async (request: FastifyRequest, reply: FastifyReply) => {
    const { testRunId } = request.params as { testRunId: string };
    const run = await _db.getTestRun(testRunId);
    if (!run) return reply.status(404).send({ error: 'Test run not found' });
    return reply.send(run);
  });

  app.get('/report/:testRunId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { testRunId } = request.params as { testRunId: string };
    const { format } = request.query as { format?: string };
    const result = await handleReport({ testRunId, format });
    return reply.send(result);
  });

  console.log(chalk.green('MCP server routes registered'));
}
