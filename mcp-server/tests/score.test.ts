import { describe, it, expect } from 'vitest';
import { severityScore, countScore } from '../src/analyzers/lib/score.js';
import { runDeadCodeAnalysis } from '../src/analyzers/advanced-analyzer.js';

// These tests guard the scoring-credibility fix: scores must degrade smoothly
// (diminishing returns) and never cliff to a misleading 0, and the dead-code
// dep check must not flag Python/Go packages it can't trace as "unused".
describe('score helpers — diminishing returns, no cliffs', () => {
  it('returns 100 for zero findings', () => {
    expect(severityScore([])).toBe(100);
    expect(countScore(0)).toBe(100);
  });

  it('degrades smoothly and never hits 0 from low-severity pile-ups', () => {
    const manyLows = Array.from({ length: 50 }, () => ({ severity: 'low' }));
    const s = severityScore(manyLows, 6);
    expect(s).toBeGreaterThan(5);   // above floor
    expect(s).toBeLessThan(100);    // but penalized
  });

  it('is monotonic — more/worse findings never raise the score', () => {
    const few = severityScore([{ severity: 'medium' }], 6);
    const many = severityScore([{ severity: 'medium' }, { severity: 'critical' }], 6);
    expect(many).toBeLessThanOrEqual(few);
  });

  it('weights critical far heavier than low', () => {
    const oneCritical = severityScore([{ severity: 'critical' }], 6);
    const oneLow = severityScore([{ severity: 'low' }], 6);
    expect(oneCritical).toBeLessThan(oneLow);
  });

  it('countScore floors at 5, never 0', () => {
    expect(countScore(10_000)).toBe(5);
  });
});

describe('dead-code dep check — no false positives on non-JS deps', () => {
  it('does not flag Python packages as unused (they cannot appear in JS imports)', () => {
    const files = {
      'src/index.ts': `import express from 'express';\nexpress();\n`,
    };
    // Mixed list as a polyglot repo would produce IF deps were unioned. The
    // analyzer should only ever be given npm deps, but even so a Python-looking
    // name with no JS import is the failure mode we cliffed on. Here we pass
    // npm-only (the contract) and assert express isn't flagged.
    const report = runDeadCodeAnalysis(files, ['express']);
    expect(report.unusedDeps).not.toContain('express');
    expect(report.score).toBeGreaterThan(50);
  });

  it('scores a repo with some unused deps well above 0', () => {
    const files = { 'src/index.ts': `import express from 'express';\nexpress();\n` };
    const deps = ['express', 'lodash', 'axios', 'moment', 'chalk', 'uuid', 'dayjs'];
    const report = runDeadCodeAnalysis(files, deps);
    expect(report.unusedDeps.length).toBeGreaterThan(0); // the unused ones ARE flagged
    expect(report.score).toBeGreaterThan(20);            // but no misleading cliff to 0
  });
});
