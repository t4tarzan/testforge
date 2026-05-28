// Chaos — Phase 2 of the simulation engine (see SIMULATION_ENGINE_PLAN.md).
//
// Drives steady load against a booted app, injects a real fault mid-flight, and
// measures the two metrics that matter for resilience:
//   • errorRateDuringFault — how badly traffic fails while the fault is active
//   • recoverySeconds       — how long after the fault clears until the app
//                             serves at its pre-fault level again
//
// Fault types (both work through the socket-proxy under POST+CONTAINERS):
//   • restart (default) — docker kill+start: models a crash. recoverySeconds is
//                         the app's cold-reboot-to-serving time.
//   • pause             — docker pause/unpause: models a stop-the-world freeze.
//
// Operates on an already-prepared Sandbox so it can share the booted app with
// the load ramp (build once, run both dimensions).
import {
  type Sandbox, runAutocannon, restartApp, pauseApp, unpauseApp, getAppLogs, warmup, sleep,
} from './sandbox.js';

export type FaultType = 'restart' | 'pause';

// How far above the pre-fault baseline error rate still counts as "recovered".
// Generous enough that a fragile app returning to its (already-imperfect)
// normal registers as recovered, tight enough that a still-broken app doesn't.
const RECOVERY_MARGIN = 0.15;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_BASELINE_SEC = 5;
const DEFAULT_FAULT_SEC = 6;
const DEFAULT_RECOVERY_TIMEOUT_SEC = 30;

export interface ChaosResult {
  ranReal: boolean;
  method: 'dockerfile';
  faultType: FaultType;
  targetPort: number;
  path: string;
  /** Concurrency used throughout (chosen to be one the app can sustain). */
  concurrency: number;
  /** Error rate while healthy, just before the fault — the recovery target. */
  baselineErrorRate: number;
  baselineRps: number;
  /** Error rate measured while the fault was active. */
  errorRateDuringFault: number;
  /** Seconds from fault-cleared to serving at ~baseline again; null if never. */
  recoverySeconds: number | null;
  recovered: boolean;
  durationMs: number;
  reason?: string;
  appLogTail?: string;
}

export interface ChaosOptions {
  paths?: string[];
  /** Load level held throughout. Pick one the app handles (below its breaking point). */
  concurrency?: number;
  baselineSec?: number;
  faultSec?: number;
  faultType?: FaultType;
  recoveryTimeoutSec?: number;
  onProgress?: (detail: string) => void;
}

/** A post-fault check counts as recovered once its error rate is back within
 *  RECOVERY_MARGIN of the pre-fault baseline. Pure → unit-tested. */
export function isRecovered(checkErrorRate: number, baselineErrorRate: number): boolean {
  return checkErrorRate <= baselineErrorRate + RECOVERY_MARGIN;
}

export async function runChaos(sb: Sandbox, opts: ChaosOptions = {}): Promise<ChaosResult> {
  const t0 = Date.now();
  const path = (opts.paths && opts.paths.length ? opts.paths[0] : '/') || '/';
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const baselineSec = opts.baselineSec ?? DEFAULT_BASELINE_SEC;
  const faultSec = opts.faultSec ?? DEFAULT_FAULT_SEC;
  const faultType = opts.faultType ?? 'restart';
  const recoveryTimeoutSec = opts.recoveryTimeoutSec ?? DEFAULT_RECOVERY_TIMEOUT_SEC;
  const progress = opts.onProgress ?? (() => undefined);

  const result = (extra: Partial<ChaosResult>): ChaosResult => ({
    ranReal: true, method: 'dockerfile', faultType, targetPort: sb.targetPort, path,
    concurrency, baselineErrorRate: 1, baselineRps: 0, errorRateDuringFault: 1,
    recoverySeconds: null, recovered: false, durationMs: Date.now() - t0, ...extra,
  });

  // 0. Warm to steady state so the baseline reflects real (not cold-start)
  //    behavior — matters most when chaos runs without a load ramp before it.
  progress('Warming up the app');
  await warmup(sb, path);

  // 1. Baseline — confirm how the app behaves healthy at this load.
  progress(`Baseline load at concurrency ${concurrency} for ${baselineSec}s`);
  const baseline = await runAutocannon(sb, path, concurrency, baselineSec);
  const baselineErrorRate = baseline?.errorRate ?? 1;
  const baselineRps = baseline?.rps ?? 0;

  // 2. Inject the fault while traffic is flowing, so we capture the error spike.
  // The load driver runs in a sibling container with ~1-2s startup latency, so
  // we start it and let it WARM UP before injecting — otherwise a fast-restarting
  // service (e.g. nginx) recovers before the driver lands a single request and
  // the spike reads as zero.
  progress(`Injecting ${faultType} fault under load`);
  const loadDuringFault = runAutocannon(sb, path, concurrency, faultSec); // not awaited yet
  await sleep(2000); // let the driver warm up and actually be hitting the app

  let faultCleared = false;
  try {
    if (faultType === 'pause') {
      await pauseApp(sb);
      await sleep(Math.max(1000, (faultSec - 4) * 1000)); // hold the freeze inside the load window
      faultCleared = await unpauseApp(sb);
    } else {
      faultCleared = await restartApp(sb); // blocks until the container is back (app may still be booting)
    }
  } catch { /* fall through: faultCleared stays false → reported honestly */ }
  const tCleared = Date.now(); // recovery is measured from the moment the fault was lifted

  if (!faultCleared) {
    const faultLoad = await loadDuringFault;
    return result({
      baselineErrorRate, baselineRps, errorRateDuringFault: faultLoad?.errorRate ?? 1,
      reason: `Could not clear the ${faultType} fault (docker command failed).`,
      appLogTail: await getAppLogs(sb),
    });
  }

  // 3. Recovery — poll until the app is back to ~baseline, measured from tCleared.
  // Runs CONCURRENTLY with the tail of the fault-load window so its remaining
  // seconds don't get counted as recovery time (which was inflating the number).
  progress('Measuring recovery');
  const probeC = Math.min(concurrency, 10);
  let recoverySeconds: number | null = null;
  let recovered = false;
  const recovery = (async () => {
    const recDeadline = Date.now() + recoveryTimeoutSec * 1000;
    while (Date.now() < recDeadline) {
      const check = await runAutocannon(sb, path, probeC, 1);
      if (check && isRecovered(check.errorRate, baselineErrorRate)) {
        recovered = true;
        recoverySeconds = Math.max(0, (Date.now() - tCleared) / 1000);
        return;
      }
      await sleep(500);
    }
  })();

  const faultLoad = await loadDuringFault;
  await recovery;
  const errorRateDuringFault = faultLoad?.errorRate ?? 1;

  return result({
    baselineErrorRate, baselineRps, errorRateDuringFault,
    recoverySeconds, recovered,
    reason: recovered ? undefined : `App did not return to baseline within ${recoveryTimeoutSec}s.`,
    appLogTail: recovered ? undefined : await getAppLogs(sb),
  });
}
