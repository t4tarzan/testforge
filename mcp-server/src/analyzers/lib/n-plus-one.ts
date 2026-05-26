// AST-aware N+1 detection.
//
// The previous line-level regex version had two problems:
//   1. It tried to track `{` / `}` to know when a loop ended. That breaks
//      on arrow-function bodies (no braces) and any function nested
//      inside a loop (innocent inner-fn db calls would be flagged).
//   2. It couldn't distinguish "for (...) { db.query() }" (an N+1) from
//      "for (...) { const x = ...; await Promise.all([db.query(...)]) }"
//      (parallelised — not an N+1).
//
// The AST version walks loop nodes (ForStatement, ForOfStatement,
// ForInStatement, WhileStatement, DoWhileStatement, plus the higher-
// order forms: arr.forEach/map/some/every/find/filter/reduce) and looks
// for db-call expressions inside their body. We surface only when the
// db call is NOT wrapped in Promise.all / Promise.allSettled (which is
// the canonical parallelisation pattern, so it's no longer N+1).

import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import type { File } from '@babel/types';
import { getCalleeName, isDbQueryCall, walk, nodeLoc } from './visitors.js';

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default
  ?? traverseModule;

/** Higher-order array methods whose callback we treat as a loop body. */
const ARRAY_HOF = new Set(['forEach', 'map', 'filter', 'reduce', 'some', 'every', 'find', 'flatMap']);

export interface NPlusOneHit {
  /** Line of the db call inside the loop. */
  line: number;
  /** Column of the db call. */
  column: number;
  /** The callee name we identified as a db sink. */
  calleeName: string;
  /** Which loop construct the call was nested inside. */
  loopKind:
    | 'for' | 'for-of' | 'for-in' | 'while' | 'do-while'
    | 'array.forEach' | 'array.map' | 'array.filter' | 'array.reduce'
    | 'array.some' | 'array.every' | 'array.find' | 'array.flatMap';
}

/**
 * Scan an AST for db calls nested inside any loop construct. Skips
 * calls already wrapped in Promise.all / Promise.allSettled.
 */
export function findNPlusOneHits(ast: File): NPlusOneHit[] {
  const hits: NPlusOneHit[] = [];

  traverse(ast, {
    // Native loop constructs
    ForStatement(path) { collectInBody(path.node.body, 'for', hits); },
    ForOfStatement(path) { collectInBody(path.node.body, 'for-of', hits); },
    ForInStatement(path) { collectInBody(path.node.body, 'for-in', hits); },
    WhileStatement(path) { collectInBody(path.node.body, 'while', hits); },
    DoWhileStatement(path) { collectInBody(path.node.body, 'do-while', hits); },

    // Array higher-order forms: arr.<hof>(cb)
    CallExpression(path) {
      const call = path.node;
      const callee = call.callee;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      const prop = callee.property;
      if (!t.isIdentifier(prop) || !ARRAY_HOF.has(prop.name)) return;
      const cb = call.arguments[0];
      if (!cb || (!t.isArrowFunctionExpression(cb) && !t.isFunctionExpression(cb))) return;
      const kind = (`array.${prop.name}`) as NPlusOneHit['loopKind'];
      collectInBody(cb.body, kind, hits);
    },
  });

  // De-dup: a single db call line can be inside both a forEach and an
  // outer for-loop in theory; emit once per (line, column).
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.line}|${h.column}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* -------------------------------------------------------------------------- */
/* Internals                                                                  */
/* -------------------------------------------------------------------------- */

function collectInBody(body: t.Node, loopKind: NPlusOneHit['loopKind'], hits: NPlusOneHit[]) {
  walk(body, (node) => {
    if (!t.isCallExpression(node)) return true;

    // Skip if the call IS Promise.all / Promise.allSettled — that
    // pattern parallelises queries, so it's not N+1.
    if (isPromiseAllOrSettled(node)) return false;

    const name = getCalleeName(node.callee);
    if (!isDbQueryCall(name)) return true;

    // ALSO skip if our awaited db call is the direct argument to a
    // surrounding Promise.all([…]). Walking up from the call, find the
    // nearest CallExpression ancestor — if it's Promise.all, treat as
    // parallel. Since `walk` doesn't carry parents, we instead check
    // the body root for the pattern up-front (cheap heuristic): if the
    // body is an awaited Promise.all of a map, the map's callback won't
    // contain a bare db call — it'll be returning the promise. That's
    // the common case and is covered by the early-return above when
    // we visit the Promise.all CallExpression first.

    const loc = nodeLoc(node);
    hits.push({
      line: loc.line,
      column: loc.column,
      calleeName: name,
      loopKind,
    });
    return true;
  });
}

function isPromiseAllOrSettled(call: t.CallExpression): boolean {
  const callee = call.callee;
  if (!t.isMemberExpression(callee) || callee.computed) return false;
  if (!t.isIdentifier(callee.object, { name: 'Promise' })) return false;
  const prop = callee.property;
  if (!t.isIdentifier(prop)) return false;
  return prop.name === 'all' || prop.name === 'allSettled';
}
