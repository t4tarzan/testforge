// Cross-function taint propagation — Phase 4a.
//
// Phase 2 introduced intra-procedural taint. That means we catch
//   const q = '...' + req.body.x;
//   db.query(q);
// but miss
//   function runQuery(q) { db.query(q); }     // ← q is a sink position
//   runQuery('...' + req.body.x);             // ← caller should be flagged
//
// This module builds a "function summary" table per file: for each named
// function we can resolve, classify each parameter as a sink position
// (and for which category), and classify the return value as
// taint-propagating or not.
//
// Then in the main analyzer, when we see a CallExpression to a
// summarized function with tainted arguments, we emit findings *at the
// call site* — the user gets a finding where they wrote the dangerous
// code, not in the helper that's actually correct in isolation.
//
// Deliberate scope:
//   • Intra-file only. Cross-file taint propagation needs module
//     resolution + ES/CJS interop awareness; deferred.
//   • Direct calls only. `[].map(helper)` won't connect — finding the
//     right element type to propagate is a deeper analysis.
//   • One pass over the file with a small fixpoint. Mutual recursion
//     between two helpers means we may converge after 2-3 passes;
//     cap at 4.

import * as t from '@babel/types';
import { walk } from './visitors.js';
import { evaluateTaint, identifySanitizer, type TaintTable } from './taint.js';

/* -------------------------------------------------------------------------- */
/* Sink registry — must match the categories the analyzer can emit            */
/* -------------------------------------------------------------------------- */

export type SinkCategory =
  | 'SQL Injection'
  | 'Dangerous Functions'
  | 'Path Traversal'
  | 'Open Redirect'
  | 'XSS';

interface SinkSpec {
  /** Callee name pattern. Matched against the dotted name. */
  match: (calleeName: string) => boolean;
  category: SinkCategory;
  /** Which argument is the sink? -1 means "the last argument". */
  argIndex: number;
}

const SINKS: SinkSpec[] = [
  // SQL: db.query(<sql>, ...), connection.exec(<sql>), etc.
  { match: (n) => /(?:^|\.)(?:query|exec|execute|raw|findRaw)$/i.test(n), category: 'SQL Injection', argIndex: 0 },
  // RCE
  { match: (n) => n === 'eval', category: 'Dangerous Functions', argIndex: 0 },
  { match: (n) => n === 'Function', category: 'Dangerous Functions', argIndex: 0 },
  { match: (n) => /(?:^|\.)(?:exec|execSync)$/.test(n) && /child_process/.test(n), category: 'Dangerous Functions', argIndex: 0 },
  // Path traversal — first arg
  { match: (n) => /(?:^|\.)(?:readFile|readFileSync|createReadStream|sendFile|writeFile|writeFileSync|unlink|unlinkSync|open|openSync)$/.test(n), category: 'Path Traversal', argIndex: 0 },
  { match: (n) => n === 'path.join' || n === 'path.resolve', category: 'Path Traversal', argIndex: 0 },
  // Open redirect — last arg of res.redirect (status code may precede)
  { match: (n) => /(?:^|\.)redirect$/.test(n), category: 'Open Redirect', argIndex: -1 },
  // XSS sinks
  { match: (n) => /(?:^|\.)(?:send|write|render)$/.test(n), category: 'XSS', argIndex: 0 },
];

function calleeName(callee: t.Expression | t.V8IntrinsicIdentifier): string {
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee)) {
    const parts: string[] = [];
    let cur: t.Node = callee;
    while (t.isMemberExpression(cur)) {
      const prop = cur.property;
      if (t.isIdentifier(prop) && !cur.computed) parts.unshift(prop.name);
      else if (t.isStringLiteral(prop)) parts.unshift(prop.value);
      else parts.unshift('[…]');
      cur = cur.object;
    }
    if (t.isIdentifier(cur)) parts.unshift(cur.name);
    return parts.join('.');
  }
  return '';
}

/* -------------------------------------------------------------------------- */
/* Public types                                                               */
/* -------------------------------------------------------------------------- */

export interface ParamSink {
  /** Position of the parameter that ends up in a sink. */
  paramIndex: number;
  /** Which category the sink belongs to. */
  category: SinkCategory;
  /** Sanitizers observed wrapping the parameter on the way to the sink. */
  sanitizers: string[];
}

export interface FunctionSummary {
  /** Position-tagged sinks the params land in. */
  sinks: ParamSink[];
  /** True if *any* parameter flows to the return value with no sanitizer. */
  returnsTaint: boolean;
  /** Names of sanitizers seen on the parameter→return path (informational). */
  returnSanitizers: string[];
}

export interface FunctionSummaryTable {
  /** Key: function name (identifier). */
  byName: Map<string, FunctionSummary>;
}

/* -------------------------------------------------------------------------- */
/* Collect summaries                                                          */
/* -------------------------------------------------------------------------- */

export function collectFunctionSummaries(ast: t.File): FunctionSummaryTable {
  const byName = new Map<string, FunctionSummary>();

  // Two-pass to catch self-references where helpers call other helpers.
  for (let pass = 0; pass < 4; pass++) {
    const before = JSON.stringify([...byName.entries()]);

    walk(ast, (node) => {
      const fn = asFunction(node);
      if (!fn) return true;

      const fnName = inferFunctionName(node);
      if (!fnName) return true;

      const paramNames = collectParamNames(fn.params);
      if (paramNames.length === 0) return true;

      const summary = analyzeFunctionBody(fn.body, paramNames, byName);
      byName.set(fnName, summary);
      return true;
    });

    if (JSON.stringify([...byName.entries()]) === before) break;
  }

  return { byName };
}

function asFunction(node: t.Node): { params: t.Function['params']; body: t.BlockStatement | t.Expression } | null {
  if (t.isFunctionDeclaration(node)) return { params: node.params, body: node.body };
  if (t.isFunctionExpression(node)) return { params: node.params, body: node.body };
  if (t.isArrowFunctionExpression(node)) {
    return { params: node.params, body: node.body };
  }
  return null;
}

function inferFunctionName(node: t.Node): string | null {
  // function declaration: name lives directly on the node
  if (t.isFunctionDeclaration(node) && node.id) return node.id.name;
  // The walker doesn't give us a parent — but we can look at common shapes
  // when we see the function as an init: `const x = function() {...}` or
  // `const x = () => ...`. Since `walk` is depth-first and visits the
  // VariableDeclarator before its `init`, we instead do a sweep below.
  return null;
}

function collectParamNames(params: t.Function['params']): string[] {
  const out: string[] = [];
  for (const p of params) {
    if (t.isIdentifier(p)) out.push(p.name);
    else if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) out.push(p.left.name);
    else if (t.isRestElement(p) && t.isIdentifier(p.argument)) out.push(p.argument.name);
    else out.push(''); // destructuring or other — skip for now
  }
  return out;
}

/**
 * Walk the function body and answer: for each parameter (by name), does
 * it reach a sink? Does it reach the return? Through which sanitizers?
 *
 * Two-phase: first build a synthetic taint table seeded with the params
 * (so derivatives like `const q = '...' + id` inside the helper carry
 * the taint), then run sink/return checks against that table.
 */
function analyzeFunctionBody(
  body: t.BlockStatement | t.Expression,
  paramNames: string[],
  summaries: Map<string, FunctionSummary>
): FunctionSummary {
  const sinks: ParamSink[] = [];
  let returnsTaint = false;
  const returnSanitizers: string[] = [];

  // Phase 1 — seed table with params + propagate to derived locals.
  //
  // We stash the originating parameter name into the via field so we can
  // attribute a sink finding back to the right param index at the call
  // site. evaluateTaint preserves `via` when propagating through binary
  // expressions and variable assignments (it copies the TaintInfo).
  const fakeTable: TaintTable = { locals: new Map() };
  // Maps every tainted local (param or derivative) → its originating
  // parameter name, so findParamForExpression can resolve through chains.
  const taintedBy = new Map<string, string>();
  for (const name of paramNames) {
    if (!name) continue;
    fakeTable.locals.set(name, { source: 'unknown', sanitizers: [] });
    taintedBy.set(name, name);
  }
  // Up to 3 passes for chains like A = param; B = A + '...'; C = B;
  for (let pass = 0; pass < 3; pass++) {
    const before = fakeTable.locals.size;
    walk(body as t.Node, (node) => {
      if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) && node.init) {
        const taint = evaluateTaint(node.init, fakeTable);
        if (taint) {
          fakeTable.locals.set(node.id.name, taint);
          // Propagate the originating param name from any identifier read
          // in the initializer.
          const origin = firstTaintedOrigin(node.init, taintedBy);
          if (origin) taintedBy.set(node.id.name, origin);
        }
      } else if (
        t.isAssignmentExpression(node) &&
        node.operator === '=' &&
        t.isIdentifier(node.left)
      ) {
        const taint = evaluateTaint(node.right, fakeTable);
        if (taint) {
          fakeTable.locals.set(node.left.name, taint);
          const origin = firstTaintedOrigin(node.right, taintedBy);
          if (origin) taintedBy.set(node.left.name, origin);
        }
      }
      return true;
    });
    if (fakeTable.locals.size === before) break;
  }

  walk(body as t.Node, (node) => {
    // Sink checks
    if (t.isCallExpression(node)) {
      const name = calleeName(node.callee);

      // Direct, well-known sink?
      for (const spec of SINKS) {
        if (!spec.match(name)) continue;
        const argIndex = spec.argIndex < 0 ? node.arguments.length - 1 : spec.argIndex;
        const arg = node.arguments[argIndex] as t.Node | undefined;
        if (!arg) continue;
        const taint = evaluateTaint(arg, fakeTable);
        if (!taint) continue;
        const paramIndex = findParamForExpressionThrough(arg, paramNames, taintedBy);
        if (paramIndex < 0) continue;
        sinks.push({ paramIndex, category: spec.category, sanitizers: taint.sanitizers });
      }

      // Or a call to another summarized function that we already know
      // is a sink. Propagate that summary back: param at our call site
      // becomes a sink position too.
      const calleeSummary = name && summaries.get(name);
      if (calleeSummary) {
        for (const calleeSink of calleeSummary.sinks) {
          const arg = node.arguments[calleeSink.paramIndex] as t.Node | undefined;
          if (!arg) continue;
          const taint = evaluateTaint(arg, fakeTable);
          if (!taint) continue;
          const paramIndex = findParamForExpressionThrough(arg, paramNames, taintedBy);
          if (paramIndex < 0) continue;
          sinks.push({
            paramIndex,
            category: calleeSink.category,
            sanitizers: [...taint.sanitizers, ...calleeSink.sanitizers],
          });
        }
      }
    }
    // Return statements
    if (t.isReturnStatement(node) && node.argument) {
      const taint = evaluateTaint(node.argument, fakeTable);
      if (taint) {
        returnsTaint = true;
        returnSanitizers.push(...taint.sanitizers);
      }
    }
    return true;
  });

  // Arrow function with expression body: the body IS the return.
  if (!t.isBlockStatement(body)) {
    const taint = evaluateTaint(body, fakeTable);
    if (taint) {
      returnsTaint = true;
      returnSanitizers.push(...taint.sanitizers);
    }
  }

  // Dedupe sinks
  const dedup = new Map<string, ParamSink>();
  for (const s of sinks) {
    const k = `${s.paramIndex}|${s.category}|${s.sanitizers.join(',')}`;
    if (!dedup.has(k)) dedup.set(k, s);
  }
  return {
    sinks: [...dedup.values()],
    returnsTaint,
    returnSanitizers: [...new Set(returnSanitizers)],
  };
}

/**
 * Heuristic: given an argument expression, return which parameter index
 * it most likely corresponds to. We walk it looking for any Identifier
 * whose name is in `paramNames`. If found, return that index. -1 if not.
 */
function findParamForExpression(node: t.Node, paramNames: string[]): number {
  let result = -1;
  walk(node, (n) => {
    if (result >= 0) return false;
    if (t.isIdentifier(n)) {
      const idx = paramNames.indexOf(n.name);
      if (idx >= 0) {
        result = idx;
        return false;
      }
    }
    return true;
  });
  return result;
}

/**
 * Like findParamForExpression but follows the `taintedBy` chain for any
 * identifier we don't find directly in paramNames. Handles the
 * intermediate-variable case (`const q = '...' + id; db.query(q)`).
 */
function findParamForExpressionThrough(
  node: t.Node,
  paramNames: string[],
  taintedBy: Map<string, string>
): number {
  let result = -1;
  walk(node, (n) => {
    if (result >= 0) return false;
    if (t.isIdentifier(n)) {
      // Direct match
      const direct = paramNames.indexOf(n.name);
      if (direct >= 0) {
        result = direct;
        return false;
      }
      // Through the taintedBy chain
      const origin = taintedBy.get(n.name);
      if (origin) {
        const idx = paramNames.indexOf(origin);
        if (idx >= 0) {
          result = idx;
          return false;
        }
      }
    }
    return true;
  });
  return result;
}

/**
 * Walks an expression looking for an identifier whose name maps (directly
 * or through the taintedBy chain) to an original parameter. Returns the
 * originating parameter name (or null).
 */
function firstTaintedOrigin(node: t.Node, taintedBy: Map<string, string>): string | null {
  let origin: string | null = null;
  walk(node, (n) => {
    if (origin) return false;
    if (t.isIdentifier(n)) {
      const o = taintedBy.get(n.name);
      if (o) {
        origin = o;
        return false;
      }
    }
    return true;
  });
  return origin;
}

/* -------------------------------------------------------------------------- */
/* Resolving function expressions assigned to variables                       */
/* -------------------------------------------------------------------------- */

/**
 * Walk the file looking for `const name = function() {...}` or
 * `const name = (a, b) => ...` patterns. Returns a map of variable
 * name → the function node, so the summary collector can name them.
 */
export function collectFunctionAliases(ast: t.File): Map<string, t.Node> {
  const aliases = new Map<string, t.Node>();
  walk(ast, (node) => {
    if (t.isVariableDeclarator(node) && t.isIdentifier(node.id) && node.init) {
      if (t.isFunctionExpression(node.init) || t.isArrowFunctionExpression(node.init)) {
        aliases.set(node.id.name, node.init);
      }
    }
    if (t.isAssignmentExpression(node) && node.operator === '=' && t.isIdentifier(node.left)) {
      if (t.isFunctionExpression(node.right) || t.isArrowFunctionExpression(node.right)) {
        aliases.set(node.left.name, node.right);
      }
    }
    return true;
  });
  return aliases;
}

/**
 * Re-run the summary collector with aliases in mind: any function expression
 * we see paired with a variable name gets registered under that name.
 */
export function collectFunctionSummariesWithAliases(ast: t.File): FunctionSummaryTable {
  const aliases = collectFunctionAliases(ast);
  const byName = new Map<string, FunctionSummary>();

  for (let pass = 0; pass < 4; pass++) {
    const before = JSON.stringify([...byName.entries()]);

    // Named function declarations
    walk(ast, (node) => {
      if (t.isFunctionDeclaration(node) && node.id) {
        const paramNames = collectParamNames(node.params);
        if (paramNames.length === 0) return true;
        const summary = analyzeFunctionBody(node.body, paramNames, byName);
        byName.set(node.id.name, summary);
      }
      return true;
    });

    // Aliased function expressions / arrow functions
    for (const [name, fn] of aliases) {
      const asFn = asFunction(fn);
      if (!asFn) continue;
      const paramNames = collectParamNames(asFn.params);
      if (paramNames.length === 0) continue;
      const summary = analyzeFunctionBody(asFn.body, paramNames, byName);
      byName.set(name, summary);
    }

    if (JSON.stringify([...byName.entries()]) === before) break;
  }

  return { byName };
}
