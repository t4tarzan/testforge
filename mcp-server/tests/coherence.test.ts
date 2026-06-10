// Tests for the coherence / differential lane (antirez tenet #6). Extract +
// normalize + diff are pure, so no DB/sim is needed.
import { describe, it, expect } from 'vitest';
import { normalizePath, extractCoherenceSnapshot, diffCoherence } from '../src/simulation/coherence.js';

describe('normalizePath', () => {
  it('strips the ephemeral sandbox host:port, keeps path + query', () => {
    expect(normalizePath('http://172.18.0.2:3000/dashboard?tab=1')).toBe('/dashboard?tab=1');
    expect(normalizePath('https://app-host:8080/')).toBe('/');
  });
  it('passes through bare paths', () => {
    expect(normalizePath('/login')).toBe('/login');
  });
});

describe('extractCoherenceSnapshot', () => {
  it('fingerprints crawled pages and journeys from a real e2e lane', () => {
    const out = {
      e2e: {
        ranReal: true,
        pages: [
          { url: 'http://h:3000/', status: 200, consoleErrors: [], pageErrors: [], a11yViolations: 0 },
          { url: 'http://h:3000/admin', status: 200, consoleErrors: ['x'], pageErrors: [], a11yViolations: 2 },
        ],
        journeys: { ranReal: true, journeys: [{ name: 'login', ok: true }, { name: 'checkout', ok: false }] },
      },
    };
    const s = extractCoherenceSnapshot(out);
    expect(s.pages).toEqual({
      '/': { status: 200, consoleErrors: 0, pageErrors: 0, a11yViolations: 0 },
      '/admin': { status: 200, consoleErrors: 1, pageErrors: 0, a11yViolations: 2 },
    });
    expect(s.journeys).toEqual({ login: true, checkout: false });
  });

  it('ignores a lane that did not run', () => {
    expect(extractCoherenceSnapshot({ e2e: { ranReal: false } })).toEqual({});
    expect(extractCoherenceSnapshot(null)).toEqual({});
  });
});

describe('diffCoherence', () => {
  const base = {
    pages: { '/': { status: 200, consoleErrors: 0, pageErrors: 0, a11yViolations: 0 }, '/old': { status: 200, consoleErrors: 0, pageErrors: 0, a11yViolations: 0 } },
    journeys: { login: true },
  };

  it('flags a page that went from 200 to 500 as a regression', () => {
    const curr = { pages: { '/': { status: 500, consoleErrors: 0, pageErrors: 1, a11yViolations: 0 } } };
    const d = diffCoherence(base, curr);
    const status = d.divergences.find((x) => x.kind === 'status-changed');
    expect(status?.regression).toBe(true);
    expect(status?.note).toMatch(/status 200 → 500/);
    expect(d.hasRegression).toBe(true);
  });

  it('flags a removed route as a regression and an added route as non-regression', () => {
    const curr = { pages: { '/': base.pages['/'], '/new': { status: 200, consoleErrors: 0, pageErrors: 0, a11yViolations: 0 } } };
    const d = diffCoherence(base, curr);
    expect(d.divergences.find((x) => x.kind === 'page-removed' && x.surface === '/old')?.regression).toBe(true);
    expect(d.divergences.find((x) => x.kind === 'page-added' && x.surface === '/new')?.regression).toBe(false);
  });

  it('flags a journey that used to pass now failing', () => {
    const d = diffCoherence(base, { journeys: { login: false } });
    const j = d.divergences.find((x) => x.kind === 'journey-changed');
    expect(j?.regression).toBe(true);
    expect(j?.note).toMatch(/passed → failed/);
  });

  it('reports no divergence for an identical snapshot', () => {
    expect(diffCoherence(base, base)).toEqual({ divergences: [], hasDivergence: false, hasRegression: false });
  });

  it('treats increased errors on a stable page as a regression', () => {
    const curr = { pages: { '/': { status: 200, consoleErrors: 3, pageErrors: 0, a11yViolations: 0 } }, journeys: { login: true } };
    const d = diffCoherence(base, curr);
    expect(d.divergences.find((x) => x.kind === 'errors-changed')?.regression).toBe(true);
  });
});
