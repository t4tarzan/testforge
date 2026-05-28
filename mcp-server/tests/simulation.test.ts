// Unit tests for the Phase-1 simulation engine pure logic: runnable detection
// (Dockerfile + EXPOSE parsing) and the autocannon JSON parser. The docker
// lifecycle in runLoadSimulation is exercised end-to-end on the VPS, not here.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { detectRunnable, parseExposedPorts, DEFAULT_PORT_CANDIDATES } from '../src/simulation/runnable-detect.js';
import { parseAutocannon } from '../src/simulation/sandbox.js';
import { isRecovered } from '../src/simulation/chaos-sim.js';

function tmpRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'tf-sim-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

describe('parseExposedPorts', () => {
  it('reads single and multi-port EXPOSE, strips /proto, dedupes', () => {
    expect(parseExposedPorts('FROM node\nEXPOSE 3000')).toEqual([3000]);
    expect(parseExposedPorts('EXPOSE 8080/tcp 9090/udp')).toEqual([8080, 9090]);
    expect(parseExposedPorts('EXPOSE 3000\nEXPOSE 3000')).toEqual([3000]);
  });
  it('ignores unresolvable / invalid ports', () => {
    expect(parseExposedPorts('EXPOSE $PORT')).toEqual([]);
    expect(parseExposedPorts('EXPOSE 70000')).toEqual([]);
    expect(parseExposedPorts('no expose here')).toEqual([]);
  });
});

describe('detectRunnable', () => {
  it('detects a root Dockerfile and its exposed port', () => {
    const dir = tmpRepo({ Dockerfile: 'FROM node:22-slim\nEXPOSE 8080\nCMD ["node","x.js"]' });
    try {
      const d = detectRunnable(dir);
      expect(d.runnable).toBe(true);
      expect(d.method).toBe('dockerfile');
      expect(d.exposedPorts).toEqual([8080]);
      expect(d.dockerfilePath).toBe(join(dir, 'Dockerfile'));
      expect(d.contextPath).toBe(dir);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('is runnable with no EXPOSE (probe falls back to common ports)', () => {
    const dir = tmpRepo({ Dockerfile: 'FROM nginx' });
    try {
      const d = detectRunnable(dir);
      expect(d.runnable).toBe(true);
      expect(d.exposedPorts).toEqual([]);
      expect(DEFAULT_PORT_CANDIDATES.length).toBeGreaterThan(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('flags compose-only repos as not-yet-runnable with a clear reason', () => {
    const dir = tmpRepo({ 'docker-compose.yml': 'services:\n  web:\n    image: x' });
    try {
      const d = detectRunnable(dir);
      expect(d.runnable).toBe(false);
      expect(d.reason).toMatch(/compose/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('reports not-runnable when no boot signal exists', () => {
    const dir = tmpRepo({ 'package.json': '{}' });
    try {
      const d = detectRunnable(dir);
      expect(d.runnable).toBe(false);
      expect(d.method).toBeNull();
      expect(d.reason).toMatch(/No root Dockerfile/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('parseAutocannon', () => {
  const sample = JSON.stringify({
    latency: { p50: 12, p90: 30, p99: 80, average: 15 },
    requests: { average: 4200, total: 42000 },
    '1xx': 0, '2xx': 41000, '3xx': 0, '4xx': 500, '5xx': 500,
    non2xx: 1000, errors: 0, timeouts: 0,
  });

  it('extracts headline metrics and computes errorRate from non2xx+errors+timeouts', () => {
    const r = parseAutocannon('some preamble ' + sample, 100, 10)!;
    expect(r.concurrency).toBe(100);
    expect(r.rps).toBe(4200);
    expect(r.latencyP50).toBe(12);
    expect(r.latencyP99).toBe(80);
    expect(r.totalRequests).toBe(42000);
    expect(r.errorRate).toBeCloseTo(1000 / 42000, 5);
  });

  it('returns 100% error rate when every request failed', () => {
    const allErr = JSON.stringify({ latency: {}, requests: { total: 100 }, non2xx: 0, errors: 100, timeouts: 0 });
    expect(parseAutocannon(allErr, 50, 5)!.errorRate).toBe(1);
  });

  it('returns null on unparseable output', () => {
    expect(parseAutocannon('connection refused', 10, 5)).toBeNull();
    expect(parseAutocannon('', 10, 5)).toBeNull();
  });
});

describe('chaos isRecovered', () => {
  it('treats a return to within the margin of a healthy baseline as recovered', () => {
    expect(isRecovered(0.0, 0.0)).toBe(true);   // clean again
    expect(isRecovered(0.1, 0.0)).toBe(true);   // within 0.15 margin
    expect(isRecovered(0.5, 0.0)).toBe(false);  // still failing
  });
  it('lets a fragile app recover back to its own imperfect baseline', () => {
    expect(isRecovered(0.75, 0.70)).toBe(true);   // back to ~baseline
    expect(isRecovered(1.0, 0.70)).toBe(false);   // still fully broken (>0.85)
  });
});
