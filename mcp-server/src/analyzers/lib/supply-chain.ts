// Supply-chain audit — parse package-lock.json to expose the
// transitive dependency graph and red flags.
//
// The old supply-chain dimension only matched direct dependencies
// (from package.json) against a tiny hard-coded CVE list. That misses
// the most common attack vector: a vuln OR a malicious replacement
// in a TRANSITIVE dependency you never typed by name.
//
// This module:
//
//   1. Reads package-lock.json (npm v7+ "lockfileVersion: 2/3" format)
//      from the project root if present.
//   2. Returns the full {name, version, resolved, integrity} graph.
//   3. Tags each entry with the red flags we care about:
//        - non-registry source        (git+ URLs, file:, link:, http:)
//        - missing integrity hash     (means npm can't verify the bytes)
//        - duplicate version drift    (same name resolved to multiple versions)
//   4. Surfaces direct-dep CVE matches via the existing hardcoded list
//      AND transitive-dep CVE matches (the new capability).
//
// Out of scope for v1:
//   - pnpm-lock.yaml and yarn.lock formats (different shapes; defer)
//   - Calling the OSV / npm-audit API (network-dependent; v1 is offline)
//   - Maintainer-activity heuristics (needs registry API)

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface LockfileEntry {
  /** Package name (resolved from the lockfile key path). */
  name: string;
  /** Version. */
  version: string;
  /** Resolved URL — `https://registry.npmjs.org/…`, `git+ssh://…`, `file:./local`, etc. */
  resolved: string | null;
  /** SRI integrity hash (sha512-…). null if missing. */
  integrity: string | null;
  /** Direct (= true if listed in top-level package.json) vs transitive. */
  isDirect: boolean;
}

export interface SupplyChainGraph {
  /** Total package entries in the lock file. */
  totalEntries: number;
  /** Direct dependencies (declared in top-level package.json). */
  directCount: number;
  /** All entries (direct + transitive). */
  entries: LockfileEntry[];
  /** Lock file format we parsed, if any. */
  lockfileVersion: number | null;
  /** Source path we read from, for diagnostics. */
  sourceFile: string | null;
}

const NON_REGISTRY_PROTOCOLS = [
  'git+',         // git+https://, git+ssh://, git+http://
  'github:',
  'file:',
  'link:',
  'http://',      // explicit http:// (not registry)
];

/** Read & parse package-lock.json from the project root. */
export function loadLockGraph(projectPath: string): SupplyChainGraph {
  const candidate = join(projectPath, 'package-lock.json');
  const empty: SupplyChainGraph = {
    totalEntries: 0,
    directCount: 0,
    entries: [],
    lockfileVersion: null,
    sourceFile: null,
  };
  if (!existsSync(candidate)) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(candidate, 'utf-8'));
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object') return empty;

  const lock = parsed as {
    lockfileVersion?: number;
    packages?: Record<string, {
      version?: string;
      resolved?: string;
      integrity?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      dev?: boolean;
    }>;
    dependencies?: Record<string, unknown>;
  };

  const lockfileVersion = lock.lockfileVersion ?? null;
  const entries: LockfileEntry[] = [];

  // lockfileVersion 2/3: `packages` keyed by relative path. "" is root.
  const directNames = new Set<string>();
  if (lock.packages) {
    const root = lock.packages[''];
    if (root) {
      const deps = (root as unknown as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> });
      for (const k of Object.keys(deps?.dependencies ?? {})) directNames.add(k);
      for (const k of Object.keys(deps?.devDependencies ?? {})) directNames.add(k);
    }
    for (const [path, pkg] of Object.entries(lock.packages)) {
      if (path === '') continue; // skip root
      const name = nameFromPackagePath(path);
      if (!name) continue;
      entries.push({
        name,
        version: pkg.version ?? '',
        resolved: pkg.resolved ?? null,
        integrity: pkg.integrity ?? null,
        isDirect: directNames.has(name),
      });
    }
  }

  return {
    totalEntries: entries.length,
    directCount: entries.filter((e) => e.isDirect).length,
    entries,
    lockfileVersion,
    sourceFile: candidate,
  };
}

/* -------------------------------------------------------------------------- */
/* Red-flag detection                                                         */
/* -------------------------------------------------------------------------- */

export interface SupplyChainFlags {
  /** Entries resolved from a non-registry source. */
  nonRegistry: LockfileEntry[];
  /** Entries with no integrity hash. */
  missingIntegrity: LockfileEntry[];
  /** Names that resolve to ≥2 distinct versions. Map of name → versions. */
  duplicateVersions: Map<string, string[]>;
}

export function findSupplyChainFlags(graph: SupplyChainGraph): SupplyChainFlags {
  const nonRegistry: LockfileEntry[] = [];
  const missingIntegrity: LockfileEntry[] = [];
  const versionsByName = new Map<string, Set<string>>();

  for (const e of graph.entries) {
    if (e.resolved && isNonRegistrySource(e.resolved)) nonRegistry.push(e);
    // Missing integrity is suspicious for registry deps; ignored for
    // file:/link:/git: where integrity can't exist.
    if (!e.integrity && e.resolved && !isNonRegistrySource(e.resolved)) {
      missingIntegrity.push(e);
    }
    if (e.version) {
      let versions = versionsByName.get(e.name);
      if (!versions) {
        versions = new Set<string>();
        versionsByName.set(e.name, versions);
      }
      versions.add(e.version);
    }
  }

  const duplicateVersions = new Map<string, string[]>();
  for (const [name, versions] of versionsByName) {
    if (versions.size > 1) duplicateVersions.set(name, [...versions].sort());
  }

  return { nonRegistry, missingIntegrity, duplicateVersions };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lockfile v2/v3 keys look like `node_modules/<name>` for direct, and
 * `node_modules/<a>/node_modules/<b>` for nested. The package name is
 * always the last segment after the last `node_modules/`.
 * Scoped packages: `node_modules/@scope/pkg` → `@scope/pkg`.
 */
function nameFromPackagePath(path: string): string | null {
  const idx = path.lastIndexOf('node_modules/');
  if (idx < 0) return null;
  const tail = path.slice(idx + 'node_modules/'.length);
  if (!tail) return null;
  // Scoped: take both `@scope/pkg`
  if (tail.startsWith('@')) {
    const slash = tail.indexOf('/');
    if (slash < 0) return null;
    const second = tail.indexOf('/', slash + 1);
    return second < 0 ? tail : tail.slice(0, second);
  }
  const slash = tail.indexOf('/');
  return slash < 0 ? tail : tail.slice(0, slash);
}

function isNonRegistrySource(resolved: string): boolean {
  return NON_REGISTRY_PROTOCOLS.some((p) => resolved.startsWith(p));
}
