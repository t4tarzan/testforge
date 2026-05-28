// Decide whether a cloned repo can be AUTO-BOOTED so we can drive a real
// simulation against it (vs. falling back to static analysis). The honest
// reality (see SIMULATION_ENGINE_PLAN.md): arbitrary repos can't be run
// reliably, so we only claim "runnable" on strong, self-contained signals.
//
// Priority order (Phase 1 implements #1 only):
//   1. Dockerfile present  — the app declares exactly how to build + run.
//   2. docker-compose.yml   — app + its deps (Phase 2+).
//   3. Clear start command  — package.json start/dev + web framework (Phase 2+).
//
// Everything else → not runnable → the caller emits a static fallback with an
// honest "couldn't auto-run" banner.
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export type RunnableMethod = 'dockerfile' | 'compose' | 'start-command';

export interface RunnableDetection {
  runnable: boolean;
  /** Which signal we matched on (null when not runnable). */
  method: RunnableMethod | null;
  /** Absolute path to the Dockerfile we'll build from, when method=dockerfile. */
  dockerfilePath?: string;
  /** Build context directory passed to `docker build` (repo root for Phase 1). */
  contextPath?: string;
  /** Ports the app declares via EXPOSE — our first guesses for the health probe. */
  exposedPorts: number[];
  /** Human-readable explanation, surfaced in the report when not runnable. */
  reason: string;
}

// Ports we probe when the Dockerfile declares no EXPOSE. Ordered by how
// commonly web apps bind them; the health probe tries each until one answers.
export const DEFAULT_PORT_CANDIDATES = [3000, 8080, 8000, 80, 5000, 4000, 5173];

/**
 * Parse `EXPOSE` directives out of a Dockerfile. Handles multiple ports per
 * line and `port/proto` syntax (`EXPOSE 8080/tcp`). Ignores build-arg/env
 * indirection (`EXPOSE $PORT`) since we can't resolve those statically.
 */
export function parseExposedPorts(dockerfile: string): number[] {
  const ports: number[] = [];
  for (const rawLine of dockerfile.split('\n')) {
    const line = rawLine.trim();
    if (!/^EXPOSE\s+/i.test(line)) continue;
    const rest = line.replace(/^EXPOSE\s+/i, '');
    for (const tok of rest.split(/\s+/)) {
      const portStr = tok.split('/')[0];
      const port = Number(portStr);
      if (Number.isInteger(port) && port > 0 && port < 65536) ports.push(port);
    }
  }
  return [...new Set(ports)];
}

/**
 * Find a root-level Dockerfile. We deliberately do NOT recurse into the tree:
 * a Dockerfile buried in `examples/` or `test/` is almost never the app's real
 * entrypoint, and building the wrong one wastes minutes and misleads the report.
 * Case-insensitive match catches `Dockerfile`, `dockerfile`, `DOCKERFILE`.
 */
function findRootDockerfile(projectPath: string): string | null {
  // Fast path: the canonical name.
  const canonical = join(projectPath, 'Dockerfile');
  if (existsSync(canonical)) return canonical;
  try {
    for (const entry of readdirSync(projectPath)) {
      if (entry.toLowerCase() === 'dockerfile') return join(projectPath, entry);
    }
  } catch { /* unreadable dir → treat as no Dockerfile */ }
  return null;
}

/**
 * Determine if `projectPath` is auto-runnable. Phase 1: Dockerfile only.
 * The compose / start-command branches return `runnable:false` with a reason
 * that names the not-yet-implemented path, so the report stays honest while
 * those phases land.
 */
export function detectRunnable(projectPath: string): RunnableDetection {
  const dockerfilePath = findRootDockerfile(projectPath);
  if (dockerfilePath) {
    let exposedPorts: number[] = [];
    try { exposedPorts = parseExposedPorts(readFileSync(dockerfilePath, 'utf8')); }
    catch { /* keep empty → probe falls back to DEFAULT_PORT_CANDIDATES */ }
    return {
      runnable: true,
      method: 'dockerfile',
      dockerfilePath,
      contextPath: projectPath,
      exposedPorts,
      reason: exposedPorts.length
        ? `Root Dockerfile found; EXPOSE declares port(s) ${exposedPorts.join(', ')}.`
        : 'Root Dockerfile found; no EXPOSE directive, will probe common ports.',
    };
  }

  // Signals we recognize but don't yet boot (kept explicit so the "couldn't
  // auto-run" banner can say *why* and point at the upcoming phase).
  if (existsSync(join(projectPath, 'docker-compose.yml')) || existsSync(join(projectPath, 'docker-compose.yaml'))) {
    return {
      runnable: false,
      method: null,
      exposedPorts: [],
      reason: 'docker-compose.yml present, but compose-based boot is not yet supported (Phase 2).',
    };
  }

  return {
    runnable: false,
    method: null,
    exposedPorts: [],
    reason: 'No root Dockerfile found — cannot reliably auto-boot this app. Add a Dockerfile to unlock real load simulation.',
  };
}
