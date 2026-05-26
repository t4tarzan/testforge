// AST-based edge-case / boundary-condition detection.
//
// The previous line-level checks failed in subtle ways:
//   - `[\w+]` regex flagged every array access, then asked "does the
//     ENTIRE PROJECT contain '.length'?" — if yes, declared all bounds
//     checks present. Always returned all-clear on real projects.
//   - Division check looked for `=== 0` anywhere in the project to
//     declare division safe. Same false-clean failure mode.
//
// What this module catches (per-function scope when relevant):
//
//   - parseInt(x) without explicit radix
//       Footgun in old browsers; `parseInt('08')` returned 0.
//       Modern engines default to base 10 but the rule is still
//       MDN-recommended best practice.
//
//   - Number(x) without isNaN check
//       NaN propagates silently through arithmetic.
//
//   - JSON.parse(x) not inside a try/catch
//       Throws SyntaxError on invalid input — most callers don't expect.
//
//   - new Date(someString) on user input
//       Bad strings produce `Invalid Date` (date.toString() === 'Invalid Date'),
//       which silently breaks downstream math.
//
//   - Loose equality (== / !=)
//       Triggers type-coercion edge cases.
//
//   - Switch statement without `default:` clause.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import traverseModule from '@babel/traverse';
import { walk } from './visitors.js';

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default
  ?? traverseModule;

export interface EdgeCaseHit {
  rule: 'parseInt-no-radix' | 'JSON-parse-untrycaught' | 'new-Date-on-string'
      | 'loose-equality' | 'switch-no-default' | 'Number-coercion-unchecked';
  filePath: string;
  line: number;
  description: string;
}

export function findEdgeCases(filePath: string, ast: File): EdgeCaseHit[] {
  const out: EdgeCaseHit[] = [];

  // Track which try-statements contain the call expressions inside them.
  // Cheaper than full parent tracking: do a pre-pass and record the
  // (start, end) ranges of try blocks.
  const tryRanges: Array<{ start: number; end: number }> = [];
  walk(ast, (node) => {
    if (t.isTryStatement(node) && typeof node.block.start === 'number' && typeof node.block.end === 'number') {
      tryRanges.push({ start: node.block.start, end: node.block.end });
    }
    return true;
  });
  const isInsideTry = (node: t.Node) => {
    if (typeof node.start !== 'number') return false;
    const s = node.start;
    return tryRanges.some((r) => s >= r.start && s <= r.end);
  };

  walk(ast, (node) => {
    // ── parseInt(x) — flag if there's only 1 argument (no radix)
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.callee, { name: 'parseInt' }) &&
      node.arguments.length === 1
    ) {
      out.push({
        rule: 'parseInt-no-radix',
        filePath,
        line: node.loc?.start.line ?? 1,
        description: 'parseInt() called without an explicit radix argument.',
      });
    }

    // ── JSON.parse(x) not inside a try/catch
    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      !node.callee.computed &&
      t.isIdentifier(node.callee.object, { name: 'JSON' }) &&
      t.isIdentifier(node.callee.property, { name: 'parse' }) &&
      !isInsideTry(node)
    ) {
      out.push({
        rule: 'JSON-parse-untrycaught',
        filePath,
        line: node.loc?.start.line ?? 1,
        description: 'JSON.parse() outside a try/catch — throws on malformed input.',
      });
    }

    // ── new Date(stringArg) — single non-literal argument
    if (
      t.isNewExpression(node) &&
      t.isIdentifier(node.callee, { name: 'Date' }) &&
      node.arguments.length === 1 &&
      !t.isNumericLiteral(node.arguments[0])
    ) {
      // Skip the literal `new Date()` (no args) and `new Date(1234567890)` (numeric ms).
      const arg = node.arguments[0];
      // If it's a string literal that obviously parses fine (ISO 8601), skip.
      if (t.isStringLiteral(arg) && /^\d{4}-\d{2}-\d{2}/.test(arg.value)) return true;
      out.push({
        rule: 'new-Date-on-string',
        filePath,
        line: node.loc?.start.line ?? 1,
        description: 'new Date(arg) with a non-literal / non-ISO argument — bad input produces "Invalid Date".',
      });
    }

    // ── Loose equality (== / !=)
    if (
      t.isBinaryExpression(node) &&
      (node.operator === '==' || node.operator === '!=')
    ) {
      // Allow == null / != null — those are the canonical "is this nullish" pattern.
      const isNullCheck =
        (t.isNullLiteral(node.left) || t.isNullLiteral(node.right));
      if (!isNullCheck) {
        out.push({
          rule: 'loose-equality',
          filePath,
          line: node.loc?.start.line ?? 1,
          description: `Loose equality (${node.operator}) — use === / !== to avoid type-coercion surprises.`,
        });
      }
    }

    // ── Number(x) is handled in the separate parent-aware traverse below.

    // ── Switch without default
    if (t.isSwitchStatement(node)) {
      const hasDefault = node.cases.some((c) => c.test === null);
      if (!hasDefault) {
        out.push({
          rule: 'switch-no-default',
          filePath,
          line: node.loc?.start.line ?? 1,
          description: 'switch statement has no `default:` clause — unexpected values fall through silently.',
        });
      }
    }

    return true;
  });

  // Parent-aware pass for Number(x): only flag when used inline (binary
  // expression, return statement, member access, etc.) — NOT when
  // assigned to a const/let/var, where the caller likely guards on the
  // following lines with isNaN.
  traverse(ast, {
    CallExpression(path) {
      const c = path.node;
      if (!t.isIdentifier(c.callee, { name: 'Number' })) return;
      if (c.arguments.length !== 1) return;
      const arg = c.arguments[0];
      if (t.isNumericLiteral(arg) || t.isStringLiteral(arg)) return;
      // Skip if parent is a VariableDeclarator (assigned to a local).
      if (path.parent && t.isVariableDeclarator(path.parent)) return;
      // Skip if parent is an AssignmentExpression (assigned to existing var).
      if (path.parent && t.isAssignmentExpression(path.parent)) return;
      out.push({
        rule: 'Number-coercion-unchecked',
        filePath,
        line: c.loc?.start.line ?? 1,
        description: 'Number(x) used inline (no var assignment) — bad input produces NaN that propagates silently.',
      });
    },
  });

  // De-dup by (line, rule).
  const seen = new Set<string>();
  return out.filter((h) => {
    const k = `${h.line}|${h.rule}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
