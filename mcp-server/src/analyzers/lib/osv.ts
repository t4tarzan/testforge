// Live supply-chain auditing via the OSV.dev database — replaces the frozen,
// JS-only hardcoded CVE list with real vulnerability data across npm, PyPI and
// Go. Parses each ecosystem's lockfiles for exact name@version, batch-queries
// OSV, and maps hits to findings. Network is OPT-IN (opts.osv) so tests stay
// offline/deterministic; production passes osv:true. Offline / timeout / error
// all degrade to an empty map (caller keeps its hardcoded fallback) — never throw.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export type OsvEcosystem = 'npm' | 'PyPI' | 'Go';
export interface OsvPkg { ecosystem: OsvEcosystem; name: string; version: string }
export interface OsvVuln { id: string }

export const osvKey = (p: { ecosystem: string; name: string; version: string }): string =>
  `${p.ecosystem}:${p.name}@${p.version}`;

// ── Lockfile parsers (pure — unit-tested without network) ──────────────────

/** requirements.txt: only exact `name==version` pins (ranges are unresolvable). */
export function parseRequirementsTxt(content: string): Array<{ name: string; version: string }> {
  const out: Array<{ name: string; version: string }> = [];
  for (const raw of content.split('\n')) {
    const line = raw.split('#')[0].trim();
    if (!line || line.startsWith('-')) continue;
    const m = line.match(/^([A-Za-z0-9._-]+)\s*==\s*([0-9][^\s;,]*)/);
    if (m) out.push({ name: m[1].toLowerCase().replace(/_/g, '-'), version: m[2] });
  }
  return out;
}

/** poetry.lock: TOML [[package]] blocks with name = "…" / version = "…". */
export function parsePoetryLock(content: string): Array<{ name: string; version: string }> {
  const out: Array<{ name: string; version: string }> = [];
  let name: string | null = null;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '[[package]]') { name = null; continue; }
    const nm = line.match(/^name\s*=\s*"([^"]+)"/);
    if (nm) { name = nm[1].toLowerCase().replace(/_/g, '-'); continue; }
    const vm = line.match(/^version\s*=\s*"([^"]+)"/);
    if (vm && name) { out.push({ name, version: vm[1] }); name = null; }
  }
  return out;
}

/** Pipfile.lock (JSON): default + develop → {pkg: {version: "==x"}}. */
export function parsePipfileLock(content: string): Array<{ name: string; version: string }> {
  const out: Array<{ name: string; version: string }> = [];
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(content); } catch { return out; }
  for (const section of ['default', 'develop']) {
    const deps = obj[section] as Record<string, { version?: string }> | undefined;
    if (!deps) continue;
    for (const [name, meta] of Object.entries(deps)) {
      const v = (meta?.version || '').replace(/^==/, '');
      if (v) out.push({ name: name.toLowerCase().replace(/_/g, '-'), version: v });
    }
  }
  return out;
}

/** go.sum: `module version hash` lines (ignore the `/go.mod` variants); dedup. */
export function parseGoSum(content: string): Array<{ name: string; version: string }> {
  const seen = new Set<string>();
  const out: Array<{ name: string; version: string }> = [];
  for (const raw of content.split('\n')) {
    const parts = raw.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const name = parts[0];
    const version = parts[1].replace(/\/go\.mod$/, '');
    if (!name.includes('.') || !/^v\d/.test(version)) continue;
    const k = `${name}@${version}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, version });
  }
  return out;
}

/** Discover PyPI + Go packages from a project's lockfiles (npm is handled by the
 *  caller via its existing lockfile graph). Capped to bound the OSV query. */
export async function collectEcosystemPackages(projectPath: string, cap = 400): Promise<OsvPkg[]> {
  const pkgs: OsvPkg[] = [];
  const read = (p: string) => { try { return readFileSync(join(projectPath, p), 'utf8'); } catch { return null; } };

  // Python
  if (existsSync(join(projectPath, 'poetry.lock'))) {
    for (const d of parsePoetryLock(read('poetry.lock') || '')) pkgs.push({ ecosystem: 'PyPI', ...d });
  }
  if (existsSync(join(projectPath, 'Pipfile.lock'))) {
    for (const d of parsePipfileLock(read('Pipfile.lock') || '')) pkgs.push({ ecosystem: 'PyPI', ...d });
  }
  try {
    const reqs = await glob('**/requirements*.txt', { cwd: projectPath, absolute: false, nodir: true, ignore: ['**/node_modules/**'] });
    for (const f of reqs.slice(0, 10)) for (const d of parseRequirementsTxt(read(f) || '')) pkgs.push({ ecosystem: 'PyPI', ...d });
  } catch { /* ignore */ }

  // Go
  if (existsSync(join(projectPath, 'go.sum'))) {
    for (const d of parseGoSum(read('go.sum') || '')) pkgs.push({ ecosystem: 'Go', ...d });
  }

  // dedup + cap
  const seen = new Set<string>();
  const uniq: OsvPkg[] = [];
  for (const p of pkgs) {
    const k = osvKey(p);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(p);
    if (uniq.length >= cap) break;
  }
  return uniq;
}

// ── OSV batch query (network; cached; offline-safe) ────────────────────────
const _cache = new Map<string, OsvVuln[]>();

export async function queryOsvBatch(pkgs: OsvPkg[], timeoutMs = 6000): Promise<Map<string, OsvVuln[]>> {
  const result = new Map<string, OsvVuln[]>();
  if (!pkgs.length) return result;

  // Serve cached, query only the rest.
  const toQuery: OsvPkg[] = [];
  for (const p of pkgs) {
    const k = osvKey(p);
    if (_cache.has(k)) { const v = _cache.get(k)!; if (v.length) result.set(k, v); }
    else toQuery.push(p);
  }
  if (!toQuery.length) return result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: toQuery.map((p) => ({ package: { ecosystem: p.ecosystem, name: p.name }, version: p.version })) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return result;
    const data = await res.json() as { results?: Array<{ vulns?: Array<{ id: string }> }> };
    const rows = data.results ?? [];
    toQuery.forEach((p, i) => {
      const vulns = (rows[i]?.vulns ?? []).map((v) => ({ id: v.id }));
      _cache.set(osvKey(p), vulns); // cache empties too, to avoid re-querying clean deps
      if (vulns.length) result.set(osvKey(p), vulns);
    });
    return result;
  } catch {
    clearTimeout(timer);
    return result; // offline / timeout / parse error → caller falls back
  }
}

/** Test-only: clear the in-process cache. */
export function _resetOsvCache(): void { _cache.clear(); }
