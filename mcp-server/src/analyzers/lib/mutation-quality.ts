// Mutation-test quality estimation from assertion shapes.
//
// True mutation testing requires running mutated code — out of scope for
// a static analyzer. But test ASSERTION QUALITY is a strong proxy for
// mutation-kill rate, and it IS statically observable:
//
//   - STRONG assertions kill more mutants:
//       toBe(specificValue), toEqual({…}), toThrow(SpecificError),
//       toBeInstanceOf(Class), toHaveLength(N), toHaveBeenCalledWith(args)
//   - WEAK assertions kill almost nothing:
//       toBeTruthy(), toBeFalsy(), toBeDefined(), toBeNull(),
//       toBeUndefined(), expect(x).not.toBeNull()
//     A mutation that changes 42 → 41 still satisfies `toBeTruthy()`.
//   - SNAPSHOT assertions kill some mutants but are brittle:
//       toMatchSnapshot(), toMatchInlineSnapshot()
//
// We walk each test file's AST, classify every assertion call, and
// derive:
//   - variety:        # of distinct strong matcher types used per file
//   - weakRatio:      # weak / # total assertions
//   - snapshotRatio:  # snapshot / # total assertions
//
// Then the mutation analyzer uses these signals — in addition to the
// existing test-to-source ratio — to produce a more honest estimate.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export type AssertionClass = 'strong' | 'weak' | 'snapshot' | 'other';

export interface AssertionHit {
  matcher: string;
  class: AssertionClass;
  line: number;
}

export interface TestFileAssertionStats {
  filePath: string;
  total: number;
  strong: number;
  weak: number;
  snapshot: number;
  other: number;
  /** Distinct matcher names used. Higher = harder to game with one trick. */
  varietyCount: number;
  /** All hits — useful for surfacing concrete examples in findings. */
  hits: AssertionHit[];
}

const STRONG_MATCHERS = new Set([
  'toBe', 'toEqual', 'toStrictEqual', 'toThrow', 'toThrowError',
  'toBeInstanceOf', 'toHaveLength', 'toContain', 'toContainEqual',
  'toHaveProperty', 'toHaveBeenCalledWith', 'toHaveReturnedWith',
  'toMatch', 'toMatchObject', 'toBeCloseTo', 'toBeGreaterThan',
  'toBeGreaterThanOrEqual', 'toBeLessThan', 'toBeLessThanOrEqual',
  'toBeBetween', 'rejects', 'resolves',
  // ava
  'is', 'deepEqual', 'truthy', 'falsy', 'throws', 'notThrows',
]);

const WEAK_MATCHERS = new Set([
  'toBeTruthy', 'toBeFalsy', 'toBeDefined', 'toBeUndefined',
  'toBeNull', 'toBeNaN', 'toHaveBeenCalled',
]);

const SNAPSHOT_MATCHERS = new Set([
  'toMatchSnapshot', 'toMatchInlineSnapshot',
  'toMatchFileSnapshot', 'toMatchTrimmedSnapshot',
]);

export function analyzeAssertionQuality(filePath: string, ast: File): TestFileAssertionStats {
  const hits: AssertionHit[] = [];

  walk(ast, (node) => {
    if (!t.isCallExpression(node)) return true;
    const callee = node.callee;
    if (!t.isMemberExpression(callee)) return true;

    // Walk to the rightmost member name — the matcher. Skip `.not` / `.resolves` / `.rejects` modifiers along the way.
    let cur: t.Node = callee;
    let matcher: string | null = null;
    while (t.isMemberExpression(cur)) {
      const prop = cur.property;
      if (t.isIdentifier(prop)) {
        if (prop.name !== 'not' && prop.name !== 'resolves' && prop.name !== 'rejects') {
          matcher = prop.name;
        }
      }
      cur = cur.object;
    }

    // The root callee must trace back to `expect(...)` (or chai/ava/etc.)
    // for this to be an assertion. Otherwise it's just a member call.
    if (!isAssertionRoot(cur)) return true;
    if (!matcher) return true;

    const klass: AssertionClass =
      STRONG_MATCHERS.has(matcher) ? 'strong' :
      WEAK_MATCHERS.has(matcher) ? 'weak' :
      SNAPSHOT_MATCHERS.has(matcher) ? 'snapshot' :
      'other';

    hits.push({ matcher, class: klass, line: node.loc?.start.line ?? 1 });
    return true;
  });

  const distinctMatchers = new Set(hits.filter((h) => h.class === 'strong').map((h) => h.matcher));

  return {
    filePath,
    total: hits.length,
    strong: hits.filter((h) => h.class === 'strong').length,
    weak: hits.filter((h) => h.class === 'weak').length,
    snapshot: hits.filter((h) => h.class === 'snapshot').length,
    other: hits.filter((h) => h.class === 'other').length,
    varietyCount: distinctMatchers.size,
    hits,
  };
}

/** Did the matcher chain root in expect(...) / assert(...) / should / t.X? */
function isAssertionRoot(node: t.Node): boolean {
  if (t.isCallExpression(node)) {
    const inner = node.callee;
    if (t.isIdentifier(inner) && (inner.name === 'expect' || inner.name === 'assert')) return true;
  }
  if (t.isIdentifier(node)) {
    // `should`, `assert`, `t` (ava/tap)
    return node.name === 'should' || node.name === 'assert' || node.name === 't';
  }
  return false;
}
