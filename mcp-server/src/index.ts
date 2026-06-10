// testforge-disable-file authentication-bypass
// MCP server bootstrap. Same rationale as mcp-server.ts: this server is a
// LOCAL-machine tool (binds to localhost, single user, no auth surface).
// The managed Vercel side gates these endpoints separately in api/*.js.

// MUST be the first import: loads ~/.testforge/.env (written by
// `testforge-mcp setup`) into process.env before any other module reads it.
// Real env / Docker `-e` always wins over the file.
import './boot-env.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { setupMCPServer } from './mcp-server.js';
import { scanCodebase } from './analyzers/code-scanner.js';
import { runSecurityAnalysis } from './analyzers/security-analyzer.js';
import { runUnitAnalysis } from './analyzers/unit-analyzer.js';
import { runLoadAnalysis } from './analyzers/load-analyzer.js';
import { runAccessibilityAnalysis } from './analyzers/accessibility-analyzer.js';
import { getReports, getReport, saveReport, saveGeneration, getGenerations, getGeneration } from './local-db.js';
import {
  runVisionAnalysis,
  runScopeAnalysis,
  runStackAnalysis,
} from './analyzers/strategic-analyzer.js';
import {
  runContractAnalysis,
  runVisualRegressionAnalysis,
  runEdgeCaseAnalysis,
  runPropertyBasedAnalysis,
  runChaosAnalysis,
  runMutationAnalysis,
  runPredictiveAnalysis,
  runSupplyChainAudit,
  runNPlusOneDetection,
  runDeadCodeAnalysis,
  runLicenseCheck,
  runDoraEstimation,
  runOwaspCoverage,
} from './analyzers/advanced-analyzer.js';
import { runAgenticScalePrediction } from './analyzers/agentic-scale.js';
import { runKubernetesAnalysis } from './analyzers/k8s-analyzer.js';
import { generateTestsForFindings, type InputFinding, type LlmOverride } from './generator/generate-tests.js';
import { filterTestableFindings } from './generator/finding-filter.js';
import { hasLLMKey, PRIMARY_MODEL, FALLBACK_MODEL, LLM_BASE_URL, LLM_IS_LOCAL } from './generator/llm-client.js';
import { isFromEnvFile, readEnvFile, writeEnvFile } from './load-env.js';
import { reloadLLM } from './generator/llm-client.js';
import { runGeneratedTests, dockerAvailable } from './runner/docker-runner.js';
import { detectRunnable } from './simulation/runnable-detect.js';
import { prepareSandbox, teardownSandbox } from './simulation/sandbox.js';
import { prepareComposeSandbox } from './simulation/compose-sandbox.js';
import { runLoadRamp, type LoadSimResult } from './simulation/load-sim.js';
import { runChaos, type FaultType } from './simulation/chaos-sim.js';
import { runAgentLoad } from './simulation/agent-sim.js';
import { runWiredUnit, type WiredFindingInput } from './simulation/wired-unit.js';
import { runE2ECrawl } from './simulation/e2e-crawl.js';
import { runE2EJourneys } from './simulation/e2e-journey.js';
import { ensureBaseRef, computeChangedSurface, prioritizeByChanged, changedPaths } from './analyzers/changed-surface.js';
import { createJob, getJob, listJobs, updateJob } from './simulation/job-store.js';
import { discoverEndpoints } from './analyzers/lib/endpoint-discovery.js';
import { parseFile, isParseable } from './analyzers/lib/parse.js';
import { readFileSync } from 'fs';

// Single source of truth for the version string — read from package.json at
// startup so /health never drifts from what npm shows on the package page.
const PKG_VERSION: string = (() => {
  try {
    const pkgPath = join(import.meta.dirname, '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

// 33221 is the default. It's high enough to avoid common dev-server clashes
// (3001/3000/5173/8080) and conflicts on developer machines that run a lot
// of services. Override with TESTFORGE_MCP_PORT=… if needed.
const PORT = Number(process.env.TESTFORGE_MCP_PORT) || 33221;
// Bind host. Defaults to 0.0.0.0 (managed/docker deploys need the wildcard so
// the container is reachable). The native hub sets TESTFORGE_MCP_HOST=127.0.0.1
// so the MCP listens loopback-only and coexists with the Tailscale Serve proxy
// that already fronts the tailnet on the same port (serve → http://127.0.0.1:9990);
// a wildcard bind would collide with tailscaled's tailnet-IP listener (EADDRINUSE).
const HOST = process.env.TESTFORGE_MCP_HOST || '0.0.0.0';

// Git-clone timeout. Default 120s (was a hard 30s, which timed out on large
// monorepos like supabase — ~1.3 GB even at depth 1). Override for very large
// repos or slow links with TESTFORGE_CLONE_TIMEOUT_MS.
const CLONE_TIMEOUT_MS = Number(process.env.TESTFORGE_CLONE_TIMEOUT_MS) || 120000;

function isLoopbackRequest(request: import('fastify').FastifyRequest): boolean {
  const ip = request.ip || request.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.startsWith('127.');
}

/**
 * Whether a Tier-2 request (generate-and-run / simulate) passes the run-secret
 * gate.
 *  - No secret set → open (classic localhost self-host).
 *  - Secret came from ~/.testforge/.env (the local `setup` wizard) AND the
 *    request is from loopback → EXEMPT. This is the user's own machine and the
 *    built-in dashboard sends no bearer, so gating it just locks them out of
 *    their own Tier-2. A MANAGED deployment's secret comes from real Docker env
 *    (never file-sourced), so it is never exempt and stays gated.
 *  - Otherwise require a matching Bearer token.
 */
function runSecretOk(request: import('fastify').FastifyRequest): boolean {
  const runSecret = process.env.TESTFORGE_RUN_SECRET;
  if (!runSecret) return true;
  if (isFromEnvFile('TESTFORGE_RUN_SECRET') && isLoopbackRequest(request)) return true;
  const auth = (request.headers['authorization'] as string | undefined) || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === runSecret;
}
const TMP_DIR = process.env.TMP_DIR || '/tmp/testforge-repos';

// Pick GET endpoints worth driving load against. We can only hit *literal*
// paths (autocannon can't fill `:id` / `*` params), so parameterized routes are
// skipped. '/' is always included as the baseline target and listed first.
function discoverGetPaths(fileContents: Record<string, string>): string[] {
  const paths = new Set<string>(['/']);
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;
    for (const ep of discoverEndpoints(filePath, parsed.ast)) {
      if (ep.method !== 'get') continue;
      if (/[:*]/.test(ep.path)) continue; // can't synthesize path params
      paths.add(ep.path);
    }
  }
  // '/' first, then a few discovered routes — keep the ramp bounded.
  return ['/', ...[...paths].filter((p) => p !== '/')].slice(0, 4);
}

type SimDimension = 'load' | 'chaos' | 'agent' | 'wired' | 'e2e';

interface SimJobBody {
  repoUrl: string;
  branch?: string;
  /** Which simulations to run. Default ['load']; chaos is opt-in (it's slower). */
  dimensions?: SimDimension[];
  paths?: string[];
  concurrencyLevels?: number[];
  durationPerLevelSec?: number;
  /** Chaos fault to inject (default 'restart' = crash-recovery). */
  faultType?: FaultType;
  /** Agent-pattern: fleet sizes to ramp + per-agent request rate (think-time = 1/rate). */
  agentLevels?: number[];
  reqsPerAgent?: number;
  /** E2E crawl: max same-origin pages to visit (default 8, capped at 25). */
  maxPages?: number;
  /** E2E Phase 2: number of LLM-authored user journeys to run (0 = smoke only). */
  journeys?: number;
  /** Change-driven QA: diff base ref. Biases wired findings + journeys toward what changed. */
  baseRef?: string;
}

// Pick a chaos load level the app can actually sustain: the highest concurrency
// the load ramp ran without breaking. Without load results, fall back to a low
// default so the baseline isn't already saturated.
function pickChaosConcurrency(load: LoadSimResult | null): number {
  if (!load) return 10;
  const healthy = load.levels.filter((l) => l.errorRate <= 0.05).map((l) => l.concurrency);
  return healthy.length ? Math.max(...healthy) : 5;
}

// Background runner for an async simulation job. Clones → scans → detects →
// builds+boots the app ONCE (shared sandbox) → runs the requested dimensions
// (load ramp, chaos) → tears down. Updates the job's phase throughout so the
// client's GET /simulate/:jobId poll shows live progress. Detached from the POST
// request, so a multi-minute sim never hits the nginx 300s ceiling. When the app
// can't be auto-booted, every requested dimension gets an honest static fallback.
async function runSimJob(jobId: string, runId: string, body: SimJobBody): Promise<void> {
  const { repoUrl } = body;
  const dims: SimDimension[] = body.dimensions?.length ? body.dimensions : ['load'];
  const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
  const projectPath = join(TMP_DIR, `sim-${repoName}-${runId}`);
  updateJob(jobId, { status: 'running', phase: 'cloning', detail: 'Cloning repository', startedAt: new Date().toISOString() });

  try {
    mkdirSync(TMP_DIR, { recursive: true });
    const branchFlag = body.branch ? `--branch ${body.branch} ` : '';
    execSync(`git clone --depth 1 ${branchFlag}${repoUrl} ${projectPath}`, {
      timeout: CLONE_TIMEOUT_MS, stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });

    // Change-driven QA (opt-in via baseRef): fetch the base tip into this
    // --depth 1 clone and diff, so the wired + journey lanes can target what
    // changed. Degrades to null (full, unbiased run). See slices 1–2 +
    // docs/ANTIREZ-168-GAP-ANALYSIS.md.
    const resolvedBase = body.baseRef ? ensureBaseRef(projectPath, body.baseRef) : null;
    const changedSurface = resolvedBase ? computeChangedSurface(projectPath, resolvedBase) : null;

    updateJob(jobId, { phase: 'detecting', detail: 'Scanning codebase and detecting how to boot it' });
    const codebase = await scanCodebase(projectPath);
    const runnable = detectRunnable(projectPath);

    // Static fallbacks — always computed; used whenever a dimension can't drive
    // real traffic (not runnable, or the app failed to boot).
    const staticLoad = await runLoadAnalysis({
      projectPath, fileContents: codebase.fileContents, dependencies: codebase.dependencies,
    }).catch(() => null);
    const staticLoadBlock = staticLoad ? {
      maxUsers: staticLoad.estimatedMaxConcurrentUsers || 0,
      rateLimiting: staticLoad.hasRateLimiting || false,
      caching: staticLoad.hasCaching || false,
      recommendations: staticLoad.recommendations || [],
      findings: staticLoad.findings || [],
    } : null;
    const staticChaos = await Promise.resolve(
      runChaosAnalysis(codebase.fileContents, codebase.dependencies, codebase.techStack),
    ).catch(() => null);
    const staticChaosBlock = staticChaos ? {
      score: staticChaos.score, resilienceLevel: staticChaos.resilienceLevel, findings: staticChaos.findings,
    } : null;

    const out: { load?: Record<string, unknown>; chaos?: Record<string, unknown>; agent?: Record<string, unknown>; wired?: Record<string, unknown>; e2e?: Record<string, unknown> } = {};

    // Wired-unit (Approach C) needs concrete code findings to target. Only run
    // the (relatively cheap) security pass when the dimension is requested.
    let wiredFindings: WiredFindingInput[] = [];
    if (dims.includes('wired')) {
      const sec = await runSecurityAnalysis({
        projectPath, fileContents: codebase.fileContents,
        dependencies: codebase.dependencies, devDependencies: codebase.devDependencies,
      }).catch(() => [] as Awaited<ReturnType<typeof runSecurityAnalysis>>);
      wiredFindings = (Array.isArray(sec) ? sec : []).map((f) => ({
        title: f.title, description: f.description, filePath: f.filePath, lineNumber: f.lineNumber,
        fixSuggestion: f.fixSuggestion, severity: f.severity, codeContext: f.codeContext,
      }));
      // Change-driven: test the findings on changed lines first (the lane caps
      // how many it generates, so ordering decides what gets covered).
      if (changedSurface) wiredFindings = prioritizeByChanged(changedSurface, wiredFindings);
    }

    const canBoot = !!(runnable.runnable && runnable.contextPath && (
      (runnable.method === 'dockerfile' && runnable.dockerfilePath) ||
      (runnable.method === 'compose' && runnable.composePath)
    ));
    if (canBoot) {
      updateJob(jobId, { phase: 'building', detail: runnable.method === 'compose' ? 'Booting compose stack' : 'Building app image from Dockerfile' });
      const prep = runnable.method === 'compose'
        ? await prepareComposeSandbox({
            composePath: runnable.composePath!,
            contextPath: runnable.contextPath!,
            runId,
            onProgress: (phase, detail) => updateJob(jobId, { phase, detail }),
          })
        : await prepareSandbox({
            contextPath: runnable.contextPath!,
            dockerfilePath: runnable.dockerfilePath!,
            exposedPorts: runnable.exposedPorts,
            runId,
            onProgress: (phase, detail) => updateJob(jobId, { phase, detail }),
          });

      if (!prep.ok || !prep.sandbox) {
        // Booted nothing → honest static fallback for each requested dimension.
        const fail = { ranReal: false, reason: prep.reason, buildLogTail: prep.buildLogTail, appLogTail: prep.appLogTail };
        if (dims.includes('load')) out.load = { ...fail, static: staticLoadBlock };
        if (dims.includes('chaos')) out.chaos = { ...fail, static: staticChaosBlock };
        if (dims.includes('agent')) out.agent = { ...fail };
        if (dims.includes('wired')) out.wired = { ...fail, method: 'node-test-in-app-image', results: [] };
        if (dims.includes('e2e')) out.e2e = { ...fail, method: 'playwright-crawl' };
      } else {
        const sb = prep.sandbox;
        const paths = body.paths?.length ? body.paths : discoverGetPaths(codebase.fileContents);
        let loadResult: LoadSimResult | null = null;
        try {
          if (dims.includes('load')) {
            updateJob(jobId, { phase: 'load', detail: 'Starting load ramp' });
            loadResult = await runLoadRamp(sb, {
              paths,
              concurrencyLevels: body.concurrencyLevels,
              durationPerLevelSec: body.durationPerLevelSec,
              onProgress: (detail) => updateJob(jobId, { phase: 'load', detail }),
            });
            out.load = { ...loadResult };
          }
          if (dims.includes('agent')) {
            updateJob(jobId, { phase: 'agent', detail: 'Starting agent-pattern load' });
            const agentRes = await runAgentLoad(sb, {
              paths,
              agentLevels: body.agentLevels,
              reqsPerAgent: body.reqsPerAgent,
              durationPerLevelSec: body.durationPerLevelSec,
              onProgress: (detail) => updateJob(jobId, { phase: 'agent', detail }),
            });
            out.agent = { ...agentRes };
          }
          if (dims.includes('chaos')) {
            updateJob(jobId, { phase: 'chaos', detail: 'Starting chaos' });
            const chaos = await runChaos(sb, {
              paths,
              concurrency: pickChaosConcurrency(loadResult),
              faultType: body.faultType,
              onProgress: (detail) => updateJob(jobId, { phase: 'chaos', detail }),
            });
            out.chaos = { ...chaos };
          }
          if (dims.includes('wired')) {
            updateJob(jobId, { phase: 'wired', detail: 'Running tests against the real code in the app image' });
            if (sb.kind !== 'single' || !sb.image) {
              out.wired = { ranReal: false, method: 'node-test-in-app-image', results: [], reason: 'wired-unit v1 supports single-container (Dockerfile) apps; this is a compose stack.' };
            } else {
              out.wired = { ...(await runWiredUnit({
                image: sb.image, projectPath, findings: wiredFindings,
                onProgress: (detail) => updateJob(jobId, { phase: 'wired', detail }),
              })) };
            }
          }
          if (dims.includes('e2e')) {
            updateJob(jobId, { phase: 'e2e', detail: 'Crawling the booted app (Playwright)' });
            out.e2e = { ...(await runE2ECrawl(sb, {
              maxPages: body.maxPages,
              onProgress: (detail) => updateJob(jobId, { phase: 'e2e', detail }),
            })) };
            // Phase 2: LLM-authored user journeys (opt-in via journeys: N).
            if (body.journeys && body.journeys > 0) {
              const j = await runE2EJourneys(sb, {
                count: body.journeys,
                changedHint: changedSurface ? changedPaths(changedSurface) : undefined,
                onProgress: (detail) => updateJob(jobId, { phase: 'e2e', detail }),
              });
              out.e2e.journeys = j;
            }
          }
        } finally {
          await teardownSandbox(sb);
        }
      }
    } else {
      const fail = { ranReal: false, reason: runnable.reason };
      if (dims.includes('load')) out.load = { ...fail, static: staticLoadBlock };
      if (dims.includes('chaos')) out.chaos = { ...fail, static: staticChaosBlock };
      if (dims.includes('agent')) out.agent = { ...fail };
      if (dims.includes('wired')) out.wired = { ...fail, method: 'node-test-in-app-image', results: [] };
      if (dims.includes('e2e')) out.e2e = { ...fail, method: 'playwright-crawl' };
    }

    try { rmSync(projectPath, { recursive: true, force: true }); } catch { /* best-effort */ }

    // Persisted baselines (tenet #7): diff this run's metrics against the
    // previous run for the same repo+branch+dimensions, then store this run as
    // the new baseline. Best-effort — never fail a sim over telemetry.
    let baselineDelta = null;
    try {
      const { extractSimMetrics, computeBaselineDelta, baselineKey } = await import('./simulation/baselines.js');
      const { getLatestSimBaseline, saveSimBaseline } = await import('./local-db.js');
      const metrics = extractSimMetrics(out as Record<string, unknown>);
      if (Object.keys(metrics).length > 0) {
        const key = baselineKey(repoUrl, body.branch, dims);
        const prev = getLatestSimBaseline(key);
        if (prev) {
          const d = computeBaselineDelta(prev.metrics as Parameters<typeof computeBaselineDelta>[0], metrics);
          baselineDelta = { comparedTo: prev.created_at, comparedBaseRef: prev.base_ref, ...d };
        }
        saveSimBaseline({ id: `sb_${runId}`, key, repo: repoUrl, branch: body.branch, baseRef: body.baseRef, dimensions: dims, metrics });
      }
    } catch (e) {
      console.error('baseline delta/persist failed (non-fatal):', (e as Error).message);
    }

    // Coherence / differential (tenet #6): fingerprint per-surface behavior
    // (page status/errors + journey pass/fail), diff vs the previous run for
    // output divergence, then persist this run. Best-effort.
    let coherenceDelta = null;
    try {
      const { extractCoherenceSnapshot, diffCoherence } = await import('./simulation/coherence.js');
      const { baselineKey } = await import('./simulation/baselines.js');
      const { getLatestCoherenceSnapshot, saveCoherenceSnapshot } = await import('./local-db.js');
      const snapshot = extractCoherenceSnapshot(out as Record<string, unknown>);
      if (snapshot.pages || snapshot.journeys) {
        const key = baselineKey(repoUrl, body.branch, dims);
        const prev = getLatestCoherenceSnapshot(key);
        if (prev) {
          coherenceDelta = diffCoherence(prev.snapshot as Parameters<typeof diffCoherence>[0], snapshot);
        }
        saveCoherenceSnapshot({ id: `cs_${runId}`, key, repo: repoUrl, branch: body.branch, baseRef: body.baseRef, snapshot });
      }
    } catch (e) {
      console.error('coherence diff/persist failed (non-fatal):', (e as Error).message);
    }

    updateJob(jobId, {
      status: 'done', phase: 'done', detail: 'Simulation complete', finishedAt: new Date().toISOString(),
      result: {
        repo: repoUrl,
        branch: body.branch,
        runId,
        dimensions: dims,
        simulatedAt: new Date().toISOString(),
        runnable: {
          runnable: runnable.runnable,
          method: runnable.method,
          reason: runnable.reason,
          exposedPorts: runnable.exposedPorts,
        },
        changedSurface: body.baseRef
          ? (changedSurface
              ? { baseRef: body.baseRef, available: true, comparison: changedSurface.comparison, changedFiles: changedSurface.changedFileCount, files: changedPaths(changedSurface) }
              : { baseRef: body.baseRef, available: false, reason: 'could not fetch/diff the base ref — unknown ref, auth, or network' })
          : undefined,
        baselineDelta,
        coherenceDelta,
        ...out,
      },
    });
  } catch (err) {
    try { if (existsSync(projectPath)) rmSync(projectPath, { recursive: true, force: true }); } catch { /* best-effort */ }
    updateJob(jobId, { status: 'error', phase: 'error', error: (err as Error).message, finishedAt: new Date().toISOString() });
  }
}

async function main() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' }
  });

  // Enable CORS for IDE connections
  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // Serve static dashboard from public/
  await app.register(fastifyStatic, {
    root: join(import.meta.dirname, '..', 'public'),
    prefix: '/',
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', version: PKG_VERSION }));

  // Readiness of the two Tier-2 prerequisites — used by the dashboard to warn
  // BEFORE the user clicks "Generate Tests", and by the settings panel.
  app.get('/status', async () => {
    const docker = await dockerAvailable();
    return {
      version: PKG_VERSION,
      ai: {
        configured: hasLLMKey(),
        provider: LLM_IS_LOCAL ? 'local' : 'openrouter',
        base: LLM_BASE_URL,
        local: LLM_IS_LOCAL,
        primaryModel: PRIMARY_MODEL,
      },
      docker: { ok: docker.ok, reason: docker.reason, help: docker.help },
    };
  });

  // ── Local settings API (powers the dashboard settings panel) ──
  // Writes ~/.testforge/.env and applies the AI provider live (reloadLLM). Only
  // available to a LOCAL self-host: loopback requests, and never when a MANAGED
  // deployment is detected (its run secret comes from real Docker env, not the
  // config file) — you must not be able to rewrite a managed server's AI key.
  const configApiAllowed = (request: import('fastify').FastifyRequest): boolean => {
    if (!isLoopbackRequest(request)) return false;
    if (process.env.TESTFORGE_RUN_SECRET && !isFromEnvFile('TESTFORGE_RUN_SECRET')) return false;
    return true;
  };
  const maskKey = (k?: string): string | null => (k ? (k.length > 8 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••') : null);

  app.get('/config', async (request, reply) => {
    if (!configApiAllowed(request)) return reply.status(403).send({ error: 'Settings API is local-only' });
    const file = readEnvFile();
    const orKey = process.env.OPENROUTER_API_KEY;
    const llmKey = process.env.TESTFORGE_LLM_API_KEY;
    return {
      provider: LLM_IS_LOCAL ? 'local' : 'openrouter',
      openrouter: { keySet: Boolean(orKey), keyMasked: maskKey(orKey) },
      local: { baseUrl: process.env.TESTFORGE_LLM_BASE_URL || '', model: process.env.TESTFORGE_PRIMARY_MODEL || '', keySet: Boolean(llmKey) },
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      port: process.env.TESTFORGE_MCP_PORT || String(PORT),
      configFileKeys: Object.keys(file),
    };
  });

  app.post('/config', async (request, reply) => {
    if (!configApiAllowed(request)) return reply.status(403).send({ error: 'Settings API is local-only' });
    const b = (request.body ?? {}) as {
      provider?: 'openrouter' | 'local';
      openrouterKey?: string;
      ollamaBaseUrl?: string;
      model?: string;
      fallbackModel?: string;
      apiKey?: string;
    };
    const updates: Record<string, string | null> = {};
    if (b.provider === 'local') {
      const base = (b.ollamaBaseUrl || '').trim();
      if (!base) return reply.status(400).send({ error: 'ollamaBaseUrl required for a local provider' });
      updates.TESTFORGE_LLM_BASE_URL = base;
      updates.TESTFORGE_PRIMARY_MODEL = (b.model || '').trim() || 'qwen2.5-coder:14b';
      updates.TESTFORGE_FALLBACK_MODEL = (b.fallbackModel || b.model || '').trim() || updates.TESTFORGE_PRIMARY_MODEL;
      updates.TESTFORGE_LLM_API_KEY = (b.apiKey || '').trim() || null;
      updates.OPENROUTER_API_KEY = null; // switch away from cloud
    } else if (b.provider === 'openrouter') {
      // Only overwrite the key if a non-empty one was supplied (lets the user
      // tweak models without re-entering the key).
      if (typeof b.openrouterKey === 'string' && b.openrouterKey.trim()) updates.OPENROUTER_API_KEY = b.openrouterKey.trim();
      updates.TESTFORGE_LLM_BASE_URL = null; // back to OpenRouter default
      updates.TESTFORGE_LLM_API_KEY = null;
      if (b.model?.trim()) updates.TESTFORGE_PRIMARY_MODEL = b.model.trim();
      if (b.fallbackModel?.trim()) updates.TESTFORGE_FALLBACK_MODEL = b.fallbackModel.trim();
    } else {
      return reply.status(400).send({ error: "provider must be 'openrouter' or 'local'" });
    }
    try {
      writeEnvFile(updates);
      reloadLLM(); // apply immediately — no restart needed
    } catch (err) {
      return reply.status(500).send({ error: 'Could not save config', detail: (err as Error).message });
    }
    return { ok: true, provider: LLM_IS_LOCAL ? 'local' : 'openrouter', configured: hasLLMKey(), primaryModel: PRIMARY_MODEL };
  });

  // ── Tier 2 — Generate & Run (Day 1: generate only, no sandbox yet) ──
  //
  // Given findings produced by /clone-and-analyze (we pass them inline for
  // now — Day 2 will look them up by reportId), call the LLM to synthesize
  // one Vitest file per finding. Provider rotation: DeepSeek primary,
  // Kimi fallback, both via OpenRouter.
  app.post('/generate-and-run', async (request, reply) => {
    // Managed Tier-2 runs untrusted code in a docker sandbox — gate it behind a
    // shared secret so only our own caller (the Vercel proxy / frontend) can
    // trigger it. Self-host sets no secret → open on the user's own localhost.
    if (!runSecretOk(request)) return reply.status(401).send({ error: 'Unauthorized' });
    const body = request.body as {
      findings?: InputFinding[];
      maxFindings?: number;
      cluster?: string;
    } | undefined;

    // Managed BYOK: the Vercel proxy forwards a user's own OpenRouter key per
    // request (X-LLM-Key) so the hosted Tier-2 uses the USER's key/billing, not
    // ours. Only honored for requests that pass the run-secret gate above (i.e.
    // the trusted proxy) — a random caller can't inject a key. The key is used
    // transiently for this one generation; it is never stored by the MCP.
    const byokKey = (request.headers['x-llm-key'] as string | undefined)?.trim();
    const llmOverride: LlmOverride | undefined = byokKey
      ? {
          apiKey: byokKey,
          baseURL: (request.headers['x-llm-base-url'] as string | undefined)?.trim() || undefined,
          primaryModel: (request.headers['x-llm-model'] as string | undefined)?.trim() || undefined,
          fallbackModel: (request.headers['x-llm-fallback-model'] as string | undefined)?.trim() || undefined,
        }
      : undefined;

    // A BYOK key satisfies the "configured" check even if the server has no key.
    if (!llmOverride && !hasLLMKey()) {
      return reply.status(503).send({
        error: 'No AI provider configured for Tier-2 test generation',
        hint: 'Run `npx @whitenoisenpm/testforge-mcp setup` to configure an AI provider — an OPENROUTER_API_KEY (cloud) or TESTFORGE_LLM_BASE_URL pointing at a local model server (Ollama/LM Studio).',
      });
    }

    const findings = body?.findings ?? [];
    if (!Array.isArray(findings) || findings.length === 0) {
      return reply.status(400).send({
        error: 'findings: Finding[] required in request body',
        hint: 'POST {findings: [{rule, title, description, filePath, lineNumber, fixSuggestion, severity}]}',
      });
    }

    // Dimension filter: only generate tests for concrete code findings. Advisory
    // findings (load/accessibility/chaos/mutation/predictive) have no testable
    // contract and produce synthetic — sometimes deliberately-failing — tests.
    const { kept: testableFindings, dropped: droppedFindings } = filterTestableFindings(findings);
    if (testableFindings.length === 0) {
      return reply.status(422).send({
        error: 'No testable findings for Tier-2 generation',
        hint: 'All findings were advisory (load/accessibility/chaos/mutation/predictive), which have no testable contract. Tier-2 generates tests only for concrete code findings (security/unit). Pass at least one concrete finding.',
        dropped: droppedFindings,
      });
    }

    const cluster = body?.cluster ?? 'edge-case';
    const max = Math.min(body?.maxFindings ?? 3, 5);
    const skipRun = (body as { skipRun?: boolean } | undefined)?.skipRun === true;

    const t0 = Date.now();
    let results: Awaited<ReturnType<typeof generateTestsForFindings>>;
    try {
      results = await generateTestsForFindings(testableFindings, max, llmOverride);
    } catch (err) {
      // Never let one malformed finding 500 the whole request — return a clean,
      // actionable error instead.
      return reply.status(422).send({
        error: 'Test generation failed',
        detail: (err as Error).message,
        hint: 'This usually means a finding was missing expected fields. Please report it with the finding payload.',
      });
    }
    const generationMs = Date.now() - t0;

    // Day 2 — collect the files that the LLM successfully produced and ship
    // them into the sandbox runner. If skipRun is set, return generation
    // results only (useful when the caller wants to inspect the source
    // before paying the runner roundtrip).
    const generatedFiles = results
      .map((r) => r.file)
      .filter((f): f is NonNullable<typeof f> => f !== null);

    let run: Awaited<ReturnType<typeof runGeneratedTests>> | null = null;
    if (!skipRun && generatedFiles.length > 0) {
      try {
        run = await runGeneratedTests(generatedFiles);
      } catch (err) {
        run = {
          runId: 'run_failed',
          success: false,
          numTotalTests: 0,
          numPassedTests: 0,
          numFailedTests: 0,
          durationMs: 0,
          files: [],
          containerError: (err as Error).message,
        };
      }
    }

    const generationId = 'gen_' + Date.now().toString(36);
    const responsePayload = {
      generationId,
      cluster,
      provider: {
        primary: llmOverride?.primaryModel || PRIMARY_MODEL,
        fallback: llmOverride?.fallbackModel || FALLBACK_MODEL,
        base: llmOverride?.baseURL || LLM_BASE_URL,
        local: llmOverride ? false : LLM_IS_LOCAL,
        byok: Boolean(llmOverride),
      },
      generatedAt: new Date().toISOString(),
      durationMs: generationMs + (run?.durationMs ?? 0),
      generationMs,
      runMs: run?.durationMs ?? 0,
      requested: findings.length,
      testable: testableFindings.length,
      dropped: droppedFindings,
      processed: results.length,
      results: results.map((r) => ({
        finding: {
          rule: r.finding.rule,
          title: r.finding.title,
          filePath: r.finding.filePath,
          lineNumber: r.finding.lineNumber,
        },
        file: r.file,
        attempts: r.attempts,
      })),
      run,
    };

    // Persist to ~/.testforge/history.db. Best-effort — a DB failure shouldn't
    // fail the request (the caller already has the full result in-memory).
    try {
      saveGeneration({
        id: generationId,
        cluster,
        providerPrimary: PRIMARY_MODEL,
        providerFallback: FALLBACK_MODEL,
        requestedFindings: findings.length,
        processed: results.length,
        generationMs,
        runMs: run?.durationMs ?? 0,
        success: run?.success ?? false,
        numTotalTests: run?.numTotalTests ?? 0,
        numPassedTests: run?.numPassedTests ?? 0,
        numFailedTests: run?.numFailedTests ?? 0,
        fullData: responsePayload,
      });
    } catch (err) {
      app.log.warn({ err: (err as Error).message }, 'saveGeneration failed');
    }

    return reply.send(responsePayload);
  });

  // List Tier-2 generations (most-recent first).
  app.get('/api/generations', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return reply.send(getGenerations(n));
  });

  // Fetch one Tier-2 generation (with the full result payload).
  app.get('/api/generations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = getGeneration(id);
    if (!row) return reply.status(404).send({ error: 'generation not found', id });
    return reply.send(row);
  });

  // ── Simulate — REAL load/stress simulation (Phase 1: Dockerfile repos) ──
  //
  // ASYNC by design: a real sim boots the app and drives a multi-level load
  // ramp over minutes, which would blow past nginx's ~300s proxy_read_timeout
  // in one request. So POST kicks off a background job and returns a jobId
  // instantly; the client polls GET /simulate/:jobId for phased progress and
  // the final result. Same secret-gate as Tier-2 (it builds + runs UNTRUSTED
  // repo code). When the app can be auto-booted (Dockerfile) the result carries
  // REAL metrics (ranReal:true); otherwise it falls back to static load
  // analysis with an honest "couldn't auto-run" reason.
  const checkRunSecret = runSecretOk;

  app.post('/simulate', async (request, reply) => {
    if (!checkRunSecret(request)) return reply.status(401).send({ error: 'Unauthorized' });

    const body = request.body as Partial<SimJobBody> | undefined;
    const repoUrl = body?.repoUrl;
    if (!repoUrl) return reply.status(400).send({ error: 'repoUrl required' });

    const runId = Date.now().toString(36);
    const jobId = `sim_${runId}`;
    createJob(jobId, repoUrl, body?.branch);

    // Fire-and-forget: the job runs on the event loop, detached from this
    // request. Any throw is caught inside runSimJob and recorded on the job.
    void runSimJob(jobId, runId, { ...body, repoUrl } as SimJobBody)
      .catch((err) => updateJob(jobId, { status: 'error', phase: 'error', error: (err as Error).message }));

    return reply.status(202).send({
      jobId,
      status: 'queued',
      statusUrl: `/simulate/${jobId}`,
      message: 'Simulation started. Poll statusUrl for phased progress and the final result.',
    });
  });

  // Poll a simulation job. Returns the current phase while running and the full
  // result payload once status=done (or the error once status=error).
  app.get('/simulate/:jobId', async (request, reply) => {
    if (!checkRunSecret(request)) return reply.status(401).send({ error: 'Unauthorized' });
    const { jobId } = request.params as { jobId: string };
    const job = getJob(jobId);
    if (!job) return reply.status(404).send({ error: 'simulation job not found', jobId });
    return reply.send(job);
  });

  // List recent simulation jobs (most-recent first; result blobs omitted).
  app.get('/api/simulations', async (request, reply) => {
    if (!checkRunSecret(request)) return reply.status(401).send({ error: 'Unauthorized' });
    const { limit } = request.query as { limit?: string };
    const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return reply.send(listJobs(n));
  });

  app.get('/reports', async (request, reply) => {
    const reports = getReports(20);
    return reply.send(reports);
  });

  // ── Get Single Report ───────────────────────────────────────────────
  app.get('/report-view/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = getReport(id);
    if (!report) return reply.status(404).send({ error: 'Report not found' });
    return reply.send(report);
  });

  // ── Save Report ─────────────────────────────────────────────────────
  // The dashboard POSTs the result of /analyze or /clone-and-analyze here to
  // persist it to the local history DB and get back an id for the report view.
  app.post('/save-report', async (request, reply) => {
    const body = request.body as { data?: Record<string, unknown>; source?: string } | undefined;
    if (!body?.data || typeof body.data !== 'object') {
      return reply.status(400).send({ error: 'data: analysis report object required' });
    }
    try {
      const id = saveReport(body.data, body.source ?? 'unknown');
      return reply.send({ id });
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to save report', detail: (err as Error).message });
    }
  });

  // ── Clone & Analyze (accepts git URLs) ─────────────────────────────────
  app.post('/clone-and-analyze', async (request, reply) => {
    const { repoUrl, branch, baseRef } = request.body as { repoUrl: string; branch?: string; baseRef?: string };
    if (!repoUrl) return reply.status(400).send({ error: 'repoUrl required' });

    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
    const projectPath = join(TMP_DIR, repoName + '-' + Date.now());

    try {
      // Clone repo. If the caller named a branch, use it; otherwise let git
      // clone the repo's default HEAD — many repos still use 'master', and
      // hardcoding 'main' breaks the demo flow on those.
      mkdirSync(TMP_DIR, { recursive: true });
      console.log(`Cloning ${repoUrl} into ${projectPath}...`);
      const branchFlag = branch ? `--branch ${branch} ` : '';
      execSync(`git clone --depth 1 ${branchFlag}${repoUrl} ${projectPath}`, {
        timeout: CLONE_TIMEOUT_MS,
        stdio: 'pipe',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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
      }).catch(() => ({ score: 50, estimatedMaxConcurrentUsers: 0, hasRateLimiting: false, hasCaching: false, hasConnectionPooling: false, findings: [], recommendations: [] }));

      const a11yReport = await runAccessibilityAnalysis({
        projectPath,
        fileContents: codebase.fileContents,
      }).catch(() => ({ score: 0, findings: [], imagesWithoutAlt: 0, formsWithoutLabels: 0, applicable: false, totalHtmlFiles: 0 }));

      // ── Strategic Analysis (unique differentiator) ──────────────────────
      const visionReport = await runVisionAnalysis(
        codebase.fileContents,
        codebase.dependencies,
        codebase.devDependencies
      );

      const scopeReport = await runScopeAnalysis(
        codebase.fileContents,
        codebase.dependencies
      );

      const stackReport = await runStackAnalysis(
        codebase.fileContents,
        codebase.dependencies,
        codebase.devDependencies,
        codebase.techStack
      );

      // ── Advanced Analysis (7 dimensions) ──────────────────────────────
      const contractReport = await runContractAnalysis(codebase.fileContents, codebase.endpoints);
      const visualReport = await runVisualRegressionAnalysis(codebase.fileContents);
      const edgeCaseReport = await runEdgeCaseAnalysis(codebase.fileContents);
      const propertyReport = await runPropertyBasedAnalysis(codebase.fileContents);
      const chaosReport = await runChaosAnalysis(codebase.fileContents, codebase.dependencies, codebase.techStack);
      const mutationReport = await runMutationAnalysis(codebase.fileContents, codebase.devDependencies, codebase.totalFiles, codebase.totalLines);
      const predictiveReport = await runPredictiveAnalysis(codebase.fileContents, codebase.dependencies, codebase.devDependencies);

      // ── Phase 2 Deep Enhancements ────────────────────────────────────
      const supplyChainReport = await runSupplyChainAudit(codebase.dependencies, codebase.devDependencies, projectPath, { osv: true });
      const nPlusOneReport = runNPlusOneDetection(codebase.fileContents);
      // Dead-code dep check only matches JS/TS imports, so feed it npm-only
      // deps — never the Python/Go packages (which it can't trace and would
      // always flag "unused", falsely cliffing the score on polyglot repos).
      const deadCodeReport = runDeadCodeAnalysis(codebase.fileContents, codebase.npmDependencies);
      const licenseReport = runLicenseCheck(codebase.dependencies, projectPath);
      const doraReport = runDoraEstimation(codebase.fileContents, codebase.devDependencies, codebase.dependencies);
      const owaspReport = runOwaspCoverage(securityFindings.filter(f => f.severity !== 'info') as Parameters<typeof runOwaspCoverage>[0]);

      // ── Agentic Scale Prediction (21st dimension) ─────────────────────
      const agenticReport = runAgenticScalePrediction(
        codebase.fileContents,
        codebase.dependencies,
        codebase.techStack,
        codebase.endpoints,
        codebase.totalLines
      );

      // ── Kubernetes (22nd dimension) — parse manifests/Helm + check the YAML ──
      const k8sReport = await runKubernetesAnalysis(projectPath).catch(() => null);

      // Change-driven QA (opt-in via baseRef): a --depth 1 clone has no base
      // history, so shallow-fetch the base tip, then diff. Findings on changed
      // lines get tagged introducedByDiff. Degrades silently to full analysis.
      // See antirez/news/168 tenet #3 + docs/ANTIREZ-168-GAP-ANALYSIS.md.
      const { ensureBaseRef, computeChangedSurface, tagChangedFindings, regressionRiskByDimension } = await import('./analyzers/changed-surface.js');
      const resolvedBase = baseRef ? ensureBaseRef(projectPath, baseRef) : null;
      const changedSurface = resolvedBase ? computeChangedSurface(projectPath, resolvedBase) : null;
      const securityItems = changedSurface ? tagChangedFindings(changedSurface, securityFindings) : securityFindings;
      // Regression risk per dimension across the whole report (all dimensions,
      // not just security). Dimensions with no locatable hit drop out.
      const regressionRisk = changedSurface ? regressionRiskByDimension(changedSurface, {
        security: securityFindings, unit: unitReport.findings ?? [], load: loadReport.findings ?? [],
        accessibility: a11yReport.findings ?? [], contract: contractReport.findings ?? [],
        visualRegression: visualReport.findings ?? [], edgeCases: edgeCaseReport.findings ?? [],
        propertyBased: propertyReport.findings ?? [], chaos: chaosReport.findings ?? [],
        mutation: mutationReport.findings ?? [], predictive: predictiveReport.findings ?? [],
        nPlusOne: nPlusOneReport.findings ?? [], deadCode: deadCodeReport.findings ?? [],
        agentic: agenticReport.findings ?? [], kubernetes: k8sReport?.findings ?? [],
      }) : {};

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
          languageCoverage: codebase.languageCoverage,
        },
        security: {
          findings: securityFindings.length,
          critical: securityFindings.filter(f => f.severity === 'critical').length,
          high: securityFindings.filter(f => f.severity === 'high').length,
          medium: securityFindings.filter(f => f.severity === 'medium').length,
          low: securityFindings.filter(f => f.severity === 'low').length,
          items: securityItems.slice(0, 10),
        },
        changedSurface: baseRef
          ? (changedSurface
              ? { baseRef, available: true, comparison: changedSurface.comparison, changedFiles: changedSurface.changedFileCount, files: Object.keys(changedSurface.files), regressionRisk }
              : { baseRef, available: false, reason: 'could not fetch/diff the base ref — unknown ref, auth, or network' })
          : undefined,
        unit: {
          coverage: unitReport.testCoverage || 0,
          testFiles: unitReport.totalTestFiles || 0,
          totalTests: unitReport.totalTests || 0,
          frameworks: unitReport.frameworks || [],
          findings: unitReport.findings?.length || 0,
        },
        load: {
          score: loadReport.score,
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
          applicable: a11yReport.applicable,
          totalHtmlFiles: a11yReport.totalHtmlFiles || 0,
        },
        vision: {
          score: visionReport.score,
          summary: visionReport.summary,
          findings: visionReport.findings,
        },
        scope: {
          coverage: scopeReport.coverage,
          documentedFeatures: scopeReport.documentedFeatures,
          implementedFeatures: scopeReport.implementedFeatures,
          missingFeatures: scopeReport.missingFeatures,
          findings: scopeReport.findings,
        },
        stack: {
          score: stackReport.score,
          strengths: stackReport.strengths,
          weaknesses: stackReport.weaknesses,
          recommendations: stackReport.recommendations,
          findings: stackReport.findings,
        },
        contract: {
          score: contractReport.score,
          totalEndpoints: contractReport.totalEndpoints,
          documentedEndpoints: contractReport.documentedEndpoints,
          findings: contractReport.findings,
        },
        visualRegression: {
          score: visualReport.score,
          htmlFiles: visualReport.htmlFiles,
          cssFiles: visualReport.cssFiles,
          findings: visualReport.findings,
        },
        edgeCases: {
          score: edgeCaseReport.score,
          potentialCases: edgeCaseReport.potentialCases,
          findings: edgeCaseReport.findings,
        },
        propertyBased: {
          score: propertyReport.score,
          invariantsDetected: propertyReport.invariantsDetected,
          findings: propertyReport.findings,
        },
        chaos: {
          score: chaosReport.score,
          resilienceLevel: chaosReport.resilienceLevel,
          findings: chaosReport.findings,
        },
        mutation: {
          score: mutationReport.score,
          estimatedMutationScore: mutationReport.estimatedMutationScore,
          totalMutants: mutationReport.totalMutants,
          killedMutants: mutationReport.killedMutants,
          findings: mutationReport.findings,
        },
        predictive: {
          score: predictiveReport.score,
          riskLevel: predictiveReport.riskLevel,
          predictedFailures: predictiveReport.predictedFailures,
          findings: predictiveReport.findings,
        },
        supplyChain: {
          score: supplyChainReport.score,
          knownVulnerable: supplyChainReport.knownVulnerable,
          criticalVulns: supplyChainReport.criticalVulns,
          findings: supplyChainReport.findings,
        },
        nPlusOne: {
          score: nPlusOneReport.score,
          potentialNPlusOne: nPlusOneReport.potentialNPlusOne,
          findings: nPlusOneReport.findings,
        },
        deadCode: {
          score: deadCodeReport.score,
          unusedDeps: deadCodeReport.unusedDeps,
          deadFunctions: deadCodeReport.deadFunctions,
          findings: deadCodeReport.findings,
        },
        license: {
          score: licenseReport.score,
          copyleftDeps: licenseReport.copyleftDeps,
          findings: licenseReport.findings,
        },
        dora: {
          score: doraReport.score,
          deploymentFreq: doraReport.deploymentFreq,
          leadTime: doraReport.leadTime,
          mttr: doraReport.mttr,
          changeFailRate: doraReport.changeFailRate,
          findings: doraReport.findings,
        },
        owasp: {
          coverage: owaspReport.coverage,
          coveredCategories: owaspReport.coveredCategories,
          missingCategories: owaspReport.missingCategories,
          findings: owaspReport.findings,
        },
        agentic: {
          score: agenticReport.score,
          resilienceLevel: agenticReport.resilienceLevel,
          maxPredictedAgents: agenticReport.maxPredictedAgents,
          predictedBottleneck: agenticReport.predictedBottleneck,
          failurePatterns: agenticReport.failurePatterns,
          recommendations: agenticReport.recommendations,
          findings: agenticReport.findings,
        },
        kubernetes: {
          applicable: k8sReport?.applicable ?? false,
          score: k8sReport?.score ?? 0,
          manifestsParsed: k8sReport?.manifestsParsed ?? 0,
          documents: k8sReport?.documents ?? 0,
          kinds: k8sReport?.kinds ?? {},
          findings: k8sReport?.findings ?? [],
          naReason: k8sReport?.naReason,
        },
      });
    } catch (err) {
      // Clean up on error — swallow secondary IO errors during cleanup
      try { if (existsSync(projectPath)) rmSync(projectPath, { recursive: true, force: true }); } catch { /* cleanup best-effort */ }
      return reply.status(500).send({ error: (err as Error).message, repo: repoUrl });
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
    } catch (err) {
      reply.status(404).send({ error: 'Report not found', message: (err as Error).message });
    }
  });

  app.get('/api/reports/latest', async (_request, reply) => {
    // Return the most recent real report from SQLite. If there isn't one yet,
    // respond 404 so the dashboard renders an empty state instead of showing
    // fabricated numbers as if they were real results.
    const recent = getReports(1);
    if (!recent || recent.length === 0) {
      return reply.status(404).send({ error: 'No reports yet' });
    }
    const latest = recent[0];
    return getReport(latest.id) || latest;
  });

  try {
    await app.listen({ port: PORT, host: HOST });
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

// ── CLI Support for npx @whitenoisenpm/testforge-mcp serve | install ──────────────────
const args = process.argv.slice(2);
const command = args[0];

if (command === 'install') {
  console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   🧪 TestForge MCP Server v0.2.0                     ║
║                                                      ║
║   ✓ MCP server package installed                     ║
║                                                      ║
║   To connect to your IDE:                            ║
║                                                      ║
║   1. Open Cursor/VSCode Settings → MCP               ║
║   2. Add server with:                                ║
║      command: npx                                    ║
║      args: ["-y", "@whitenoisenpm/testforge-mcp", "serve"]         ║
║                                                      ║
║   3. Start testing!                                  ║
║                                                      ║
║   Docs: https://testforge.run/#/docs    ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
`);
  process.exit(0);
}

if (command === 'serve' || command === 'start' || !command) {
  main().catch(console.error);
} else if (command === 'score') {
  // CLI score command — returns single score for CI/CD
  const repoUrl = args[1];
  if (!repoUrl) {
    console.log('Usage: npx @whitenoisenpm/testforge-mcp score <repo-url>');
    console.log('Example: npx @whitenoisenpm/testforge-mcp score https://github.com/user/repo');
    process.exit(1);
  }
  try {
    const res = await fetch(`http://localhost:${PORT}/clone-and-analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, branch: 'main' }),
    });
    const data = await res.json();
    const score = Math.round(
      (data.vision?.score || 50) * 0.15 + (data.stack?.score || 60) * 0.1 +
      Math.max(0, 100 - (data.security?.critical || 0) * 20) * 0.2 +
      (data.unit?.coverage || 50) * 0.1 + (data.accessibility?.score || 70) * 0.1 +
      (data.contract?.score || 50) * 0.1 + (data.chaos?.score || 50) * 0.1 +
      (data.predictive?.score || 50) * 0.15
    );
    console.log(score);
    process.exit(score >= 70 ? 0 : 1);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
} else {
  console.log(`Usage: npx @whitenoisenpm/testforge-mcp [command]`);
  console.log(`  serve    Start the MCP server (default)`);
  console.log(`  install  Show IDE setup instructions`);
  process.exit(0);
}
