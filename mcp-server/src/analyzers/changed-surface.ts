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
  /**
   * How the diff was taken. 'merge-base' (three-dot `base...HEAD`) is precise —
   * only what HEAD added since the common ancestor; needs shared history.
   * 'direct' (two-dot `base HEAD`) is a tree-vs-tree compare used when there's
   * no merge-base (shallow clones); it can over-report base-side changes.
   */
  comparison?: 'merge-base' | 'direct';
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
 * Stable reorder: findings on changed lines first, everything else after, each
 * group keeping its original order. Used to point a capped lane (e.g. wired-unit
 * generates a test per top finding) at the code the diff actually touched.
 */
export function prioritizeByChanged<T extends { filePath?: string; lineNumber?: number }>(
  surface: ChangedSurface,
  findings: T[],
): T[] {
  const changed: T[] = [];
  const rest: T[] = [];
  for (const f of findings) {
    (lineInChanged(surface, f.filePath, f.lineNumber) ? changed : rest).push(f);
  }
  return [...changed, ...rest];
}

/** The changed files (repo-relative). Convenience for seeding lane prompts. */
export function changedPaths(surface: ChangedSurface): string[] {
  return Object.keys(surface.files);
}

/**
 * Ordered git-diff arg sets to try for a base ref, most-precise first. Pure and
 * testable. Each entry is the args appended after `diff --unified=0 --no-color`:
 *  - three-dot `<ref>...HEAD` — merge-base diff (precise; needs shared history)
 *  - two-dot `<ref> HEAD`     — direct tree compare (works on shallow clones)
 * Branch-name refs also get an `origin/<ref>` candidate (remote-tracking name in
 * a fresh clone). A resolved `FETCH_HEAD` or any path-like ref is used verbatim.
 */
export function diffSpecs(baseRef: string): { args: string[]; comparison: 'merge-base' | 'direct' }[] {
  const refs = [baseRef];
  if (baseRef !== 'FETCH_HEAD' && !baseRef.includes('/')) refs.push(`origin/${baseRef}`);
  const out: { args: string[]; comparison: 'merge-base' | 'direct' }[] = [];
  for (const r of refs) {
    out.push({ args: [`${r}...HEAD`], comparison: 'merge-base' });
    out.push({ args: [r, 'HEAD'], comparison: 'direct' });
  }
  return out;
}

/**
 * Compute the changed surface for a git repo: what `<baseRef>` changed up to
 * HEAD. Tries merge-base (three-dot) first for precision, then falls back to a
 * direct tree compare (two-dot) so it also works on shallow clones whose base
 * tip was fetched separately (see ensureBaseRef). Returns null on total failure
 * so the caller falls back to a normal full analysis.
 */
export function computeChangedSurface(projectPath: string, baseRef: string): ChangedSurface | null {
  if (!baseRef) return null;
  for (const spec of diffSpecs(baseRef)) {
    try {
      const diff = execFileSync(
        'git',
        ['-C', projectPath, 'diff', '--unified=0', '--no-color', ...spec.args],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const surface = parseUnifiedDiff(diff, baseRef);
      surface.comparison = spec.comparison;
      return surface;
    } catch {
      // try the next spec (unknown ref / no merge-base on a shallow clone)
    }
  }
  return null;
}

/**
 * Make `baseRef` diffable inside a (possibly shallow `--depth 1`) clone by
 * shallow-fetching just its tip. Returns the local ref to diff against
 * (`FETCH_HEAD`) or null if the fetch fails (unknown ref, network, auth). The
 * two-dot path in computeChangedSurface then compares the two trees directly —
 * no shared history required, so a depth-1 clone + a depth-1 base fetch is
 * enough for change-driven analysis of remote repos.
 */
export function ensureBaseRef(projectPath: string, baseRef: string, timeoutMs = 60_000): string | null {
  if (!baseRef) return null;
  try {
    execFileSync(
      'git',
      ['-C', projectPath, 'fetch', '--depth', '1', '--no-tags', 'origin', baseRef],
      { stdio: ['ignore', 'ignore', 'ignore'], timeout: timeoutMs, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    );
    return 'FETCH_HEAD';
  } catch {
    return null;
  }
}
