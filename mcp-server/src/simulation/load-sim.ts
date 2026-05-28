// Load ramp — Phase 1 of the simulation engine (see SIMULATION_ENGINE_PLAN.md).
//
// Operates on an already-prepared Sandbox (built + booted + health-checked by
// sandbox.ts): ramps autocannon concurrency against the app, stopping at the
// breaking point, and reports real latency/throughput/error metrics. The build/
// boot/teardown lifecycle lives in sandbox.ts so load + chaos can share one app.
import {
  type Sandbox, type LoadLevelResult, runAutocannon, getAppLogs, warmup,
} from './sandbox.js';

const DEFAULT_LEVELS = [10, 50, 100, 250, 500];
const DEFAULT_DURATION_SEC = 10;
// A level "breaks" when this share of requests fail (non-2xx + connection
// errors). Crossing it defines the breaking-point concurrency.
const BREAK_ERROR_RATE = 0.05;

export interface LoadSimResult {
  /** True only when we genuinely booted the app and drove real traffic. */
  ranReal: boolean;
  method: 'dockerfile';
  /** Port the app answered on. */
  targetPort: number;
  /** Path the ramp drove traffic against. */
  path: string;
  // Headline metrics from the last level executed (the breaking point if it
  // broke, else the max level). autocannon has no p95 → we surface p90 + p99.
  p50: number;
  p90: number;
  p99: number;
  rps: number;
  errorRate: number;
  /** First concurrency whose errorRate crossed the threshold; null = never broke. */
  breakingPointConcurrency: number | null;
  /** Per-level detail so the UI can draw the latency/throughput curve. */
  levels: LoadLevelResult[];
  durationMs: number;
  /** Set when the ramp couldn't produce usable results despite a booted app. */
  reason?: string;
  appLogTail?: string;
}

export interface LoadRampOptions {
  /** Paths discovered in source; the ramp drives the first one (default '/'). */
  paths?: string[];
  /** Concurrency ramp. */
  concurrencyLevels?: number[];
  /** Seconds of traffic per level. */
  durationPerLevelSec?: number;
  onProgress?: (detail: string) => void;
}

/** Drive a concurrency ramp against a prepared sandbox until it breaks. */
export async function runLoadRamp(sb: Sandbox, opts: LoadRampOptions = {}): Promise<LoadSimResult> {
  const t0 = Date.now();
  const levels = opts.concurrencyLevels?.length ? opts.concurrencyLevels : DEFAULT_LEVELS;
  const durationSec = opts.durationPerLevelSec ?? DEFAULT_DURATION_SEC;
  const path = (opts.paths && opts.paths.length ? opts.paths[0] : '/') || '/';
  const progress = opts.onProgress ?? (() => undefined);

  // Warm the app to steady state so the first measured level isn't skewed by
  // cold-start connection drops.
  progress('Warming up the app');
  await warmup(sb, path);

  const results: LoadLevelResult[] = [];
  let breakingPoint: number | null = null;
  for (const c of levels) {
    progress(`Driving load at concurrency ${c} for ${durationSec}s`);
    const lvl = await runAutocannon(sb, path, c, durationSec);
    if (!lvl) {
      // An unparseable run = the driver couldn't get a clean result at this
      // load. Record nothing fake; treat it as the breaking point and stop.
      breakingPoint = c;
      break;
    }
    results.push(lvl);
    if (lvl.errorRate > BREAK_ERROR_RATE) { breakingPoint = c; break; }
  }

  if (results.length === 0) {
    return {
      ranReal: true, method: 'dockerfile', targetPort: sb.targetPort, path,
      p50: 0, p90: 0, p99: 0, rps: 0, errorRate: 1, breakingPointConcurrency: breakingPoint,
      levels: [], durationMs: Date.now() - t0,
      reason: 'Load driver produced no usable results.', appLogTail: await getAppLogs(sb),
    };
  }

  const headline = results[results.length - 1];
  return {
    ranReal: true,
    method: 'dockerfile',
    targetPort: sb.targetPort,
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
}
