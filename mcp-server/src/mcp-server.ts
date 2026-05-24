import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import chalk from 'chalk';
import { scanCodebase } from './analyzers/code-scanner.js';
import { runSecurityAnalysis } from './analyzers/security-analyzer.js';
import { runUnitAnalysis } from './analyzers/unit-analyzer.js';
import { runLoadAnalysis } from './analyzers/load-analyzer.js';
import { runAccessibilityAnalysis } from './analyzers/accessibility-analyzer.js';
import { runTestSuite, type ProgressUpdate } from './test-runner.js';
import { generateReport } from './report-generator.js';

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
  realDb = createClient();
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

  const report = await generateReport(testRunId, _db as any);

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

  /* -- Legacy REST endpoints for direct access ------------------------------ */
  app.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectPath } = request.body as { projectPath: string };
    const result = await handleAnalyze({ projectPath });
    return reply.send(result);
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
