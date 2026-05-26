// Cyclomatic complexity via AST.
//
// The classic metric: 1 + count of branching control-flow nodes per
// function. Higher = harder to test (more independent paths). We
// surface the metric per file (max + sum across functions) so the
// predictive analyzer can roll it into a per-file risk score.
//
// Branching nodes counted:
//   - if / else-if
//   - for / for-of / for-in / while / do-while
//   - switch case (each `case`, not `default`)
//   - catch clauses
//   - ternary (?:)
//   - logical operators (&&, ||, ??)
//   - optional chaining (?.) — each `?.` is a runtime branch
//
// Out of scope:
//   - Whole-function jumps (return/throw mid-function don't add paths
//     to McCabe in the simple form).
//   - Class methods are counted as functions.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';

export interface FunctionComplexity {
  /** Inferred function name; "<anonymous>" for unnamed expressions. */
  name: string;
  /** Cyclomatic complexity (1-based). */
  cc: number;
  /** Start line. */
  line: number;
}

export interface FileComplexity {
  filePath: string;
  /** Highest complexity function in the file. */
  maxCc: number;
  /** Sum of cc across all functions. */
  totalCc: number;
  /** Top-3 most complex functions in the file. */
  hottest: FunctionComplexity[];
  /** Function count. */
  functionCount: number;
}

export function computeFileComplexity(filePath: string, ast: File): FileComplexity {
  const fns: FunctionComplexity[] = [];

  walk(ast, (node) => {
    if (isFunctionLike(node)) {
      const cc = countBranches(node);
      fns.push({
        name: inferFnName(node),
        cc,
        line: node.loc?.start.line ?? 1,
      });
    }
    return true;
  });

  fns.sort((a, b) => b.cc - a.cc);
  const maxCc = fns.length > 0 ? fns[0].cc : 1;
  const totalCc = fns.reduce((s, f) => s + f.cc, 0);

  return {
    filePath,
    maxCc,
    totalCc,
    hottest: fns.slice(0, 3),
    functionCount: fns.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function isFunctionLike(node: t.Node): node is t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression | t.ObjectMethod | t.ClassMethod {
  return (
    t.isFunctionDeclaration(node) ||
    t.isFunctionExpression(node) ||
    t.isArrowFunctionExpression(node) ||
    t.isObjectMethod(node) ||
    t.isClassMethod(node)
  );
}

function inferFnName(node: t.Node): string {
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  if (t.isFunctionExpression(node) && node.id) return node.id.name;
  if ((t.isObjectMethod(node) || t.isClassMethod(node)) && t.isIdentifier(node.key)) {
    return node.key.name;
  }
  return '<anonymous>';
}

function countBranches(fn: t.Node): number {
  let cc = 1;
  // Don't descend into NESTED functions — those have their own cc.
  walk(fn, (n) => {
    if (n === fn) return true;
    if (isFunctionLike(n)) return false;

    if (t.isIfStatement(n)) cc++;
    else if (t.isForStatement(n) || t.isForOfStatement(n) || t.isForInStatement(n)) cc++;
    else if (t.isWhileStatement(n) || t.isDoWhileStatement(n)) cc++;
    else if (t.isSwitchCase(n) && n.test) cc++; // skip `default:`
    else if (t.isCatchClause(n)) cc++;
    else if (t.isConditionalExpression(n)) cc++;
    else if (t.isLogicalExpression(n)) {
      if (n.operator === '&&' || n.operator === '||' || n.operator === '??') cc++;
    } else if (t.isOptionalCallExpression(n) || t.isOptionalMemberExpression(n)) {
      // Each `?.` is a runtime nullish-guard branch.
      if (n.optional) cc++;
    }
    return true;
  });
  return cc;
}
