// Tracer-bullet tests for change-driven QA (antirez/news/168 tenet #3).
// The parser + intersect are pure, so we test them against a known
// `git diff --unified=0` fixture — no git invocation needed.
import { describe, it, expect } from 'vitest';
import { parseUnifiedDiff, lineInChanged, tagChangedFindings, diffSpecs, prioritizeByChanged, changedPaths, regressionRiskByDimension } from '../src/analyzers/changed-surface.js';
import { changedHintBlock } from '../src/simulation/e2e-journey.js';

// A representative unified=0 diff: one file modified (a hunk in the middle),
// one new file, one deleted file (must contribute NO new-file surface).
const DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1111111..2222222 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -88 +88,2 @@ export function login() {
+  const url = req.query.url;
+  await fetch(url);
diff --git a/src/new-feature.ts b/src/new-feature.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/new-feature.ts
@@ -0,0 +1,3 @@
+export function feature() {
+  return 42;
+}
diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index 4444444..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const gone = true;
-`;

describe('parseUnifiedDiff', () => {
  it('extracts new-file line ranges for modified and added files', () => {
    const s = parseUnifiedDiff(DIFF, 'main');
    expect(s.baseRef).toBe('main');
    expect(Object.keys(s.files).sort()).toEqual(['src/auth.ts', 'src/new-feature.ts']);
    expect(s.files['src/auth.ts']).toEqual([{ startLine: 88, endLine: 89 }]);
    expect(s.files['src/new-feature.ts']).toEqual([{ startLine: 1, endLine: 3 }]);
  });

  it('omits deleted files (no new-file surface)', () => {
    const s = parseUnifiedDiff(DIFF);
    expect(s.files['src/old.ts']).toBeUndefined();
    expect(s.changedFileCount).toBe(2);
  });

  it('treats a single-line hunk (no count) as one line', () => {
    const s = parseUnifiedDiff(
      `--- a/x.ts\n+++ b/x.ts\n@@ -5 +5 @@\n+changed line`,
    );
    expect(s.files['x.ts']).toEqual([{ startLine: 5, endLine: 5 }]);
  });
});

describe('lineInChanged', () => {
  const surface = parseUnifiedDiff(DIFF, 'main');

  it('matches a line inside a changed hunk', () => {
    expect(lineInChanged(surface, 'src/auth.ts', 88)).toBe(true);
    expect(lineInChanged(surface, 'src/auth.ts', 89)).toBe(true);
  });

  it('rejects a line outside any changed hunk', () => {
    expect(lineInChanged(surface, 'src/auth.ts', 10)).toBe(false);
    expect(lineInChanged(surface, 'src/auth.ts', 90)).toBe(false);
  });

  it('is tolerant of absolute paths via suffix match', () => {
    expect(lineInChanged(surface, '/tmp/clone-xyz/src/auth.ts', 88)).toBe(true);
  });

  it('returns false for unchanged files and missing coordinates', () => {
    expect(lineInChanged(surface, 'src/untouched.ts', 88)).toBe(false);
    expect(lineInChanged(surface, undefined, 88)).toBe(false);
    expect(lineInChanged(surface, 'src/auth.ts', null)).toBe(false);
  });
});

describe('diffSpecs (slice 2 — remote/shallow fallback ordering)', () => {
  it('tries merge-base before direct for a branch name, plus an origin/ candidate', () => {
    const specs = diffSpecs('main');
    expect(specs).toEqual([
      { args: ['main...HEAD'], comparison: 'merge-base' },
      { args: ['main', 'HEAD'], comparison: 'direct' },
      { args: ['origin/main...HEAD'], comparison: 'merge-base' },
      { args: ['origin/main', 'HEAD'], comparison: 'direct' },
    ]);
  });

  it('does not prefix origin/ for FETCH_HEAD (resolved shallow base tip)', () => {
    const specs = diffSpecs('FETCH_HEAD');
    expect(specs).toEqual([
      { args: ['FETCH_HEAD...HEAD'], comparison: 'merge-base' },
      { args: ['FETCH_HEAD', 'HEAD'], comparison: 'direct' },
    ]);
  });

  it('does not prefix origin/ for a path-like ref (already qualified)', () => {
    expect(diffSpecs('origin/dev').every((s) => !s.args.some((a) => a.startsWith('origin/origin/')))).toBe(true);
  });
});

describe('tagChangedFindings', () => {
  it('flags only findings that land on changed lines', () => {
    const surface = parseUnifiedDiff(DIFF, 'main');
    const findings = [
      { rule: 'ssrf', filePath: 'src/auth.ts', lineNumber: 89, severity: 'high' },
      { rule: 'old', filePath: 'src/auth.ts', lineNumber: 10, severity: 'low' },
      { rule: 'elsewhere', filePath: 'src/untouched.ts', lineNumber: 1, severity: 'low' },
    ];
    const tagged = tagChangedFindings(surface, findings);
    expect(tagged.map((f) => f.introducedByDiff)).toEqual([true, false, false]);
    // input not mutated
    expect((findings[0] as { introducedByDiff?: boolean }).introducedByDiff).toBeUndefined();
  });
});

describe('prioritizeByChanged (slice 3 — lane seeding)', () => {
  const surface = parseUnifiedDiff(DIFF, 'main');

  it('moves findings on changed lines to the front, stably', () => {
    const findings = [
      { id: 'a', filePath: 'src/untouched.ts', lineNumber: 1 },
      { id: 'b', filePath: 'src/auth.ts', lineNumber: 88 },   // changed
      { id: 'c', filePath: 'src/other.ts', lineNumber: 5 },
      { id: 'd', filePath: 'src/new-feature.ts', lineNumber: 2 }, // changed
    ];
    expect(prioritizeByChanged(surface, findings).map((f) => f.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('is a no-op ordering when nothing is on changed lines', () => {
    const findings = [{ id: 'x', filePath: 'src/untouched.ts', lineNumber: 1 }];
    expect(prioritizeByChanged(surface, findings).map((f) => f.id)).toEqual(['x']);
  });
});

describe('changedPaths', () => {
  it('lists the changed files', () => {
    expect(changedPaths(parseUnifiedDiff(DIFF, 'main')).sort()).toEqual(['src/auth.ts', 'src/new-feature.ts']);
  });
});

describe('regressionRiskByDimension (slice 4 — all dimensions)', () => {
  const surface = parseUnifiedDiff(DIFF, 'main');

  it('counts findings on changed lines per dimension, omitting zeros', () => {
    const risk = regressionRiskByDimension(surface, {
      security: [
        { filePath: 'src/auth.ts', lineNumber: 88 },   // changed
        { filePath: 'src/auth.ts', lineNumber: 10 },    // not
      ],
      edgeCases: [{ filePath: 'src/new-feature.ts', lineNumber: 2 }], // changed
      supplyChain: [{ filePath: undefined, lineNumber: undefined }],  // project-level → drops
      license: [],                                                    // empty → drops
    });
    expect(risk).toEqual({ security: 1, edgeCases: 1 });
  });

  it('returns an empty object when nothing lands on changed lines', () => {
    expect(regressionRiskByDimension(surface, { unit: [{ filePath: 'src/untouched.ts', lineNumber: 1 }] })).toEqual({});
  });
});

describe('changedHintBlock (journey author prompt)', () => {
  it('is empty when there is no hint', () => {
    expect(changedHintBlock()).toBe('');
    expect(changedHintBlock([])).toBe('');
  });

  it('renders a bulleted list and caps at 40 entries', () => {
    const block = changedHintBlock(['src/a.ts', 'src/b.ts']);
    expect(block).toContain('PRIORITIZE');
    expect(block).toContain('- src/a.ts');
    expect(block).toContain('- src/b.ts');
    const many = Array.from({ length: 60 }, (_, i) => `f${i}.ts`);
    expect((changedHintBlock(many).match(/\n- /g) || []).length).toBe(40);
  });
});
