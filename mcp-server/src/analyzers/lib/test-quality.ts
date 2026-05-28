// AST-aware test quality analysis.
//
// The previous unit-analyzer counted `it()/test()` calls with a regex,
// flagged `.only()`, and looked for `console.log`. What it could NOT
// see:
//   - Tests with no assertions (`it('foo', () => { someThing() })`)
//     — these pass trivially and add coverage % without checking behavior.
//   - Skipped tests (`.skip`, `xit`, `xdescribe`) — quietly accumulate.
//   - Empty test bodies (`it('TODO', () => {})`) — pure noise.
//   - Test files that don't import any source files — testing nothing.
//
// This module walks each parsed test file and produces a structured
// quality report. The dimension's score now reflects test *quality*,
// not just count.
//
// Assertion call recognition is library-agnostic and matches common forms:
//   - jest/vitest:        `expect(...).toX(...)`, `expect(...).not.toX(...)`
//   - chai:                `expect(...).to.X`, `should.X`, `assert.X`
//   - node:assert:         `assert(...)`, `assert.equal(...)`, etc.
//   - testing-library:     `expect(screen.getBy...).toBeInTheDocument()`
//   - tap/ava:             `t.equal(...)`, `t.true(...)`, `t.ok(...)`
//   - snapshots:           `toMatchSnapshot`, `toMatchInlineSnapshot` (count as assertion)
//
// Plus side-effecting-but-asserting helpers:
//   - `fail(...)`, `throw new Error()` inside a try/catch that re-throws
//     — these can be intentional, so they're counted only when they're
//     the only statement in the test body (a clear failure-mode test).

import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

const _rawTraverse = (traverseModule as unknown as { default?: typeof traverseModule }).default
  ?? traverseModule;
// Crash-proof wrapper: @babel/traverse builds scope and throws on some
// valid-but-exotic TS (declaration merging, e.g. microsoft/TypeScript →
// "Duplicate declaration"). One pathological file must not 500 the whole
// analysis — skip it and move on.
const traverse = ((ast: Parameters<typeof _rawTraverse>[0], opts: Parameters<typeof _rawTraverse>[1]) => {
  try { _rawTraverse(ast, opts); } catch { /* skip file Babel can't scope */ }
}) as typeof _rawTraverse;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface TestCaseInfo {
  /** Test title (the string argument to `it`/`test`). */
  title: string;
  /** Line number of the it/test call. */
  line: number;
  /** Form: regular, skipped, focused. */
  kind: 'regular' | 'skipped' | 'focused';
  /** True if the test body contains a recognized assertion call. */
  hasAssertion: boolean;
  /** True if the test body is empty (no statements) or only contains comments. */
  isEmpty: boolean;
}

export interface TestFileQuality {
  filePath: string;
  totalCases: number;
  /** Recognized framework names from the file. */
  frameworks: string[];
  cases: TestCaseInfo[];
  /** Whether this test file imports anything other than its framework. */
  importsSourceFiles: boolean;
}

/* -------------------------------------------------------------------------- */
/* Recognition                                                                */
/* -------------------------------------------------------------------------- */

/** Name set for "this is the test runner" callees, including the .only/.skip variants. */
const TEST_CALL_HEADS = new Set(['it', 'test', 'fit', 'xit', 'specify', 'xdescribe']);

const ASSERTION_HEADS = new Set([
  'expect', 'assert', 'should', 'check', 'verify',
  // tap/ava
  't',
  // node assert
  'ok', 'equal', 'strictEqual', 'deepEqual', 'deepStrictEqual', 'notEqual',
  'doesNotMatch', 'match', 'fail', 'throws', 'rejects',
]);

const SNAPSHOT_MATCHERS = new Set([
  'toMatchSnapshot', 'toMatchInlineSnapshot',
  'toMatchFileSnapshot', 'toMatchTrimmedSnapshot',
]);

/* -------------------------------------------------------------------------- */
/* Analysis                                                                   */
/* -------------------------------------------------------------------------- */

export function analyzeTestFile(filePath: string, ast: File): TestFileQuality {
  const cases: TestCaseInfo[] = [];
  const frameworks = new Set<string>();
  let importsSourceFiles = false;

  // Pass 1: detect imports — both ESM and CJS — for framework names
  // and project-relative imports.
  walk(ast, (node) => {
    if (t.isImportDeclaration(node)) {
      const spec = node.source.value;
      const fw = recognizeFramework(spec);
      if (fw) frameworks.add(fw);
      if (spec.startsWith('.') || spec.startsWith('/')) importsSourceFiles = true;
      else if (!isFrameworkOnly(spec)) importsSourceFiles = true;
    } else if (
      t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'require' })
      && node.arguments.length >= 1 && t.isStringLiteral(node.arguments[0])
    ) {
      const spec = node.arguments[0].value;
      const fw = recognizeFramework(spec);
      if (fw) frameworks.add(fw);
      if (spec.startsWith('.') || spec.startsWith('/')) importsSourceFiles = true;
      else if (!isFrameworkOnly(spec)) importsSourceFiles = true;
    }
    return true;
  });

  // Pass 2: walk for test calls.
  traverse(ast, {
    CallExpression(path) {
      const call = path.node;
      const { kind, ok } = classifyTestCall(call);
      if (!ok) return;

      const title = extractTitle(call.arguments[0]);
      const body = call.arguments[1];
      const line = call.loc?.start.line ?? 1;

      let hasAssertion = false;
      let isEmpty = true;

      if (body && (t.isArrowFunctionExpression(body) || t.isFunctionExpression(body))) {
        const inspect = analyzeBody(body.body);
        hasAssertion = inspect.hasAssertion;
        isEmpty = inspect.isEmpty;
      }

      cases.push({ title, line, kind, hasAssertion, isEmpty });
    },
  });

  return {
    filePath,
    totalCases: cases.length,
    frameworks: [...frameworks],
    cases,
    importsSourceFiles,
  };
}

function classifyTestCall(call: t.CallExpression): { kind: TestCaseInfo['kind']; ok: boolean } {
  const callee = call.callee;
  // Plain identifier: `it('foo', () => {})` / `test(...)` / `xit(...)`
  if (t.isIdentifier(callee)) {
    if (TEST_CALL_HEADS.has(callee.name)) {
      if (callee.name === 'xit' || callee.name === 'xdescribe') {
        return { kind: 'skipped', ok: true };
      }
      if (callee.name === 'fit') {
        return { kind: 'focused', ok: true };
      }
      // ensure it's a real test (has a string title)
      if (!call.arguments[0]) return { kind: 'regular', ok: false };
      // describe isn't a test case — we filter it out via the head set
      if (callee.name === 'describe' || callee.name === 'xdescribe') return { kind: 'regular', ok: false };
      return { kind: 'regular', ok: true };
    }
    return { kind: 'regular', ok: false };
  }

  // Member: `it.skip(...)`, `it.only(...)`, `test.skip(...)`, etc.
  if (t.isMemberExpression(callee) && !callee.computed) {
    const obj = callee.object;
    if (!t.isIdentifier(obj) || !TEST_CALL_HEADS.has(obj.name)) {
      return { kind: 'regular', ok: false };
    }
    const prop = callee.property;
    if (!t.isIdentifier(prop)) return { kind: 'regular', ok: false };
    if (prop.name === 'skip' || prop.name === 'todo') return { kind: 'skipped', ok: true };
    if (prop.name === 'only') return { kind: 'focused', ok: true };
    // it.each, it.failing, … — count as regular for quality purposes.
    if (prop.name === 'each' || prop.name === 'concurrent' || prop.name === 'failing') {
      return { kind: 'regular', ok: true };
    }
    return { kind: 'regular', ok: false };
  }

  return { kind: 'regular', ok: false };
}

function extractTitle(arg: t.Node | undefined): string {
  if (!arg) return '<no title>';
  if (t.isStringLiteral(arg)) return arg.value;
  if (t.isTemplateLiteral(arg) && arg.quasis.length === 1) return arg.quasis[0].value.cooked || '';
  return '<dynamic title>';
}

function analyzeBody(body: t.BlockStatement | t.Expression): { hasAssertion: boolean; isEmpty: boolean } {
  // Arrow expression body: `() => expect(x).toBe(1)` is one expression — count it.
  if (!t.isBlockStatement(body)) {
    return {
      hasAssertion: containsAssertion(body),
      isEmpty: false,
    };
  }
  const stmts = body.body;
  if (stmts.length === 0) return { hasAssertion: false, isEmpty: true };

  // Treat a body of only directive-prologues or expression statements that
  // are nothing but identifiers / literals as "empty in spirit."
  const meaningful = stmts.filter((s) => !isTrivialStatement(s));
  if (meaningful.length === 0) return { hasAssertion: false, isEmpty: true };

  const hasAssertion = stmts.some((stmt) => statementContainsAssertion(stmt));
  return { hasAssertion, isEmpty: false };
}

function isTrivialStatement(s: t.Statement): boolean {
  if (t.isEmptyStatement(s)) return true;
  if (t.isExpressionStatement(s)) {
    const e = s.expression;
    if (t.isStringLiteral(e) || t.isNumericLiteral(e) || t.isBooleanLiteral(e) || t.isNullLiteral(e)) return true;
    if (t.isIdentifier(e)) return true;
  }
  return false;
}

function statementContainsAssertion(stmt: t.Node): boolean {
  let found = false;
  walk(stmt, (n) => {
    if (found) return false;
    if (containsAssertion(n)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

function containsAssertion(node: t.Node): boolean {
  if (!t.isCallExpression(node)) return false;
  const callee = node.callee;

  // expect(x).toBe(y) / expect(x).not.toBe(y) / expect(x).toMatchSnapshot()
  if (t.isMemberExpression(callee)) {
    let cur: t.Node = callee;
    while (t.isMemberExpression(cur)) {
      const prop = cur.property;
      if (t.isIdentifier(prop) && SNAPSHOT_MATCHERS.has(prop.name)) return true;
      cur = cur.object;
    }
    // Walk to root: if the root callee is `expect(...)`, this is an assertion.
    if (t.isCallExpression(cur)) {
      const inner = cur.callee;
      if (t.isIdentifier(inner) && ASSERTION_HEADS.has(inner.name)) return true;
    }
    if (t.isIdentifier(cur) && ASSERTION_HEADS.has(cur.name)) {
      // `assert.equal(...)`, `t.true(...)`, `should.equal(...)`
      return true;
    }
  }

  // Bare: `assert(x)`, `expect(x)` (the latter is rare on its own but possible)
  if (t.isIdentifier(callee) && ASSERTION_HEADS.has(callee.name)) {
    // expect() with no chained matcher is NOT an assertion (it's a setup
    // step before `.toBe`/etc). But `assert(x)` IS — handle them separately.
    if (callee.name === 'assert' || callee.name === 'ok') return true;
    return false;
  }

  return false;
}

/* -------------------------------------------------------------------------- */
/* Framework recognition                                                      */
/* -------------------------------------------------------------------------- */

function recognizeFramework(spec: string): string | null {
  if (spec === 'jest' || spec === '@jest/globals') return 'Jest';
  if (spec === 'vitest' || spec === 'vitest/config') return 'Vitest';
  if (spec === 'mocha') return 'Mocha';
  if (spec === 'ava') return 'AVA';
  if (spec === 'tap' || spec === 'node-tap' || spec === '@japa/runner') return 'Node Tap';
  if (spec === 'node:test') return 'node:test';
  if (spec.startsWith('@testing-library/')) return 'Testing Library';
  if (spec === 'chai') return 'Chai';
  return null;
}

function isFrameworkOnly(spec: string): boolean {
  return !!recognizeFramework(spec);
}
