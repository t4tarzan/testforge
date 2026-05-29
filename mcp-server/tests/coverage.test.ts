// Real-coverage artifact parsers (lcov / Cobertura / Istanbul) + discovery.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLcov, parseCobertura, parseIstanbulSummary, readRealCoverage } from '../src/analyzers/lib/coverage.js';

describe('coverage parsers', () => {
  it('lcov: aggregates LH/LF across files', () => {
    const lcov = 'SF:a.ts\nLF:10\nLH:8\nend_of_record\nSF:b.ts\nLF:10\nLH:2\nend_of_record\n';
    expect(parseLcov(lcov)).toEqual({ overallPct: 50, fileCount: 2 }); // 10/20
  });
  it('lcov: null when no files', () => { expect(parseLcov('TN:x\n')).toBeNull(); });
  it('cobertura: reads root line-rate', () => {
    const xml = '<?xml version="1.0"?><coverage line-rate="0.83" version="1"><classes><class filename="a.py" line-rate="0.9"/></classes></coverage>';
    expect(parseCobertura(xml)).toEqual({ overallPct: 83, fileCount: 1 });
  });
  it('istanbul summary: reads total.lines.pct', () => {
    const json = JSON.stringify({ total: { lines: { pct: 76 } }, 'src/a.ts': { lines: { pct: 90 } } });
    expect(parseIstanbulSummary(json)).toEqual({ overallPct: 76, fileCount: 1 });
  });
  it('readRealCoverage: discovers + parses lcov in a project dir', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tf-cov-'));
    try {
      writeFileSync(join(d, 'lcov.info'), 'SF:x.ts\nLF:4\nLH:3\nend_of_record\n');
      const r = await readRealCoverage(d);
      expect(r).toMatchObject({ overallPct: 75, format: 'lcov' });
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  it('readRealCoverage: null when no artifact', async () => {
    const d = mkdtempSync(join(tmpdir(), 'tf-cov-'));
    try { expect(await readRealCoverage(d)).toBeNull(); } finally { rmSync(d, { recursive: true, force: true }); }
  });
});
