// Compose-aware sandbox — boots a multi-service docker-compose stack (e.g.
// FastAPI + Postgres + Redis) so real load/chaos can run against apps the
// single-Dockerfile wedge can't (SIMULATION_ENGINE_PLAN.md, priority #2).
//
// Constraints from the locked-down socket-proxy (see hetzner-oc-server):
//   • VOLUMES=0 → we CANNOT create named volumes. So we render the compose
//     config, STRIP named volumes + host bind-mounts (sims are ephemeral —
//     anonymous/image volumes still work via container-create), and boot the
//     sanitized stack. Postgres/Redis run fine without persistence for a sim.
//   • No host bind-mounts / published ports in the sandbox → we strip `ports`
//     too and reach services over the compose project network by service name.
//   • BUILD via the legacy builder (DOCKER_BUILDKIT=0, set in dockerExec) since
//     BuildKit's session/grpc endpoints aren't exposed by the proxy.
//
// The web service (the one we drive load against) is identified from the
// rendered config; everything else (db, cache, worker) just has to come up.
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import {
  type Sandbox, type PrepareResult, dockerExec, tail, waitForHealthyPort,
  BUILD_TIMEOUT_MS, BOOT_TIMEOUT_MS,
} from './sandbox.js';
import { DEFAULT_PORT_CANDIDATES } from './runnable-detect.js';

export interface ComposePrepareOptions {
  /** Path to the repo's docker-compose.yml. */
  composePath: string;
  /** Repo root (build contexts resolve relative to the compose file's dir). */
  contextPath: string;
  runId: string;
  onProgress?: (phase: 'building' | 'booting', detail: string) => void;
}

// Service names that look like the user-facing web app, best-first.
const WEB_NAME_RE = /^(web|app|api|frontend|front|server|nginx|gateway|http|ui|client|backend|django|flask|fastapi|rails|vote|result)$/i;

// The BuildKit-provided automatic build args, supplied manually so legacy-builder
// builds of `FROM --platform=$BUILDPLATFORM ...` Dockerfiles don't fail on an
// empty platform. Arch follows the host the sim runs on.
const DOCKER_ARCH = process.arch === 'arm64' ? 'arm64' : 'amd64';
const PLATFORM_BUILD_ARGS: Record<string, string> = {
  BUILDPLATFORM: `linux/${DOCKER_ARCH}`, TARGETPLATFORM: `linux/${DOCKER_ARCH}`,
  BUILDOS: 'linux', TARGETOS: 'linux', BUILDARCH: DOCKER_ARCH, TARGETARCH: DOCKER_ARCH,
};

interface RenderedService {
  image?: string;
  build?: unknown;
  ports?: Array<{ target?: number; published?: string | number } | string>;
  expose?: Array<string | number>;
  [k: string]: unknown;
}
interface RenderedConfig { services?: Record<string, RenderedService>; [k: string]: unknown }

/** Container port a service exposes, if statically known. */
function servicePort(svc: RenderedService): number | null {
  if (Array.isArray(svc.ports) && svc.ports.length) {
    const p = svc.ports[0];
    if (typeof p === 'object' && p.target != null) return Number(p.target);
    if (typeof p === 'string') { const m = p.match(/(\d+)(?:\/\w+)?$/); if (m) return Number(m[1]); }
  }
  if (Array.isArray(svc.expose) && svc.expose.length) return Number(String(svc.expose[0]).split('/')[0]);
  return null;
}

/** Pick the service to drive load against: published ports → exposed → web-ish
 *  name → has a build context → first. Returns the name + best-known port. */
export function pickWebService(services: Record<string, RenderedService>): { name: string; port: number | null } | null {
  const names = Object.keys(services);
  if (!names.length) return null;
  const withPorts = names.filter((n) => Array.isArray(services[n].ports) && services[n].ports!.length);
  const withExpose = names.filter((n) => Array.isArray(services[n].expose) && services[n].expose!.length);
  const webNamed = names.filter((n) => WEB_NAME_RE.test(n));
  const withBuild = names.filter((n) => services[n].build != null);
  // Prefer a web-named service among those that publish/expose a port.
  const pref =
    webNamed.find((n) => withPorts.includes(n)) ??
    withPorts[0] ??
    webNamed.find((n) => withExpose.includes(n)) ??
    withExpose[0] ??
    webNamed[0] ??
    withBuild[0] ??
    names[0];
  return { name: pref, port: servicePort(services[pref]) };
}

function isEmptyVal(v: unknown): boolean {
  return v === '' || v === null || v === undefined
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
}

/** Recursively drop empty values. `docker compose config` emits normalized
 *  fields like `platform: ""` and `environment: {}` that do NOT re-validate when
 *  the rendered config is fed back to `compose up` — pruning them is required. */
function pruneEmpty<T>(obj: T): T {
  if (Array.isArray(obj)) return obj.map(pruneEmpty).filter((v) => !isEmptyVal(v)) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const pv = pruneEmpty(v);
      if (!isEmptyVal(pv)) out[k] = pv;
    }
    return out as T;
  }
  return obj;
}

/** Drop named volumes, host binds, published ports, per-service networks, and
 *  depends_on conditions from the rendered config — producing a compose file the
 *  locked-down proxy can boot. Mutates a clone; returns sanitized YAML. */
export function sanitizeComposeConfig(config: RenderedConfig): string {
  const c: RenderedConfig = JSON.parse(JSON.stringify(config));
  delete (c as Record<string, unknown>).volumes;   // no named volumes (VOLUMES=0)
  delete (c as Record<string, unknown>).networks;  // use the default project net (service-name DNS)
  delete (c as Record<string, unknown>).version;
  delete (c as Record<string, unknown>).name;
  for (const svc of Object.values(c.services ?? {})) {
    delete svc.volumes;   // no named volumes / host binds
    delete svc.ports;     // reach services over the project network, not the host
    delete svc.networks;  // keep everything on <proj>_default
    delete svc.restart;   // don't fight teardown / chaos
    delete (svc as Record<string, unknown>).platform; // `compose config` emits platform:"" which fails to re-parse
    // depends_on with `condition: service_healthy` hangs if the dep has no
    // healthcheck — reduce to plain ordering.
    if (svc.depends_on && !Array.isArray(svc.depends_on) && typeof svc.depends_on === 'object') {
      svc.depends_on = Object.keys(svc.depends_on as Record<string, unknown>);
    }
    // We build with the LEGACY builder (the socket-proxy can't proxy BuildKit's
    // session/grpc hijack). BuildKit-only `FROM --platform=$BUILDPLATFORM` lines
    // then expand to an empty platform and fail — so define those build args
    // ourselves. (This does NOT rescue `RUN --mount=...` cache mounts, which the
    // legacy builder simply can't do; such repos boot only via prebuilt images.)
    if (svc.build != null) {
      const b = (typeof svc.build === 'string' ? { context: svc.build } : { ...(svc.build as Record<string, unknown>) }) as Record<string, unknown>;
      const existing = (b.args && typeof b.args === 'object' && !Array.isArray(b.args)) ? b.args as Record<string, unknown> : {};
      b.args = { ...PLATFORM_BUILD_ARGS, ...existing };
      svc.build = b;
    }
  }
  // Prune any remaining normalized empties that break re-parse.
  return yaml.dump({ services: pruneEmpty(c.services) });
}

const projectName = (runId: string) => `tfsim${runId}`.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function prepareComposeSandbox(opts: ComposePrepareOptions): Promise<PrepareResult> {
  const { runId, composePath, contextPath } = opts;
  const progress = opts.onProgress ?? (() => undefined);
  const proj = projectName(runId);
  const sanitizedPath = join(contextPath, `.testforge-sim-${runId}.yml`);

  const forceClean = async () => {
    await dockerExec(['compose', '-p', proj, 'down', '--remove-orphans', '-t', '3'], 60_000).catch(() => undefined);
    const ps = await dockerExec(['ps', '-aq', '--filter', `label=com.docker.compose.project=${proj}`], 15_000).catch(() => null);
    for (const id of (ps?.stdout ?? '').split('\n').map((s) => s.trim()).filter(Boolean)) {
      await dockerExec(['rm', '-f', id], 15_000).catch(() => undefined);
    }
    await dockerExec(['network', 'rm', `${proj}_default`], 15_000).catch(() => undefined);
    try { rmSync(sanitizedPath, { force: true }); } catch { /* ignore */ }
  };

  try {
    // 1. Render the fully-resolved config (local — no daemon) and pick the web service.
    progress('building', 'Reading compose config');
    const cfg = await dockerExec(['compose', '-f', composePath, '-p', proj, 'config', '--format', 'json'], 30_000);
    if (cfg.code !== 0) {
      return { ok: false, reason: 'Could not parse docker-compose config.', buildLogTail: tail(cfg.stderr) };
    }
    let config: RenderedConfig;
    try { config = JSON.parse(cfg.stdout); } catch { return { ok: false, reason: 'compose config produced unparseable JSON.' }; }
    const services = config.services ?? {};
    const web = pickWebService(services);
    if (!web) return { ok: false, reason: 'No services found in docker-compose config.' };

    // 2. Sanitize → boot the stack (build via legacy builder, no host mounts/ports).
    writeFileSync(sanitizedPath, sanitizeComposeConfig(config), 'utf8');
    progress('building', `Building + starting ${Object.keys(services).length} service(s) via compose`);
    const up = await dockerExec(['compose', '-p', proj, '-f', sanitizedPath, 'up', '-d', '--build'], BUILD_TIMEOUT_MS);
    if (up.code !== 0) {
      const logs = await dockerExec(['compose', '-p', proj, '-f', sanitizedPath, 'logs', '--no-color', '--tail', '30'], 15_000).catch(() => null);
      await forceClean();
      return { ok: false, reason: up.timedOut ? 'compose up timed out.' : 'compose up failed.', buildLogTail: tail(up.stdout + up.stderr), appLogTail: logs ? tail(logs.stdout + logs.stderr) : undefined };
    }

    // 3. Resolve the web service's actual container name (for fault injection).
    const psj = await dockerExec(['compose', '-p', proj, '-f', sanitizedPath, 'ps', '--format', 'json'], 15_000).catch(() => null);
    let appContainer = `${proj}-${web.name}-1`;
    if (psj && psj.code === 0) {
      // compose ps --format json is one JSON object per line (or a JSON array).
      for (const line of psj.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) {
        try {
          const rows = line.startsWith('[') ? JSON.parse(line) : [JSON.parse(line)];
          for (const r of rows) if (r.Service === web.name && r.Name) appContainer = r.Name;
        } catch { /* ignore non-JSON lines */ }
      }
    }

    // 4. Health-probe the web service by its service-name alias on <proj>_default.
    const netName = `${proj}_default`;
    const candidatePorts = web.port ? [web.port, ...DEFAULT_PORT_CANDIDATES.filter((p) => p !== web.port)] : DEFAULT_PORT_CANDIDATES;
    progress('booting', `Waiting for "${web.name}" to answer on port(s) ${candidatePorts.slice(0, 4).join(', ')}`);
    const targetPort = await waitForHealthyPort(netName, web.name, candidatePorts, Date.now() + BOOT_TIMEOUT_MS);
    if (targetPort === null) {
      const logs = await dockerExec(['compose', '-p', proj, '-f', sanitizedPath, 'logs', '--no-color', '--tail', '40'], 15_000).catch(() => null);
      await forceClean();
      return { ok: false, reason: `Compose stack started but "${web.name}" never answered on ${candidatePorts.slice(0, 4).join(', ')} within ${BOOT_TIMEOUT_MS / 1000}s.`, appLogTail: logs ? tail(logs.stdout + logs.stderr) : undefined };
    }

    const sandbox: Sandbox = {
      runId, kind: 'compose', appName: appContainer, appHost: web.name, netName, targetPort,
      composeProject: proj, composeFile: sanitizedPath,
    };
    return { ok: true, sandbox };
  } catch (err) {
    await forceClean();
    return { ok: false, reason: `Compose sandbox error: ${(err as Error).message}` };
  }
}
