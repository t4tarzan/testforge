// Persisted baselines + regression deltas (antirez/news/168: "track baselines
// dynamically" — speed/coherence regressions caught by comparing to the last run).
//
// A Simulate run distills to a flat SimMetrics snapshot; we persist it keyed by
// repo+branch+dimensions, and on the next run diff against the previous snapshot
// to surface regressions (latency up, throughput down, errors up, chaos slower
// to recover, fewer healthy agents, journeys that used to pass now failing).
//
// Pure here (extract + compare); persistence lives in local-db.ts.

export interface SimMetrics {
  load?: { p50?: number; p99?: number; rps?: number; errorRate?: number; breakingPointConcurrency?: number | null };
  chaos?: { errorRateDuringFault?: number; recoverySeconds?: number | null; recovered?: boolean };
  agent?: { maxHealthyAgents?: number | null };
  e2e?: { consoleErrors?: number; pageErrors?: number; httpErrors?: number; a11yViolations?: number };
  journeys?: { journeysRun?: number; journeysPassed?: number };
}

export interface MetricDelta {
  metric: string;
  from: number;
  to: number;
  /** Signed % change vs the previous run (omitted when `from` is 0). */
  pct?: number;
  regression: boolean;
  note: string;
}

export interface BaselineDelta {
  /** Human-readable regression lines (the subset of deltas that worsened past threshold). */
  regressions: string[];
  /** Every metric that moved, regression or not (for the UI/curve). */
  deltas: MetricDelta[];
  hasRegression: boolean;
}

// Thresholds — tuned to ignore run-to-run noise, flag real movement.
const LAT_REGRESS_PCT = 0.20;     // p50/p99 slower by >20%
const RPS_REGRESS_PCT = 0.20;     // throughput down >20%
const ERR_REGRESS_ABS = 0.05;     // error rate up >5 percentage points
const RECOVERY_REGRESS_PCT = 0.50; // chaos recovery >50% slower

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Distill a Simulate result's lane blocks into a flat metrics snapshot. Only
 * lanes that actually ran (ranReal) contribute. Pure; tolerant of partial input. */
export function extractSimMetrics(out: Record<string, unknown> | null | undefined): SimMetrics {
  const m: SimMetrics = {};
  if (!out) return m;
  const ran = (o: unknown): o is Record<string, unknown> =>
    !!o && typeof o === 'object' && (o as { ranReal?: boolean }).ranReal === true;

  const load = out.load;
  if (ran(load)) {
    m.load = {};
    if (isNum(load.p50)) m.load.p50 = load.p50;
    if (isNum(load.p99)) m.load.p99 = load.p99;
    if (isNum(load.rps)) m.load.rps = load.rps;
    if (isNum(load.errorRate)) m.load.errorRate = load.errorRate;
    m.load.breakingPointConcurrency = isNum(load.breakingPointConcurrency) ? load.breakingPointConcurrency : null;
  }
  const chaos = out.chaos;
  if (ran(chaos)) {
    m.chaos = {};
    if (isNum(chaos.errorRateDuringFault)) m.chaos.errorRateDuringFault = chaos.errorRateDuringFault;
    m.chaos.recoverySeconds = isNum(chaos.recoverySeconds) ? chaos.recoverySeconds : null;
    if (typeof chaos.recovered === 'boolean') m.chaos.recovered = chaos.recovered;
  }
  const agent = out.agent;
  if (ran(agent)) {
    m.agent = { maxHealthyAgents: isNum(agent.maxHealthyAgents) ? agent.maxHealthyAgents : null };
  }
  const e2e = out.e2e;
  if (ran(e2e)) {
    m.e2e = {};
    if (isNum(e2e.consoleErrors)) m.e2e.consoleErrors = e2e.consoleErrors;
    if (isNum(e2e.pageErrors)) m.e2e.pageErrors = e2e.pageErrors;
    if (isNum(e2e.httpErrors)) m.e2e.httpErrors = e2e.httpErrors;
    if (isNum(e2e.a11yViolations)) m.e2e.a11yViolations = e2e.a11yViolations;
    const j = (e2e as { journeys?: unknown }).journeys;
    if (ran(j)) {
      m.journeys = {};
      if (isNum(j.journeysRun)) m.journeys.journeysRun = j.journeysRun;
      if (isNum(j.journeysPassed)) m.journeys.journeysPassed = j.journeysPassed;
    }
  }
  return m;
}

function pct(from: number, to: number): number | undefined {
  return from === 0 ? undefined : Math.round(((to - from) / Math.abs(from)) * 100);
}

/**
 * Compare the current snapshot against the previous run's baseline. A metric is
 * a regression when it worsened past its threshold (latency/errors/recovery up,
 * throughput/healthy-agents/journeys-passed down, app started breaking, or chaos
 * recovery flipped to "did not recover"). Pure.
 */
export function computeBaselineDelta(prev: SimMetrics, curr: SimMetrics): BaselineDelta {
  const deltas: MetricDelta[] = [];
  const regressions: string[] = [];

  const push = (metric: string, from: number, to: number, regression: boolean, note: string) => {
    if (from === to) return;
    const d: MetricDelta = { metric, from, to, regression, note };
    const p = pct(from, to);
    if (p !== undefined) d.pct = p;
    deltas.push(d);
    if (regression) regressions.push(note);
  };
  const higherWorse = (metric: string, from?: number, to?: number, thresholdPct = 0) => {
    if (!isNum(from) || !isNum(to)) return;
    const worse = to > from && (from === 0 ? to > 0 : (to - from) / Math.abs(from) > thresholdPct);
    push(metric, from, to, worse, `${metric} ${from} → ${to}${worse ? ' (regression)' : ''}`);
  };
  const lowerWorse = (metric: string, from?: number, to?: number, thresholdPct = 0) => {
    if (!isNum(from) || !isNum(to)) return;
    const worse = to < from && (from === 0 ? false : (from - to) / Math.abs(from) > thresholdPct);
    push(metric, from, to, worse, `${metric} ${from} → ${to}${worse ? ' (regression)' : ''}`);
  };

  // Load
  higherWorse('load.p50', prev.load?.p50, curr.load?.p50, LAT_REGRESS_PCT);
  higherWorse('load.p99', prev.load?.p99, curr.load?.p99, LAT_REGRESS_PCT);
  lowerWorse('load.rps', prev.load?.rps, curr.load?.rps, RPS_REGRESS_PCT);
  if (isNum(prev.load?.errorRate) && isNum(curr.load?.errorRate)) {
    const worse = curr.load!.errorRate! - prev.load!.errorRate! > ERR_REGRESS_ABS;
    push('load.errorRate', prev.load!.errorRate!, curr.load!.errorRate!, worse, `load.errorRate ${prev.load!.errorRate} → ${curr.load!.errorRate}${worse ? ' (regression)' : ''}`);
  }
  // Started breaking, or breaks at a lower concurrency than before.
  {
    const f = prev.load?.breakingPointConcurrency ?? null;
    const t = curr.load?.breakingPointConcurrency ?? null;
    if (f === null && isNum(t)) regressions.push(`load.breakingPointConcurrency none → ${t} (now breaks under load) (regression)`);
    else if (isNum(f) && isNum(t) && t < f) regressions.push(`load.breakingPointConcurrency ${f} → ${t} (breaks sooner) (regression)`);
  }

  // Chaos
  higherWorse('chaos.errorRateDuringFault', prev.chaos?.errorRateDuringFault, curr.chaos?.errorRateDuringFault, 0);
  higherWorse('chaos.recoverySeconds', prev.chaos?.recoverySeconds ?? undefined, curr.chaos?.recoverySeconds ?? undefined, RECOVERY_REGRESS_PCT);
  if (prev.chaos?.recovered === true && curr.chaos?.recovered === false) {
    regressions.push('chaos.recovered true → false (no longer recovers from the fault) (regression)');
  }

  // Agent / E2E / journeys
  lowerWorse('agent.maxHealthyAgents', prev.agent?.maxHealthyAgents ?? undefined, curr.agent?.maxHealthyAgents ?? undefined, 0);
  higherWorse('e2e.consoleErrors', prev.e2e?.consoleErrors, curr.e2e?.consoleErrors, 0);
  higherWorse('e2e.pageErrors', prev.e2e?.pageErrors, curr.e2e?.pageErrors, 0);
  higherWorse('e2e.httpErrors', prev.e2e?.httpErrors, curr.e2e?.httpErrors, 0);
  higherWorse('e2e.a11yViolations', prev.e2e?.a11yViolations, curr.e2e?.a11yViolations, 0);
  lowerWorse('journeys.journeysPassed', prev.journeys?.journeysPassed, curr.journeys?.journeysPassed, 0);

  return { regressions, deltas, hasRegression: regressions.length > 0 };
}

/** Stable identity for a baseline lineage: same repo + branch + dimension set. */
export function baselineKey(repo: string, branch: string | undefined, dimensions: string[]): string {
  return [repo, branch || 'default', [...dimensions].sort().join('+')].join('::');
}
