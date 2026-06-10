// Tests for persisted-baseline regression deltas (antirez tenet #7). The
// extract + compare are pure, so no DB/sim is needed.
import { describe, it, expect } from 'vitest';
import { extractSimMetrics, computeBaselineDelta, baselineKey } from '../src/simulation/baselines.js';

describe('extractSimMetrics', () => {
  it('pulls metrics only from lanes that actually ran (ranReal)', () => {
    const out = {
      load: { ranReal: true, p50: 12, p99: 80, rps: 2200, errorRate: 0.01, breakingPointConcurrency: null },
      chaos: { ranReal: false, reason: 'did not boot' }, // ignored
      e2e: { ranReal: true, consoleErrors: 0, pageErrors: 1, httpErrors: 2, a11yViolations: 3,
             journeys: { ranReal: true, journeysRun: 3, journeysPassed: 3 } },
    };
    const m = extractSimMetrics(out);
    expect(m.load).toEqual({ p50: 12, p99: 80, rps: 2200, errorRate: 0.01, breakingPointConcurrency: null });
    expect(m.chaos).toBeUndefined();
    expect(m.e2e).toEqual({ consoleErrors: 0, pageErrors: 1, httpErrors: 2, a11yViolations: 3 });
    expect(m.journeys).toEqual({ journeysRun: 3, journeysPassed: 3 });
  });

  it('returns empty for null/empty input', () => {
    expect(extractSimMetrics(null)).toEqual({});
    expect(extractSimMetrics({})).toEqual({});
  });
});

describe('computeBaselineDelta', () => {
  it('flags latency up, throughput down, errors up', () => {
    const prev = { load: { p99: 80, rps: 2200, errorRate: 0.01 } };
    const curr = { load: { p99: 130, rps: 1500, errorRate: 0.10 } }; // +62% lat, -32% rps, +9pp err
    const d = computeBaselineDelta(prev, curr);
    expect(d.hasRegression).toBe(true);
    expect(d.regressions.join('\n')).toMatch(/load\.p99/);
    expect(d.regressions.join('\n')).toMatch(/load\.rps/);
    expect(d.regressions.join('\n')).toMatch(/load\.errorRate/);
  });

  it('does NOT flag noise under threshold, and never flags improvements', () => {
    const prev = { load: { p99: 100, rps: 2000, errorRate: 0.02 } };
    const curr = { load: { p99: 110, rps: 1900, errorRate: 0.02 } }; // +10% lat, -5% rps — under threshold
    const d = computeBaselineDelta(prev, curr);
    expect(d.hasRegression).toBe(false);
    // movement is still recorded as deltas, just not regressions
    expect(d.deltas.some((x) => x.metric === 'load.p99')).toBe(true);

    // a clear improvement (faster, more rps) is never a regression
    const better = computeBaselineDelta({ load: { p99: 200, rps: 1000 } }, { load: { p99: 50, rps: 3000 } });
    expect(better.hasRegression).toBe(false);
  });

  it('flags the app starting to break under load', () => {
    const d = computeBaselineDelta(
      { load: { breakingPointConcurrency: null } },
      { load: { breakingPointConcurrency: 300 } },
    );
    expect(d.hasRegression).toBe(true);
    expect(d.regressions.join('\n')).toMatch(/now breaks under load/);
  });

  it('flags chaos that no longer recovers', () => {
    const d = computeBaselineDelta({ chaos: { recovered: true } }, { chaos: { recovered: false } });
    expect(d.regressions.join('\n')).toMatch(/no longer recovers/);
  });

  it('flags a journey that used to pass now failing', () => {
    const d = computeBaselineDelta(
      { journeys: { journeysRun: 3, journeysPassed: 3 } },
      { journeys: { journeysRun: 3, journeysPassed: 2 } },
    );
    expect(d.hasRegression).toBe(true);
    expect(d.regressions.join('\n')).toMatch(/journeys\.journeysPassed 3 → 2/);
  });

  it('is a no-op when nothing changed', () => {
    const m = { load: { p99: 80, rps: 2200 } };
    expect(computeBaselineDelta(m, m)).toEqual({ regressions: [], deltas: [], hasRegression: false });
  });
});

describe('baselineKey', () => {
  it('is stable and dimension-order-independent', () => {
    expect(baselineKey('https://x/y', 'main', ['load', 'chaos']))
      .toBe(baselineKey('https://x/y', 'main', ['chaos', 'load']));
    expect(baselineKey('https://x/y', undefined, ['load'])).toBe('https://x/y::default::load');
  });
});
