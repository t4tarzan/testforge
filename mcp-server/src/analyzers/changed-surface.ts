// Change-driven QA — tracer-bullet slice.
//
// antirez/news/168, tenet #3: "inspect recent commits, focus QA on likely
// regressions." Every tier today analyzes a whole-repo snapshot. This module
// computes WHAT a diff changed (files + new-file line ranges) so the analysis
// can flag findings that land on changed lines as regression risk for *this*
// change, instead of re-reporting the whole repo every run.
//
// Design: the parser and the intersect are PURE (testable with a diff string,
// no git needed). Only `computeChangedSurface` shells out to git, and it
// degrades to null (caller falls back to normal full analysis) on any failure —
// not-a-repo, an unknown ref, or a shallow clone that lacks the base ref.
import { execFileSync } from 'child_process';

/** A contiguous run of added/modified lines in the NEW version of a file. */
export interface ChangedHunk {
  startLine: number;
  endLine: number;
}

export interface ChangedSurface {
  baseRef: string;
  /** repo-relative (forward-slash) path → changed line ranges in the new file. */
  files: Record<string, ChangedHunk[]>;
  changedFileCount: number;
}

const HUNK_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse `git diff --unified=0` output into changed NEW-file line ranges per
 * file. Pure — pass the diff text directly. Deletions (no new-file lines) and
 * removed files (`+++ /dev/null`) contribute no ranges.
 */
export function parseUnifiedDiff(diff: string, baseRef = ''): ChangedSurface {
  const files: Record<string, ChangedHunk[]> = {};
  let current: string | null = null;

  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      // "+++ b/src/foo.ts" or "+++ /dev/null" (deleted file → no new surface).
      const path = line.slice(4).trim();
      if (path === '/dev/null') { current = null; continue; }
      current = path.replace(/^[ab]\//, '');
      if (!files[current]) files[current] = [];
      continue;
    }
    const m = HUNK_RE.exec(line);
    if (m && current) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      if (count <= 0) continue; // pure deletion at this point → no new lines
      files[current].push({ startLine: start, endLine: start + count - 1 });
    }
  }

  // Drop files that turned out to have no added/modified ranges (pure deletions).
  for (const f of Object.keys(files)) {
    if (files[f].length === 0) delete files[f];
  }
  return { baseRef, files, changedFileCount: Object.keys(files).length };
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Does (filePath, lineNumber) fall inside a changed hunk? Tolerant of
 * absolute-vs-relative paths by matching on path suffix — a finding at
 * `/tmp/clone/src/a.ts` matches a changed `src/a.ts`.
 */
export function lineInChanged(surface: ChangedSurface, filePath: string | undefined | null, lineNumber: number | undefined | null): boolean {
  if (!filePath || !lineNumber) return false;
  const fp = normalize(filePath);
  for (const [rel, hunks] of Object.entries(surface.files)) {
    const r = normalize(rel);
    const match = fp === r || fp.endsWith('/' + r) || r.endsWith('/' + fp);
    if (!match) continue;
    return hunks.some((h) => lineNumber >= h.startLine && lineNumber <= h.endLine);
  }
  return false;
}

/**
 * Tag findings that land on changed lines with `introducedByDiff: true`.
 * Pure and generic over anything carrying filePath + lineNumber. Returns new
 * objects; the input array is not mutated.
 */
export function tagChangedFindings<T extends { filePath?: string; lineNumber?: number }>(
  surface: ChangedSurface,
  findings: T[],
): (T & { introducedByDiff: boolean })[] {
  return findings.map((f) => ({ ...f, introducedByDiff: lineInChanged(surface, f.filePath, f.lineNumber) }));
}

/**
 * Compute the changed surface for a local git repo: everything `<baseRef>`
 * changed up to HEAD (three-dot = since the merge-base, the standard "what this
 * branch changed" view). Returns null on any git failure so the caller falls
 * back to a normal full analysis.
 *
 * Note: a `git clone --depth 1` checkout has no history for `baseRef`, so this
 * returns null there — fetching the base ref before analysis is the next slice.
 */
export function computeChangedSurface(projectPath: string, baseRef: string): ChangedSurface | null {
  if (!baseRef) return null;
  try {
    const diff = execFileSync(
      'git',
      ['-C', projectPath, 'diff', '--unified=0', '--no-color', `${baseRef}...HEAD`],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return parseUnifiedDiff(diff, baseRef);
  } catch {
    return null;
  }
}
