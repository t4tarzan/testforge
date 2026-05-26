// License audit — categorize each installed dependency by SPDX license.
//
// The previous version had a "knownGPL" list containing react, vue,
// angular, moment, underscore — all of which are MIT. Spectacularly
// wrong. It also never populated the `copyleftDeps` array even though
// the public type promised to list them.
//
// This module:
//
//   1. Walks `node_modules/` (when present) and reads each package's
//      `license` field from its package.json.
//   2. Categorizes per SPDX:
//        - permissive   (MIT, ISC, Apache-2.0, BSD-*, 0BSD, CC0-*, Unlicense)
//        - copyleftWeak (LGPL-*, MPL-*, EPL-*)
//        - copyleftStrong (GPL-*, AGPL-*)
//        - proprietary  (UNLICENSED, "SEE LICENSE IN …", custom strings)
//        - unknown      (missing license field entirely)
//   3. Surfaces findings appropriate to each bucket.
//
// Out of scope (v2):
//   - License compatibility matrix (some Apache-2.0 deps are
//     incompatible with GPL-2.0 etc.)
//   - License extraction from LICENSE.txt when package.json is silent
//   - Looking up via npm registry when node_modules is absent

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export type LicenseCategory =
  | 'permissive'
  | 'copyleftWeak'
  | 'copyleftStrong'
  | 'proprietary'
  | 'unknown';

export interface PackageLicense {
  name: string;
  version: string;
  spdx: string | null;            // The raw license string from package.json
  category: LicenseCategory;
}

export interface LicenseAuditResult {
  /** Was a node_modules tree available to inspect? */
  inspected: boolean;
  /** Path we inspected (if any). */
  nodeModulesPath: string | null;
  /** All packages we found license info for. */
  packages: PackageLicense[];
  /** Counts by category. */
  byCategory: Record<LicenseCategory, number>;
}

// SPDX categorization. Patterns are case-insensitive prefixes.
const PERMISSIVE_PATTERNS = [
  'mit', 'isc', 'apache-2.0', 'apache 2.0', 'apache-1', 'bsd', '0bsd',
  'cc0-1.0', 'cc0', 'unlicense', 'wtfpl', 'beerware', 'zlib', 'python-2.0',
];
const COPYLEFT_WEAK_PATTERNS = [
  'lgpl-', 'lgpl ', 'lgpl', 'mpl-', 'mpl ', 'mpl', 'epl-', 'epl ', 'epl',
];
const COPYLEFT_STRONG_PATTERNS = [
  'gpl-', 'gpl ', 'gpl,', 'agpl-', 'agpl ', 'agpl', 'osl-', 'osl ', 'sspl',
];
const PROPRIETARY_MARKERS = [
  'unlicensed', 'see license in', 'see-license-in',
];

/** Walk node_modules and extract license info per package. */
export function auditLicenses(projectPath: string): LicenseAuditResult {
  const nodeModules = join(projectPath, 'node_modules');
  const empty: LicenseAuditResult = {
    inspected: false,
    nodeModulesPath: null,
    packages: [],
    byCategory: {
      permissive: 0, copyleftWeak: 0, copyleftStrong: 0,
      proprietary: 0, unknown: 0,
    },
  };
  if (!existsSync(nodeModules)) return empty;

  const packages: PackageLicense[] = [];
  collectPackages(nodeModules, packages);

  const byCategory: Record<LicenseCategory, number> = {
    permissive: 0, copyleftWeak: 0, copyleftStrong: 0,
    proprietary: 0, unknown: 0,
  };
  for (const p of packages) byCategory[p.category]++;

  return {
    inspected: true,
    nodeModulesPath: nodeModules,
    packages,
    byCategory,
  };
}

/* -------------------------------------------------------------------------- */
/* Categorization                                                             */
/* -------------------------------------------------------------------------- */

export function categorizeLicense(spdx: string | null): LicenseCategory {
  if (!spdx) return 'unknown';
  const s = spdx.trim().toLowerCase();
  if (s === '' || s === 'unknown') return 'unknown';

  // SPDX "OR" expressions: best-of (most permissive option counts).
  // Otherwise normalize whitespace + parens.
  const normalized = s.replace(/[()]/g, '').replace(/\s+/g, ' ');

  if (PROPRIETARY_MARKERS.some((p) => normalized.includes(p))) return 'proprietary';

  // Strong copyleft is checked BEFORE weak — LGPL is weak even though
  // it contains "gpl".
  if (COPYLEFT_STRONG_PATTERNS.some((p) =>
    normalized === p || normalized.startsWith(p) || normalized.includes(' ' + p)
  )) {
    return 'copyleftStrong';
  }
  if (COPYLEFT_WEAK_PATTERNS.some((p) =>
    normalized === p || normalized.startsWith(p) || normalized.includes(' ' + p)
  )) {
    return 'copyleftWeak';
  }
  if (PERMISSIVE_PATTERNS.some((p) =>
    normalized === p || normalized.startsWith(p) || normalized.includes(' ' + p)
  )) {
    return 'permissive';
  }

  return 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Walking node_modules                                                       */
/* -------------------------------------------------------------------------- */

function collectPackages(dir: string, out: PackageLicense[]) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === '.bin' || entry === '.cache') continue;
    const fullPath = join(dir, entry);

    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    if (!stats.isDirectory()) continue;

    // Scoped: dive into @scope/* subdirectories.
    if (entry.startsWith('@')) {
      try {
        for (const sub of readdirSync(fullPath)) {
          inspectPackageDir(join(fullPath, sub), `${entry}/${sub}`, out);
        }
      } catch {
        // skip
      }
      continue;
    }

    inspectPackageDir(fullPath, entry, out);

    // Recurse into nested node_modules so we cover hoisted-but-also-
    // locally-installed copies (npm sometimes does this for version conflicts).
    const nested = join(fullPath, 'node_modules');
    if (existsSync(nested)) collectPackages(nested, out);
  }
}

function inspectPackageDir(dir: string, name: string, out: PackageLicense[]) {
  const pkgJson = join(dir, 'package.json');
  if (!existsSync(pkgJson)) return;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(pkgJson, 'utf-8'));
  } catch {
    return;
  }
  if (!raw || typeof raw !== 'object') return;
  const p = raw as { name?: string; version?: string; license?: unknown; licenses?: unknown };
  const license = extractLicenseString(p.license, p.licenses);
  out.push({
    name: p.name ?? name,
    version: p.version ?? '',
    spdx: license,
    category: categorizeLicense(license),
  });
}

function extractLicenseString(license: unknown, licenses: unknown): string | null {
  if (typeof license === 'string') return license;
  if (license && typeof license === 'object' && typeof (license as Record<string, unknown>).type === 'string') {
    return (license as { type: string }).type;
  }
  // Legacy `licenses: [{ type, url }]`
  if (Array.isArray(licenses) && licenses.length > 0) {
    const first = licenses[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).type === 'string') {
      return (first as { type: string }).type;
    }
  }
  return null;
}
