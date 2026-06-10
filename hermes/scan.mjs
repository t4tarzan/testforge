#!/usr/bin/env node
// TestForge Flywheel — GATHER step.
//
// One call → ranked-findings JSON for the proposer (docs/flywheel/proposer-prompt.md).
// Runs the *current local* analyzer (mcp-server/dist/index.js on :33221, the same
// analyzer send-digest.mjs uses — the live managed MCP can lag) against:
//   1. TestForge itself  (POST /analyze {projectPath: <repo root>})
//   2. one date-rotating public showcase repo (POST /clone-and-analyze {repoUrl,branch})
// and emits the proposer-shaped findings bundle.
//
// This is the flywheel's "gather" step (Flywheel.md §The L0 cycle, step 1).
// It changes nothing — pure read + analyze + write JSON.
//
// Usage:
//   node hermes/scan.mjs                 # analyze self + today's showcase repo → state/findings.json
//   node hermes/scan.mjs --print         # also print the JSON to stdout
//   node hermes/scan.mjs --self-only     # skip the showcase repo (faster, offline-ish)
//   node hermes/scan.mjs --repo owner/x  # force a specific showcase repo (github shorthand or full url)
//   node hermes/scan.mjs --base origin/main  # diff-scope the self-scan: report regressions vs this ref
//                                             # (also via TESTFORGE_BASE_REF). Default: whole-tree scan.
//   flags: --out <path> (default hermes/state/findings.json) --timeout <ms>
//
// Exit non-zero only if NOTHING analyzed (so a flaky clone of the showcase repo
// doesn't kill a cycle that still got a clean self-scan).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MCP = process.env.TESTFORGE_MCP || 'http://localhost:33221';

// ── flags ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const PRINT = has('--print');
const SELF_ONLY = has('--self-only');
const FORCE_REPO = val('--repo', null);
const OUT = path.resolve(val('--out', path.join(__dirname, 'state', 'findings.json')));
const TIMEOUT = parseInt(val('--timeout', '180000'), 10);
// Diff-scoped self-scan: when set, grade the self target against this base ref
// so the proposer sees regressions-per-change, not the whole tracked tree.
// Default null → whole-tree scan, byte-for-byte as before.
const BASE_REF = val('--base', process.env.TESTFORGE_BASE_REF || null);

const log = (...a) => console.error('[scan]', ...a); // logs to stderr; stdout is reserved for --print

// ── rotating showcase pool (mirrors scripts/send-digest.mjs: small/medium,
//    fast to clone+analyze, polyglot JS/TS · Python · Go) ────────────────────
const POOL = [
  { url: 'https://github.com/lukeed/clsx', branch: 'master', lang: 'TypeScript' },
  { url: 'https://github.com/sindresorhus/slugify', branch: 'main', lang: 'JavaScript' },
  { url: 'https://github.com/colinhacks/zod', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/pmndrs/zustand', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/tj/commander.js', branch: 'master', lang: 'JavaScript' },
  { url: 'https://github.com/honojs/hono', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/developit/mitt', branch: 'main', lang: 'TypeScript' },
  { url: 'https://github.com/lukeed/uvu', branch: 'master', lang: 'JavaScript' },
  { url: 'https://github.com/pallets/click', branch: 'main', lang: 'Python' },
  { url: 'https://github.com/tiangolo/typer', branch: 'master', lang: 'Python' },
  { url: 'https://github.com/encode/httpx', branch: 'master', lang: 'Python' },
  { url: 'https://github.com/python-attrs/attrs', branch: 'main', lang: 'Python' },
  { url: 'https://github.com/spf13/cobra', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/gorilla/mux', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/urfave/cli', branch: 'main', lang: 'Go' },
  { url: 'https://github.com/sindresorhus/ky', branch: 'main', lang: 'TypeScript' },
];

function dayOfYear(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
}

// One showcase repo per day, rotating deterministically through the pool.
function pickShowcase() {
  if (FORCE_REPO) {
    const url = FORCE_REPO.startsWith('http') ? FORCE_REPO : `https://github.com/${FORCE_REPO}`;
    const known = POOL.find((p) => p.url === url);
    return known || { url, branch: 'main', lang: 'unknown' };
  }
  return POOL[dayOfYear() % POOL.length];
}

// ── ensure the local analyzer is up (lifted from scripts/send-digest.mjs) ────
async function ensureMcp() {
  try {
    const h = await fetch(`${MCP}/health`, { signal: AbortSignal.timeout(3000) });
    if (h.ok) return false; // already running, not ours to stop
  } catch { /* not running */ }
  if (MCP !== 'http://localhost:33221') {
    throw new Error(`no MCP at ${MCP} and it is not the local default — start it yourself`);
  }
  log('starting local MCP (mcp-server/dist/index.js on :33221)…');
  // process.execPath (not "node") so this works under launchd/cron where PATH
  // is not the login shell's.
  const child = spawn(process.execPath, ['mcp-server/dist/index.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: '33221' },
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const h = await fetch(`${MCP}/health`, { signal: AbortSignal.timeout(2000) });
      if (h.ok) return true;
    } catch { /* keep waiting */ }
  }
  throw new Error('local MCP did not come up on :33221');
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v || 0)));

// Per-dimension score extractors — mirrors scripts/generate-showcase-report.sh
// so the flywheel grades a target the same way the public showcase does.
// `null` means "not applicable for this project type" (analyzer sets applicable:false).
const DIMENSIONS = [
  ['security', 'Security', (r) => clamp(100 - (r.security?.critical || 0) * 20 - (r.security?.high || 0) * 5)],
  ['unit', 'Unit Tests', (r) => clamp(r.unit?.coverage)],
  ['accessibility', 'Accessibility', (r) => (r.accessibility?.applicable === false ? null : clamp(r.accessibility?.score))],
  ['vision', 'Vision', (r) => clamp(r.vision?.score)],
  ['scope', 'Scope', (r) => clamp(r.scope?.coverage)],
  ['stack', 'Stack', (r) => clamp(r.stack?.score)],
  ['chaos', 'Chaos / Resilience', (r) => clamp(r.chaos?.score)],
  ['mutation', 'Mutation', (r) => clamp(r.mutation?.score)],
  ['predictive', 'Predictive Risk', (r) => clamp(r.predictive?.score)],
  ['supplyChain', 'Supply Chain', (r) => clamp(r.supplyChain?.score)],
  ['dora', 'DORA', (r) => clamp(r.dora?.score)],
  ['agentic', 'Agentic Scale', (r) => clamp(r.agentic?.score)],
];

// Strip the analyzer's clone/export prefix so file paths are repo-relative.
function cleanPath(p, base) {
  let s = String(p || '').replace(/^.*?\/testforge-repos\/[^/]+\//, '');
  if (base) s = s.replace(base.replace(/\/$/, '') + '/', '');
  return s.replace(REPO_ROOT + '/', '');
}

// Distill a raw analyzer response into the proposer's per-target shape.
// `meta._base` is the path that was analyzed (temp export dir for self) so
// finding paths come out repo-relative.
function distill(raw, meta) {
  const dimensions = {};
  for (const [key, , fn] of DIMENSIONS) {
    try { dimensions[key] = fn(raw); } catch { dimensions[key] = null; }
  }
  const applicable = Object.values(dimensions).filter((v) => v !== null);
  const overall = applicable.length ? Math.round(applicable.reduce((a, b) => a + b, 0) / applicable.length) : 0;

  // ── unified findings ───────────────────────────────────────────────────
  // Every dimension that emits a findings[] array (vision, chaos, agentic, …)
  // is a per-finding source, not just security. Merge them all, tagged by
  // dimension, so the proposer sees the whole picture — security came back
  // clean on self, but chaos/agentic/vision did not. The proposer is still
  // bound by the no-cry-wolf rules in the prompt.
  // Diff-scoped: /analyze returns changedSurface.files (repo-relative) when a
  // baseRef was diffed. Flag findings whose file the diff touched so the
  // proposer can focus on regressions-per-change (file-level — the API exposes
  // changed files, not line ranges).
  const cs = raw.changedSurface && raw.changedSurface.available ? raw.changedSurface : null;
  const changedFiles = new Set(cs ? cs.files || [] : []);
  const norm = (dim, i) => {
    const filePath = i.filePath ? cleanPath(i.filePath, meta._base) : null;
    return {
      dimension: dim,
      severity: i.severity || 'info',
      title: i.title,
      category: i.category || null,
      description: (i.description || '').slice(0, 400),
      filePath,
      lineNumber: i.lineNumber ?? null,
      fixSuggestion: (i.fixSuggestion || '').slice(0, 400),
      ...(cs ? { changedFile: filePath != null && changedFiles.has(filePath) } : {}),
    };
  };
  const findings = [
    // security uses `items`; cap it — a noisy repo can return thousands.
    ...(raw.security?.items || []).slice(0, 25).map((i) => norm('security', i)),
  ];
  for (const [dim, d] of Object.entries(raw)) {
    if (dim !== 'security' && d && Array.isArray(d.findings)) {
      findings.push(...d.findings.map((i) => norm(dim, i)));
    }
  }

  // ── signals ────────────────────────────────────────────────────────────
  // Actionable data that ISN'T a findings[] array: recommendation lists,
  // stack strengths/weaknesses, and the headline metrics behind low scores.
  // Defensive optional access so a renamed/dropped dimension just goes absent.
  const list = (a) => (Array.isArray(a) ? a : []);
  const signals = {
    stack: { weaknesses: list(raw.stack?.weaknesses), recommendations: list(raw.stack?.recommendations) },
    load: { rateLimiting: raw.load?.rateLimiting ?? null, caching: raw.load?.caching ?? null, recommendations: list(raw.load?.recommendations) },
    dora: { deploymentFreq: raw.dora?.deploymentFreq, leadTime: raw.dora?.leadTime, mttr: raw.dora?.mttr, changeFailRate: raw.dora?.changeFailRate },
    supplyChain: { knownVulnerable: raw.supplyChain?.knownVulnerable ?? null },
    deadCode: { unusedDeps: list(raw.deadCode?.unusedDeps) },
    mutation: { killed: raw.mutation?.killedMutants ?? null, total: raw.mutation?.totalMutants ?? null },
    predictive: { riskLevel: raw.predictive?.riskLevel, predictedFailures: raw.predictive?.predictedFailures ?? null },
    nPlusOne: { potential: raw.nPlusOne?.potentialNPlusOne ?? null },
    owasp: { coverage: raw.owasp?.coverage ?? null, missingCategories: list(raw.owasp?.missingCategories) },
    scope: { missingFeatures: list(raw.scope?.missingFeatures) },
    unit: { coverage: raw.unit?.coverage ?? null, totalTests: raw.unit?.totalTests ?? null, frameworks: list(raw.unit?.frameworks) },
    agentic: { bottleneck: raw.agentic?.predictedBottleneck, failurePatterns: list(raw.agentic?.failurePatterns) },
  };

  const { _base, ...cleanMeta } = meta;
  return {
    ...cleanMeta,
    overall,
    dimensions,
    security: {
      findings: raw.security?.findings ?? 0,
      critical: raw.security?.critical || 0,
      high: raw.security?.high || 0,
      medium: raw.security?.medium || 0,
      low: raw.security?.low || 0,
    },
    codebase: {
      totalFiles: raw.codebase?.totalFiles ?? null,
      totalLines: raw.codebase?.totalLines ?? null,
      techStack: raw.codebase?.techStack || [],
      languageCoverage: raw.codebase?.languageCoverage ?? null,
    },
    findings,
    signals,
    // Present only on a diff-scoped run: { baseRef, comparison, changedFiles,
    // files, regressionRisk:{<dim>:count} } — the regressions this change introduced.
    changedSurface: cs || null,
  };
}

// Export the *tracked* source tree (git archive HEAD) to a temp dir so the
// self-scan grades the source we actually maintain — not gitignored build
// artifacts (mcp-server/dist/) or vendored node_modules, which otherwise drown
// the proposer in thousands of phantom "criticals". This mirrors how external
// showcase repos are graded (shallow clone = tracked files, no installed deps).
// Falls back to analyzing REPO_ROOT in place if git/archive is unavailable.
function cleanSelfTree() {
  // Diff-scoped mode: a local CLONE carries .git + history (so /analyze can diff
  // against BASE_REF) while still excluding gitignored build artifacts — a clone
  // is committed tracked files only, same cleanliness as archive. Slightly
  // heavier, so only when BASE_REF is set.
  if (BASE_REF) {
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'testforge-self-'));
    const r = spawnSync('git', ['clone', '--quiet', '--no-hardlinks', REPO_ROOT, dest], { encoding: 'utf8' });
    if (r.status === 0) return { dir: dest, cleanup: () => fs.rmSync(dest, { recursive: true, force: true }) };
    log(`  ! git clone for diff-scope failed (${(r.stderr || '').trim() || 'unknown'}) — falling back to archive (whole-tree)`);
    fs.rmSync(dest, { recursive: true, force: true });
  }
  // Default: export the *tracked* tree (git archive HEAD) — no .git, no diff.
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'testforge-self-'));
  const r = spawnSync('bash', ['-c', `git -C ${JSON.stringify(REPO_ROOT)} archive HEAD | tar -x -C ${JSON.stringify(dest)}`], { encoding: 'utf8' });
  if (r.status !== 0) {
    log(`  ! git archive failed (${(r.stderr || '').trim() || 'unknown'}) — analyzing REPO_ROOT in place (may include build artifacts)`);
    fs.rmSync(dest, { recursive: true, force: true });
    return { dir: REPO_ROOT, cleanup: () => {} };
  }
  return { dir: dest, cleanup: () => fs.rmSync(dest, { recursive: true, force: true }) };
}

async function analyzeSelf() {
  const { dir, cleanup } = cleanSelfTree();
  const diffScoped = !!BASE_REF && dir !== REPO_ROOT;
  log(`analyzing self (tracked tree) via /analyze${dir === REPO_ROOT ? ' [in place]' : ''}${diffScoped ? ` [diff-scoped vs ${BASE_REF}]` : ''}…`);
  try {
    const res = await fetch(`${MCP}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(diffScoped ? { projectPath: dir, baseRef: BASE_REF } : { projectPath: dir }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return distill(data, { name: 'whitenoise/testforge', kind: 'self', url: null, lang: 'TypeScript', _base: dir });
  } finally {
    cleanup();
  }
}

async function analyzeShowcase(pick) {
  log(`analyzing showcase ${pick.url} (${pick.lang}) via /clone-and-analyze…`);
  const res = await fetch(`${MCP}/clone-and-analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl: pick.url, branch: pick.branch }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return distill(data, {
    name: pick.url.replace('https://github.com/', ''),
    kind: 'showcase',
    url: pick.url,
    lang: pick.lang,
  });
}

async function main() {
  const startedAt = new Date().toISOString();
  await ensureMcp();

  const targets = [];

  try {
    targets.push(await analyzeSelf());
    const self = targets[0];
    const cs = self.changedSurface;
    log(`  ✓ self — overall ${self.overall}, ${self.security.findings} sec finding(s)`
      + (cs ? ` · diff-scoped vs ${cs.baseRef} (${cs.comparison}): ${cs.changedFiles} changed file(s), regressionRisk ${JSON.stringify(cs.regressionRisk || {})}` : ''));
  } catch (e) {
    log(`  ✗ self — ${e.message}`);
  }

  if (!SELF_ONLY) {
    const pick = pickShowcase();
    try {
      const t = await analyzeShowcase(pick);
      targets.push(t);
      log(`  ✓ ${t.name} — overall ${t.overall}, ${t.security.findings} sec finding(s)`);
    } catch (e) {
      log(`  ✗ ${pick.url} — ${e.message} (continuing with self only)`);
    }
  }

  if (targets.length === 0) {
    log('nothing analyzed — aborting');
    process.exit(1);
  }

  const bundle = {
    generatedAt: startedAt,
    analyzer: MCP,
    showcase: SELF_ONLY ? null : targets.find((t) => t.kind === 'showcase')?.name || null,
    targets,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2));
  log(`wrote ${OUT} (${targets.length} target(s))`);
  if (PRINT) process.stdout.write(JSON.stringify(bundle, null, 2) + '\n');
}

main().catch((e) => { log('FATAL:', e.message); process.exit(1); });
