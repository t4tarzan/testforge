// Coherence / differential lane (antirez/news/168 tenet #6: catch output
// regressions, not just line coverage — "coherence across every GGUF").
//
// Where baselines.ts diffs aggregate metrics, this diffs *behavior per surface*:
// a fingerprint of each crawled page (status + error profile) and each named
// journey (pass/fail), persisted run-over-run. The next run flags where the app
// DIVERGED — a page that was 200 now 500, a route that vanished, a journey that
// used to pass now failing — the GGUF-coherence idea generalized to a web app.
//
// Pure here (extract + normalize + diff); persistence lives in local-db.ts.

export interface PageFingerprint {
  status: number;
  consoleErrors: number;
  pageErrors: number;
  a11yViolations: number;
}

export interface CoherenceSnapshot {
  /** path (host/scheme stripped) → fingerprint. The sandbox host/port vary per run. */
  pages?: Record<string, PageFingerprint>;
  /** journey name → passed. */
  journeys?: Record<string, boolean>;
}

export interface CoherenceDivergence {
  kind: 'page-added' | 'page-removed' | 'status-changed' | 'errors-changed' | 'journey-changed';
  surface: string;
  note: string;
  /** True when the change is unambiguously worse (regression); false when ambiguous/better. */
  regression: boolean;
}

export interface CoherenceDelta {
  divergences: CoherenceDivergence[];
  hasDivergence: boolean;
  hasRegression: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Reduce a URL to a stable, host-independent key (pathname + search). The sim
 * boots the app on an ephemeral host:port, so raw URLs never match run-to-run.
 */
export function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname || '/') + (u.search || '');
  } catch {
    // Already a path, or unparseable — strip a leading scheme://host[:port] if present.
    return url.replace(/^[a-z]+:\/\/[^/]+/i, '') || '/';
  }
}

/** Build a coherence snapshot from a Simulate result's e2e lane. Pure; tolerant of partial input. */
export function extractCoherenceSnapshot(out: Record<string, unknown> | null | undefined): CoherenceSnapshot {
  const snap: CoherenceSnapshot = {};
  const e2e = out?.e2e as Record<string, unknown> | undefined;
  if (!e2e || e2e.ranReal !== true) return snap;

  const pages = e2e.pages;
  if (Array.isArray(pages)) {
    const map: Record<string, PageFingerprint> = {};
    for (const p of pages as Record<string, unknown>[]) {
      if (typeof p?.url !== 'string') continue;
      map[normalizePath(p.url)] = {
        status: isNum(p.status) ? p.status : 0,
        consoleErrors: Array.isArray(p.consoleErrors) ? p.consoleErrors.length : 0,
        pageErrors: Array.isArray(p.pageErrors) ? p.pageErrors.length : 0,
        a11yViolations: isNum(p.a11yViolations) ? p.a11yViolations : 0,
      };
    }
    if (Object.keys(map).length) snap.pages = map;
  }

  const journeys = (e2e.journeys as Record<string, unknown> | undefined);
  if (journeys?.ranReal === true && Array.isArray(journeys.journeys)) {
    const map: Record<string, boolean> = {};
    for (const j of journeys.journeys as Record<string, unknown>[]) {
      if (typeof j?.name === 'string') map[j.name] = j.ok === true;
    }
    if (Object.keys(map).length) snap.journeys = map;
  }
  return snap;
}

const errProfile = (f: PageFingerprint) => `${f.pageErrors}pe/${f.consoleErrors}ce/${f.a11yViolations}a11y`;
const errCount = (f: PageFingerprint) => f.pageErrors + f.consoleErrors + f.a11yViolations;
const isOkStatus = (s: number) => s >= 200 && s < 400;

/**
 * Diff the current snapshot against the previous run's. Reports per-surface
 * divergence; a divergence is a regression when it's unambiguously worse
 * (status left the 2xx/3xx range, errors increased, or a journey passed→failed).
 * Pure.
 */
export function diffCoherence(prev: CoherenceSnapshot, curr: CoherenceSnapshot): CoherenceDelta {
  const divergences: CoherenceDivergence[] = [];

  const prevPages = prev.pages || {};
  const currPages = curr.pages || {};
  for (const path of Object.keys(currPages)) {
    const c = currPages[path];
    const p = prevPages[path];
    if (!p) {
      divergences.push({ kind: 'page-added', surface: path, note: `new route ${path} (status ${c.status})`, regression: false });
      continue;
    }
    if (p.status !== c.status) {
      divergences.push({
        kind: 'status-changed', surface: path,
        note: `${path} status ${p.status} → ${c.status}`,
        regression: isOkStatus(p.status) && !isOkStatus(c.status),
      });
    }
    if (errCount(c) > errCount(p)) {
      divergences.push({ kind: 'errors-changed', surface: path, note: `${path} errors ${errProfile(p)} → ${errProfile(c)}`, regression: true });
    }
  }
  for (const path of Object.keys(prevPages)) {
    if (!currPages[path]) {
      divergences.push({ kind: 'page-removed', surface: path, note: `route ${path} no longer reachable (was status ${prevPages[path].status})`, regression: true });
    }
  }

  const prevJ = prev.journeys || {};
  const currJ = curr.journeys || {};
  for (const name of Object.keys(currJ)) {
    if (name in prevJ && prevJ[name] !== currJ[name]) {
      divergences.push({
        kind: 'journey-changed', surface: name,
        note: `journey "${name}" ${prevJ[name] ? 'passed' : 'failed'} → ${currJ[name] ? 'passed' : 'failed'}`,
        regression: prevJ[name] === true && currJ[name] === false,
      });
    }
  }

  return {
    divergences,
    hasDivergence: divergences.length > 0,
    hasRegression: divergences.some((d) => d.regression),
  };
}
