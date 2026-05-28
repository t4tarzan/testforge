// Real load simulation for runnable (Dockerfile) repos — Phase 1 of the
// simulation engine (see SIMULATION_ENGINE_PLAN.md).
//
// Lifecycle (all docker ops go through the same daemon the Tier-2 runner uses —
// on the managed VPS that's the locked-down socket-proxy; self-host = host
// docker):
//   1. build the app image from its Dockerfile   (legacy builder, BUILDKIT=0)
//   2. create a throwaway --internal bridge network (isolated: app+loadgen can
//      talk to each other, but NOT to the host or the internet)
//   3. boot the app container resource-capped, no published ports, no mounts
//   4. health-probe the candidate ports from a sibling loadgen container until
//      one answers or the boot deadline passes
//   5. ramp autocannon concurrency against the app; stop at the breaking point
//   6. tear EVERYTHING down (container, network, image) — always, via finally
//
// The app is UNTRUSTED repo code, so containment mirrors the Tier-2 runner:
// resource caps, no host bind-mounts, no published ports, an isolated network,
// hard time caps, ephemeral teardown. The one difference vs Tier-2 (which uses
// --network none) is that load needs network *to the app* — hence the private
// --internal network instead of full isolation.
import { spawn } from 'child_process';
import { DEFAULT_PORT_CANDIDATES } from './runnable-detect.js';

// Image that drives the load + runs the health probe. Defaults to the public
// GHCR image; the managed box overrides it to the locally-built :local tag.
const LOADGEN_IMAGE = process.env.TESTFORGE_LOADGEN_IMAGE || 'ghcr.io/t4tarzan/testforge-loadgen:latest';

// Time/resource budget. Generous enough for a real boot+ramp, bounded so a
// pathological repo can never pin the box.
const BUILD_TIMEOUT_MS = Number(process.env.TESTFORGE_SIM_BUILD_TIMEOUT_MS) || 240_000;
const BOOT_TIMEOUT_MS = Number(process.env.TESTFORGE_SIM_BOOT_TIMEOUT_MS) || 60_000;
const APP_MEMORY = process.env.TESTFORGE_SIM_APP_MEMORY || '1g';
const APP_CPUS = process.env.TESTFORGE_SIM_APP_CPUS || '1.5';
const DEFAULT_LEVELS = [10, 50, 100, 250, 500];
const DEFAULT_DURATION_SEC = 10;
// A level "breaks" when this share of requests fail (non-2xx + socket errors +
// timeouts). Crossing it defines the breaking-point concurrency.
const BREAK_ERROR_RATE = 0.05;

export interface LoadLevelResult {
  concurrency: number;
  durationSec: number;
  /** Average requests/second sustained at this concurrency. */
  rps: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  /** (non2xx + errors + timeouts) / requests sent, 0..1. */
  errorRate: number;
  totalRequests: number;
  non2xx: number;
  errors: number;
  timeouts: number;
}

export interface LoadSimResult {
  /** True only when we genuinely booted the app and drove real traffic. */
  ranReal: boolean;
  method: 'dockerfile';
  /** Port the app actually answered on (null if it never came up). */
  targetPort: number | null;
  /** Path the ramp drove traffic against. */
  path: string;
  // Headline metrics from the last level executed (the breaking point if it
  // broke, else the max level). autocannon has no p95 → we surface p90 + p99.
  p50: number | null;
  p90: number | null;
  p99: number | null;
  rps: number | null;
  errorRate: number | null;
  /** First concurrency whose errorRate crossed the threshold; null = never broke. */
  breakingPointConcurrency: number | null;
  /** Per-level detail so the UI can draw the latency/throughput curve. */
  levels: LoadLevelResult[];
  durationMs: number;
  /** Populated on failure / when ranReal=false, so the report can be honest. */
  reason?: string;
  buildLogTail?: string;
  appLogTail?: string;
}

export interface LoadSimOptions {
  /** Build context dir (repo root). */
  contextPath: string;
  /** Path to the Dockerfile to build. */
  dockerfilePath: string;
  /** Ports from EXPOSE; probed before the common-port fallbacks. */
  exposedPorts?: number[];
  /** Paths discovered in source; the ramp drives the first one (default '/'). */
  paths?: string[];
  /** Concurrency ramp. */
  concurrencyLevels?: number[];
  /** Seconds of traffic per level. */
  durationPerLevelSec?: number;
  /** Stable id used to name the image/container/network for this sim. */
  runId: string;
  /** Phased-progress sink so an async job can stream "building → booting → load L_n". */
  onProgress?: (phase: 'building' | 'booting' | 'load', detail: string) => void;
}

interface ExecResult { stdout: string; stderr: string; code: number; timedOut: boolean }

function dockerExec(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    // Inherit DOCKER_HOST so this routes to the proxy on the managed box and to
    // the host socket on self-host. DOCKER_BUILDKIT=0 forces the legacy builder:
    // BuildKit needs the /session+grpc endpoints the socket-proxy doesn't expose.
    const proc = spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DOCKER_BUILDKIT: '0' },
    });
    let stdout = '', stderr = '', timedOut = false;
    const killer = setTimeout(() => { timedOut = true; try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, timeoutMs);
    proc.stdout.on('data', (b) => { stdout += b.toString(); });
    proc.stderr.on('data', (b) => { stderr += b.toString(); });
    proc.on('close', (code) => { clearTimeout(killer); resolve({ stdout, stderr, code: code ?? -1, timedOut }); });
    proc.on('error', (err) => { clearTimeout(killer); resolve({ stdout, stderr: stderr + String(err), code: -1, timedOut }); });
  });
}

const tail = (s: string, n = 1500) => s.length > n ? s.slice(-n) : s;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── autocannon -j parser ────────────────────────────────────────────────────
// autocannon's JSON result nests latency/requests histograms and carries
// top-level status-class + error/timeout counts. We defend against shape drift
// with Number(... ?? 0) everywhere.
export function parseAutocannon(raw: string, concurrency: number, durationSec: number): LoadLevelResult | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw.slice(start)); } catch { return null; }
  const latency = (obj.latency as Record<string, number> | undefined) ?? {};
  const requests = (obj.requests as Record<string, number> | undefined) ?? {};
  const non2xx = Number(obj.non2xx ?? 0);
  const errors = Number(obj.errors ?? 0); // connection-level failures; autocannon folds timeouts into this
  const timeouts = Number(obj.timeouts ?? 0); // reported for transparency (subset of errors)
  // Denominator must include BOTH completed responses AND the no-response
  // connection errors — `requests.total` only counts the former, so dividing by
  // it lets a flood of ECONNRESET push errorRate past 1. Total attempts =
  // every status-classed response + every connection error.
  const statusSum = ['1xx', '2xx', '3xx', '4xx', '5xx'].reduce((a, k) => a + Number(obj[k] ?? 0), 0);
  const totalRequests = statusSum + errors;
  const failed = non2xx + errors; // non2xx ⊂ statusSum; errors are the rest
  const errorRate = totalRequests > 0 ? Math.min(1, failed / totalRequests) : 0;
  return {
    concurrency,
    durationSec,
    rps: Number(requests.average ?? requests.mean ?? 0),
    latencyP50: Number(latency.p50 ?? latency.average ?? 0),
    latencyP90: Number(latency.p90 ?? 0),
    latencyP99: Number(latency.p99 ?? 0),
    errorRate,
    totalRequests,
    non2xx,
    errors,
    timeouts,
  };
}

export async function runLoadSimulation(opts: LoadSimOptions): Promise<LoadSimResult> {
  const t0 = Date.now();
  const { runId, contextPath, dockerfilePath } = opts;
  const levels = opts.concurrencyLevels?.length ? opts.concurrencyLevels : DEFAULT_LEVELS;
  const durationSec = opts.durationPerLevelSec ?? DEFAULT_DURATION_SEC;
  const path = (opts.paths && opts.paths.length ? opts.paths[0] : '/') || '/';
  const candidatePorts = (opts.exposedPorts && opts.exposedPorts.length ? opts.exposedPorts : DEFAULT_PORT_CANDIDATES);

  const image = `testforge-sim-${runId}:local`;
  const appName = `tf-sim-app-${runId}`;
  const netName = `tf-sim-net-${runId}`;

  const base = (): LoadSimResult => ({
    ranReal: false, method: 'dockerfile', targetPort: null, path,
    p50: null, p90: null, p99: null, rps: null, errorRate: null,
    breakingPointConcurrency: null, levels: [], durationMs: Date.now() - t0,
  });

  const progress = opts.onProgress ?? (() => undefined);

  let networkCreated = false;
  let appStarted = false;
  try {
    // 1. Build the app image (legacy builder via dockerExec env).
    progress('building', 'Building app image from Dockerfile');
    const build = await dockerExec(
      ['build', '-t', image, '-f', dockerfilePath, contextPath],
      BUILD_TIMEOUT_MS,
    );
    if (build.code !== 0) {
      return { ...base(), reason: build.timedOut ? `Image build timed out after ${BUILD_TIMEOUT_MS / 1000}s.` : 'Image build failed.', buildLogTail: tail(build.stdout + build.stderr) };
    }

    // 2. Isolated throwaway network.
    const net = await dockerExec(['network', 'create', '--internal', netName], 20_000);
    if (net.code !== 0) {
      return { ...base(), reason: 'Could not create the isolated sim network.', buildLogTail: tail(net.stderr) };
    }
    networkCreated = true;

    // 3. Boot the app, resource-capped, no published ports, no host mounts.
    const run = await dockerExec([
      'run', '-d', '--name', appName, '--network', netName,
      '--memory', APP_MEMORY, '--cpus', APP_CPUS, '--pids-limit', '256',
      '--security-opt', 'no-new-privileges',
      image,
    ], 30_000);
    if (run.code !== 0) {
      return { ...base(), reason: 'App container failed to start.', buildLogTail: tail(run.stderr) };
    }
    appStarted = true;

    // 4. Health-probe candidate ports until one answers (or boot deadline).
    progress('booting', `Waiting for app to answer on port(s) ${candidatePorts.join(', ')}`);
    const probeUrls = candidatePorts.map((p) => `http://${appName}:${p}/`);
    let targetPort: number | null = null;
    const bootDeadline = Date.now() + BOOT_TIMEOUT_MS;
    while (Date.now() < bootDeadline) {
      const probe = await dockerExec(
        ['run', '--rm', '--network', netName, LOADGEN_IMAGE, 'node', '/loadgen/probe.mjs', ...probeUrls],
        10_000,
      );
      if (probe.code === 0) {
        // Exit 0 means a candidate port answered. Prefer the exact port the
        // probe echoed; if stdout was lost (pipe-flush race) fall back to the
        // first candidate — with one EXPOSE port that's unambiguous anyway.
        const m = probe.stdout.trim().match(/:(\d+)\//);
        targetPort = m ? Number(m[1]) : candidatePorts[0];
        break;
      }
      await sleep(2000);
    }

    if (targetPort === null) {
      const logs = await dockerExec(['logs', '--tail', '40', appName], 10_000);
      return { ...base(), reason: `App did not answer on any candidate port (${candidatePorts.join(', ')}) within ${BOOT_TIMEOUT_MS / 1000}s.`, appLogTail: tail(logs.stdout + logs.stderr, 1500) };
    }

    // 5. Ramp concurrency; stop once we cross the breaking point.
    const target = `http://${appName}:${targetPort}${path}`;
    const results: LoadLevelResult[] = [];
    let breakingPoint: number | null = null;
    for (const c of levels) {
      progress('load', `Driving load at concurrency ${c} for ${durationSec}s`);
      const ac = await dockerExec(
        ['run', '--rm', '--network', netName, LOADGEN_IMAGE,
          'autocannon', '-j', '-c', String(c), '-d', String(durationSec), '--renderStatusCodes', target],
        (durationSec + 25) * 1000,
      );
      const lvl = parseAutocannon(ac.stdout, c, durationSec);
      if (!lvl) {
        // Treat an unparseable run as a hard break — the driver couldn't get a
        // clean result at this load. Record nothing fake; stop ramping.
        breakingPoint = c;
        break;
      }
      results.push(lvl);
      if (lvl.errorRate > BREAK_ERROR_RATE) { breakingPoint = c; break; }
    }

    if (results.length === 0) {
      const logs = await dockerExec(['logs', '--tail', '40', appName], 10_000);
      return { ...base(), targetPort, reason: 'Load driver produced no usable results.', appLogTail: tail(logs.stdout + logs.stderr, 1500) };
    }

    const headline = results[results.length - 1];
    return {
      ranReal: true,
      method: 'dockerfile',
      targetPort,
      path,
      p50: headline.latencyP50,
      p90: headline.latencyP90,
      p99: headline.latencyP99,
      rps: headline.rps,
      errorRate: headline.errorRate,
      breakingPointConcurrency: breakingPoint,
      levels: results,
      durationMs: Date.now() - t0,
    };
  } catch (err) {
    return { ...base(), reason: `Simulation error: ${(err as Error).message}` };
  } finally {
    // Always tear down — order matters: remove the container (frees the net),
    // then the network, then the image. Each best-effort.
    if (appStarted) await dockerExec(['rm', '-f', appName], 20_000).catch(() => undefined);
    if (networkCreated) await dockerExec(['network', 'rm', netName], 20_000).catch(() => undefined);
    await dockerExec(['rmi', '-f', image], 30_000).catch(() => undefined);
  }
}
