// Shared docker lifecycle for the simulation engine. Both the load ramp
// (Phase 1) and chaos (Phase 2) drive traffic against the SAME booted app, so
// the expensive build+boot happens once here and each dimension operates on the
// resulting Sandbox.
//
// All docker ops go through the same daemon the Tier-2 runner uses — on the
// managed VPS that's the locked-down socket-proxy; self-host = host docker.
//
// The app is UNTRUSTED repo code, so containment mirrors the Tier-2 runner:
// resource caps, no host bind-mounts, no published ports, an isolated network,
// hard time caps, ephemeral teardown. The one difference vs Tier-2 (which uses
// --network none) is that load needs network *to the app* — hence the private
// --internal network instead of full isolation.
import { spawn } from 'child_process';
import { DEFAULT_PORT_CANDIDATES } from './runnable-detect.js';

// Image that drives load + runs the health probe. Defaults to the public GHCR
// image; the managed box overrides it to the locally-built :local tag.
export const LOADGEN_IMAGE = process.env.TESTFORGE_LOADGEN_IMAGE || 'ghcr.io/t4tarzan/testforge-loadgen:latest';

// Time/resource budget. Generous enough for a real boot, bounded so a
// pathological repo can never pin the box.
export const BUILD_TIMEOUT_MS = Number(process.env.TESTFORGE_SIM_BUILD_TIMEOUT_MS) || 240_000;
export const BOOT_TIMEOUT_MS = Number(process.env.TESTFORGE_SIM_BOOT_TIMEOUT_MS) || 60_000;
const APP_MEMORY = process.env.TESTFORGE_SIM_APP_MEMORY || '1g';
const APP_CPUS = process.env.TESTFORGE_SIM_APP_CPUS || '1.5';

export interface LoadLevelResult {
  concurrency: number;
  durationSec: number;
  /** Average requests/second sustained at this concurrency. */
  rps: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  /** (non2xx + connection errors) / total attempts, 0..1. */
  errorRate: number;
  totalRequests: number;
  non2xx: number;
  errors: number;
  timeouts: number;
}

export interface ExecResult { stdout: string; stderr: string; code: number; timedOut: boolean }

export function dockerExec(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    // Inherit DOCKER_HOST so this routes to the proxy on the managed box and to
    // the host socket on self-host. DOCKER_BUILDKIT=0 forces the legacy builder:
    // BuildKit needs the /session+grpc endpoints the socket-proxy doesn't expose
    // (and the managed box has no buildx component installed either).
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

export const tail = (s: string, n = 1500): string => s.length > n ? s.slice(-n) : s;
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

// ── Sandbox lifecycle ───────────────────────────────────────────────────────

/** A live, health-checked app under test. Caller MUST teardownSandbox() it. */
export interface Sandbox {
  runId: string;
  /** How it was booted — determines teardown strategy. */
  kind: 'single' | 'compose';
  /** Container name for docker ops (logs, pause/unpause/restart). */
  appName: string;
  /** DNS host the load driver hits over HTTP (network alias). For single = appName. */
  appHost: string;
  netName: string;
  /** Port the app actually answered on. */
  targetPort: number;
  /** single-container only: the built image tag to remove on teardown. */
  image?: string;
  /** compose only: project name + sanitized compose file path (for teardown). */
  composeProject?: string;
  composeFile?: string;
}

export interface PrepareOptions {
  /** Build context dir (repo root). */
  contextPath: string;
  /** Path to the Dockerfile to build. */
  dockerfilePath: string;
  /** Ports from EXPOSE; probed before the common-port fallbacks. */
  exposedPorts?: number[];
  /** Stable id used to name the image/container/network for this sim. */
  runId: string;
  onProgress?: (phase: 'building' | 'booting', detail: string) => void;
}

export interface PrepareResult {
  ok: boolean;
  sandbox?: Sandbox;
  /** Why preparation failed (when ok=false) — surfaced honestly in the report. */
  reason?: string;
  buildLogTail?: string;
  appLogTail?: string;
}

/**
 * Build the app image, create an isolated network, boot the app resource-capped,
 * and wait until it answers on a port. On ANY failure this cleans up whatever it
 * created and returns ok:false — so the caller only has to teardown on success.
 */
export async function prepareSandbox(opts: PrepareOptions): Promise<PrepareResult> {
  const { runId, contextPath, dockerfilePath } = opts;
  const candidatePorts = (opts.exposedPorts && opts.exposedPorts.length ? opts.exposedPorts : DEFAULT_PORT_CANDIDATES);
  const progress = opts.onProgress ?? (() => undefined);

  const image = `testforge-sim-${runId}:local`;
  const appName = `tf-sim-app-${runId}`;
  const netName = `tf-sim-net-${runId}`;

  let networkCreated = false;
  let appStarted = false;
  const cleanup = async () => {
    if (appStarted) await dockerExec(['rm', '-f', appName], 20_000).catch(() => undefined);
    if (networkCreated) await dockerExec(['network', 'rm', netName], 20_000).catch(() => undefined);
    await dockerExec(['rmi', '-f', image], 30_000).catch(() => undefined);
  };

  try {
    // 1. Build the app image (legacy builder via dockerExec env).
    progress('building', 'Building app image from Dockerfile');
    const build = await dockerExec(['build', '-t', image, '-f', dockerfilePath, contextPath], BUILD_TIMEOUT_MS);
    if (build.code !== 0) {
      await cleanup();
      return { ok: false, reason: build.timedOut ? `Image build timed out after ${BUILD_TIMEOUT_MS / 1000}s.` : 'Image build failed.', buildLogTail: tail(build.stdout + build.stderr) };
    }

    // 2. Isolated throwaway network.
    const net = await dockerExec(['network', 'create', '--internal', netName], 20_000);
    if (net.code !== 0) {
      await cleanup();
      return { ok: false, reason: 'Could not create the isolated sim network.', buildLogTail: tail(net.stderr) };
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
      await cleanup();
      return { ok: false, reason: 'App container failed to start.', buildLogTail: tail(run.stderr) };
    }
    appStarted = true;

    // 4. Health-probe candidate ports until one answers (or boot deadline).
    progress('booting', `Waiting for app to answer on port(s) ${candidatePorts.join(', ')}`);
    const targetPort = await waitForHealthyPort(netName, appName, candidatePorts, Date.now() + BOOT_TIMEOUT_MS);
    if (targetPort === null) {
      const logs = await getAppLogs({ runId, kind: 'single', image, appName, appHost: appName, netName, targetPort: 0 }, 40);
      await cleanup();
      return { ok: false, reason: `App did not answer on any candidate port (${candidatePorts.join(', ')}) within ${BOOT_TIMEOUT_MS / 1000}s.`, appLogTail: logs };
    }

    return { ok: true, sandbox: { runId, kind: 'single', image, appName, appHost: appName, netName, targetPort } };
  } catch (err) {
    await cleanup();
    return { ok: false, reason: `Sandbox preparation error: ${(err as Error).message}` };
  }
}

/** Tear EVERYTHING down. Best-effort throughout. Branches on how it was booted. */
export async function teardownSandbox(sb: Sandbox): Promise<void> {
  if (sb.kind === 'compose') {
    // `compose down` can 403 on the volume endpoint under the locked-down proxy,
    // so we follow it with a force-clean by the compose project label (container
    // + network removal go through CONTAINERS/NETWORKS, which are allowed).
    if (sb.composeFile && sb.composeProject) {
      await dockerExec(['compose', '-p', sb.composeProject, '-f', sb.composeFile, 'down', '--remove-orphans', '-t', '3'], 60_000).catch(() => undefined);
    }
    if (sb.composeProject) {
      const ps = await dockerExec(['ps', '-aq', '--filter', `label=com.docker.compose.project=${sb.composeProject}`], 15_000).catch(() => null);
      for (const id of (ps?.stdout ?? '').split('\n').map((s) => s.trim()).filter(Boolean)) {
        await dockerExec(['rm', '-f', id], 15_000).catch(() => undefined);
      }
      await dockerExec(['network', 'rm', `${sb.composeProject}_default`], 15_000).catch(() => undefined);
      // Remove images compose built for this project (named `<proj>-<svc>` / `<proj>_<svc>`).
      const imgs = await dockerExec(['images', '--format', '{{.Repository}}:{{.Tag}}'], 15_000).catch(() => null);
      for (const ref of (imgs?.stdout ?? '').split('\n').map((s) => s.trim()).filter((r) => r.startsWith(`${sb.composeProject}-`) || r.startsWith(`${sb.composeProject}_`))) {
        await dockerExec(['rmi', '-f', ref], 20_000).catch(() => undefined);
      }
    }
    return;
  }
  await dockerExec(['rm', '-f', sb.appName], 20_000).catch(() => undefined);
  await dockerExec(['network', 'rm', sb.netName], 20_000).catch(() => undefined);
  if (sb.image) await dockerExec(['rmi', '-f', sb.image], 30_000).catch(() => undefined);
}

/**
 * Poll the health probe (one loadgen container per attempt, probing all
 * candidate ports at once) until a port answers or the deadline passes.
 * Returns the port, or null on timeout.
 */
export async function waitForHealthyPort(
  netName: string, appName: string, candidatePorts: number[], deadlineMs: number,
): Promise<number | null> {
  const probeUrls = candidatePorts.map((p) => `http://${appName}:${p}/`);
  while (Date.now() < deadlineMs) {
    const probe = await dockerExec(
      ['run', '--rm', '--network', netName, LOADGEN_IMAGE, 'node', '/loadgen/probe.mjs', ...probeUrls],
      10_000,
    );
    if (probe.code === 0) {
      // Exit 0 means a candidate port answered. Prefer the exact port the probe
      // echoed; if stdout was lost (pipe-flush race) fall back to the first
      // candidate — with one EXPOSE port that's unambiguous anyway.
      const m = probe.stdout.trim().match(/:(\d+)\//);
      return m ? Number(m[1]) : candidatePorts[0];
    }
    await sleep(2000);
  }
  return null;
}

/** Run one autocannon window against the sandbox app at the given path. */
export async function runAutocannon(
  sb: Sandbox, path: string, concurrency: number, durationSec: number,
): Promise<LoadLevelResult | null> {
  const target = `http://${sb.appHost}:${sb.targetPort}${path}`;
  const ac = await dockerExec(
    ['run', '--rm', '--network', sb.netName, LOADGEN_IMAGE,
      'autocannon', '-j', '-c', String(concurrency), '-d', String(durationSec), '--renderStatusCodes', target],
    (durationSec + 25) * 1000,
  );
  return parseAutocannon(ac.stdout, concurrency, durationSec);
}

/**
 * Drive a short, DISCARDED traffic window so the app reaches steady state
 * before we measure. The first burst against a freshly-booted app sees
 * cold-start artifacts — listen-backlog drops, JIT warmup, lazy init, a dev
 * server's one-time update-check — that wrongly inflate error rate. Warming up
 * first makes both the load ramp and the chaos baseline reflect real capacity.
 */
export async function warmup(sb: Sandbox, path: string, concurrency = 5, durationSec = 3): Promise<void> {
  await runAutocannon(sb, path, concurrency, durationSec).catch(() => undefined);
}

/** Last N lines of the app container's logs (stdout+stderr), tail-trimmed. */
export async function getAppLogs(sb: Sandbox, lines = 40): Promise<string> {
  const logs = await dockerExec(['logs', '--tail', String(lines), sb.appName], 10_000);
  return tail(logs.stdout + logs.stderr, 1500);
}

// ── Fault injectors (Phase 2 chaos) ─────────────────────────────────────────
// pause/unpause freeze+thaw the process (a "stop-the-world" stall); restart
// kills it and brings the container back (crash recovery). Both work through
// the socket-proxy under POST+CONTAINERS.
export async function pauseApp(sb: Sandbox): Promise<boolean> {
  return (await dockerExec(['pause', sb.appName], 15_000)).code === 0;
}
export async function unpauseApp(sb: Sandbox): Promise<boolean> {
  return (await dockerExec(['unpause', sb.appName], 15_000)).code === 0;
}
export async function restartApp(sb: Sandbox, stopGraceSec = 2): Promise<boolean> {
  return (await dockerExec(['restart', '-t', String(stopGraceSec), sb.appName], 40_000)).code === 0;
}
