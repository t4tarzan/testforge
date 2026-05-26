// Module resolution for intra-project (relative) imports.
//
// Phase 4b uses this to map an `import { x } from './helper'` line at
// `a/b/caller.ts` to the actual file we collected a summary for. We
// deliberately only handle RELATIVE specifiers — node_modules
// resolution + tsconfig `paths` are explicit non-goals; they'd pull in
// a much larger dependency tree without proportional value.
//
// Resolution order matches what Node + TS bundlers do for most repos:
//
//   `./helper`       →
//     ./helper.ts, ./helper.tsx, ./helper.mts, ./helper.cts,
//     ./helper.js, ./helper.jsx, ./helper.mjs, ./helper.cjs,
//     ./helper/index.ts, ./helper/index.js, …
//
// Caller supplies the candidate file list — we operate on
// already-known paths from `fileContents`, no disk I/O.

const EXT_ORDER = [
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
];

/** Returns the resolved file path (from the candidates) or null. */
export function resolveRelativeImport(
  fromFile: string,
  specifier: string,
  candidates: Set<string>
): string | null {
  // Bare specifier (no `./` or `../`) → not handled here
  if (!specifier.startsWith('.')) return null;

  // Strip a trailing slash, then strip the extension if the user
  // explicitly wrote it (we'll try both forms).
  const baseDir = dirname(fromFile);
  const joined = normalizePath(joinPath(baseDir, specifier));

  // 1. Exact match (with extension, as written).
  if (candidates.has(joined)) return joined;

  // 2. Append each known extension.
  for (const ext of EXT_ORDER) {
    const candidate = joined + ext;
    if (candidates.has(candidate)) return candidate;
  }

  // 3. Maybe it's a directory — try /index.{ts,tsx,…}.
  for (const ext of EXT_ORDER) {
    const candidate = joined + '/index' + ext;
    if (candidates.has(candidate)) return candidate;
  }

  // 4. Last-resort: try replacing a written extension (e.g. specifier
  //    `./helper.js` when the file is actually `./helper.ts` — common
  //    pattern in TS projects that emit JS).
  const stripped = joined.replace(/\.(?:[jt]sx?|[mc][jt]s)$/, '');
  if (stripped !== joined) {
    for (const ext of EXT_ORDER) {
      const candidate = stripped + ext;
      if (candidates.has(candidate)) return candidate;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Tiny path helpers — avoid pulling in `node:path` for portability.          */
/* -------------------------------------------------------------------------- */

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function joinPath(a: string, b: string): string {
  if (!a) return b;
  return a + '/' + b;
}

/** Normalize `a/b/./c/../d` → `a/b/d`. POSIX semantics. */
export function normalizePath(p: string): string {
  const parts = p.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') {
      // Keep a leading empty (absolute path); skip otherwise
      if (out.length === 0 && part === '') out.push('');
      continue;
    }
    if (part === '..') {
      // Don't pop past a leading empty (absolute root).
      if (out.length > 0 && out[out.length - 1] !== '..' && out[out.length - 1] !== '') {
        out.pop();
      } else {
        out.push('..');
      }
      continue;
    }
    out.push(part);
  }
  // Re-join. If only one empty element, that's "" which means CWD — emit as ''
  return out.join('/').replace(/^\.\//, '');
}
