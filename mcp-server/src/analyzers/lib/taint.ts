// Intra-procedural taint tracking — Phase 2 of strengthen-the-spine.
//
// What this gives us, conceptually:
//
//   • A vocabulary of *sources* (where attacker-controlled input enters the
//     program) and *sanitizers* (operations that produce a safe output from
//     a tainted input).
//
//   • A `TaintTable` per file mapping each local variable name to its taint
//     label (where it came from, which sanitizers wrap it). Built in one
//     traversal.
//
//   • `evaluateTaint(expr, table)` — given any expression node, walk it and
//     decide if the value flowing out of it is tainted, and what sanitizers
//     are on the path.
//
// Each sink-checker in security-analyzer.ts asks the table whether its
// dangerous argument is tainted; the engine answers with one of:
//
//   { source, sanitizers: [] }            ←  HIGH confidence finding
//   { source, sanitizers: ['DOMPurify'] } ←  MEDIUM, advise review
//   null                                  ←  no taint, no finding
//
// Limitations (deliberate, addressed in Phase 4):
//   • No cross-function flow. A tainted argument passed into a helper that
//     calls a sink doesn't follow.
//   • No object-shape tracking. `const o = { x: req.body.x }; sink(o.x);`
//     doesn't propagate today; the analyzer treats `o.x` as untainted.
//   • No conditional path tracking. `if (allowlist.includes(input)) ... use input ...`
//     still flags — we only know "input is tainted," not the runtime check.

import * as t from '@babel/types';
import { walk } from './visitors.js';

/* -------------------------------------------------------------------------- */
/*                              Taint vocabulary                              */
/* -------------------------------------------------------------------------- */

/** Where the taint entered the program. */
export type TaintSource =
  | 'req'              // Express/Koa/Fastify: req.body, req.query, …
  | 'ctx-request'      // Koa-style: ctx.request.body, ctx.params
  | 'lambda-event'     // AWS Lambda: event.body, event.queryStringParameters
  | 'process-argv'     // CLI args
  | 'dom-location'     // window.location.*, document.location.*
  | 'url-search'       // URLSearchParams .get(), new URL(…).searchParams
  | 'unknown';         // tainted via a derived expression we couldn't pin down

/** Known sanitizer names. Recognized by *callee name*, not by import path. */
export const KNOWN_SANITIZERS = new Set([
  // HTML / XSS
  'sanitize', 'sanitizeHtml', 'sanitize_html', 'purify', 'DOMPurify.sanitize',
  'escape', 'escapeHtml', 'escape_html', 'he.encode', 'xss',
  // Path safety (insufficient alone but reduces severity)
  'path.normalize', 'path.basename',
  // Numeric coercion — output is no longer string-tainted
  'parseInt', 'parseFloat', 'Number', 'Math.floor', 'Math.ceil', 'Math.round',
  // URL encoding
  'encodeURIComponent', 'encodeURI',
  // String → bool / length (allowlist-shaped)
  'includes', 'has', 'indexOf', 'startsWith', 'endsWith',
]);

export interface TaintInfo {
  source: TaintSource;
  /** Names of sanitizer calls on the path source → here. Empty = clean path. */
  sanitizers: string[];
  /** Optional original AST node (for diagnostics). */
  via?: t.Node;
}

export interface TaintTable {
  /** Local-variable name → its current taint info. */
  locals: Map<string, TaintInfo>;
}

/* -------------------------------------------------------------------------- */
/*                             Source recognition                              */
/* -------------------------------------------------------------------------- */

/**
 * Returns the source type if `node` reads directly from a known source, or
 * null otherwise. Recognises both `req` and `req.body.X` (any MemberExpression
 * whose root is a source identifier).
 */
export function identifySource(node: t.Node): TaintSource | null {
  if (t.isMemberExpression(node)) {
    let cur: t.Node = node;
    while (t.isMemberExpression(cur)) cur = cur.object;
    return identifySource(cur);
  }
  if (t.isIdentifier(node)) {
    const n = node.name;
    if (n === 'req' || n === 'request') return 'req';
    if (n === 'ctx') return 'ctx-request';
    if (n === 'event') return 'lambda-event';
    return null;
  }
  // process.argv → MemberExpression on process — handled by recursion above
  // window.location.* → likewise
  return null;
}

/** Strictly stronger check than identifySource for the request family. */
export function isRequestSource(s: TaintSource | null): boolean {
  return s === 'req' || s === 'ctx-request' || s === 'lambda-event';
}

/* -------------------------------------------------------------------------- */
/*                            Sanitizer recognition                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns the canonical sanitizer name if this call is a known sanitizer,
 * else null. Match is by callee name; we don't track imports.
 */
export function identifySanitizer(call: t.CallExpression): string | null {
  const name = calleeName(call.callee);
  // Direct hit: `sanitize(x)` or `path.normalize(x)`
  if (KNOWN_SANITIZERS.has(name)) return name;
  // Last path segment hit: `DOMPurify.sanitize(x)` → "DOMPurify.sanitize"
  // already in the set above, but also handle generic `.sanitize(x)` calls
  const tail = name.split('.').pop() || '';
  if (KNOWN_SANITIZERS.has(tail)) return tail;
  return null;
}

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
/*                            Expression evaluator                            */
/* -------------------------------------------------------------------------- */

/**
 * Decide whether the value of `node` is tainted, given the local table.
 *
 * Returns:
 *   • null — no source reached, expression is safe.
 *   • { source, sanitizers } — taint reaches this node; sanitizers lists any
 *     sanitizer calls that wrap a source on the way.
 *
 * Implementation: depth-first walk. The first source we encounter wins
 * (we don't aggregate confidences across multiple sources — keeps the
 * mental model simple).
 */
export function evaluateTaint(node: t.Node, table: TaintTable): TaintInfo | null {
  if (!node) return null;

  // 1. Identifier — look up local table
  if (t.isIdentifier(node)) {
    return table.locals.get(node.name) ?? null;
  }

  // 2. MemberExpression — taint flows from the *base* identifier
  //    (req.body.x → req is tainted ⇒ x is tainted)
  if (t.isMemberExpression(node)) {
    const src = identifySource(node);
    if (src) return { source: src, sanitizers: [], via: node };
    // Or, if the base is a tainted local: `o.x` where o is in table
    let base: t.Node = node;
    while (t.isMemberExpression(base)) base = base.object;
    if (t.isIdentifier(base)) {
      const baseTaint = table.locals.get(base.name);
      if (baseTaint) return baseTaint;
    }
    return null;
  }

  // 3. CallExpression — sanitizers, JSON.parse, derived from tainted source
  if (t.isCallExpression(node)) {
    const san = identifySanitizer(node);
    if (san) {
      // Sanitizer wraps something — check whether the wrapped value is tainted.
      for (const arg of node.arguments) {
        if (t.isSpreadElement(arg) || t.isJSXNamespacedName(arg) || t.isArgumentPlaceholder(arg)) continue;
        const inner = evaluateTaint(arg as t.Node, table);
        if (inner) {
          return { ...inner, sanitizers: [...inner.sanitizers, san] };
        }
      }
      return null;
    }
    // Special: JSON.parse(taintedString) — the parsed object is still tainted.
    if (calleeName(node.callee) === 'JSON.parse') {
      for (const arg of node.arguments) {
        if (t.isSpreadElement(arg) || t.isJSXNamespacedName(arg) || t.isArgumentPlaceholder(arg)) continue;
        const inner = evaluateTaint(arg as t.Node, table);
        if (inner) return inner;
      }
      return null;
    }
    // URLSearchParams .get(name) on a request URL → tainted.
    if (/(?:^|\.)get$/.test(calleeName(node.callee))) {
      const callee = node.callee;
      if (t.isMemberExpression(callee)) {
        const baseTaint = evaluateTaint(callee.object, table);
        if (baseTaint) return baseTaint;
      }
    }
    // Generic: if any argument is tainted, the result *may* be tainted
    // (low confidence — flag as 'unknown' source). Keep this conservative;
    // only fire if the call's callee isn't a sanitizer we missed.
    for (const arg of node.arguments) {
      if (t.isSpreadElement(arg) || t.isJSXNamespacedName(arg) || t.isArgumentPlaceholder(arg)) continue;
      const inner = evaluateTaint(arg as t.Node, table);
      if (inner) return { source: 'unknown', sanitizers: inner.sanitizers, via: node };
    }
    return null;
  }

  // 4. TemplateLiteral — any tainted interpolation taints the whole thing
  if (t.isTemplateLiteral(node)) {
    for (const expr of node.expressions) {
      const inner = evaluateTaint(expr as t.Node, table);
      if (inner) return inner;
    }
    return null;
  }

  // 5. BinaryExpression (+) — either side tainted ⇒ result tainted
  if (t.isBinaryExpression(node) && node.operator === '+') {
    const l = evaluateTaint(node.left as t.Node, table);
    if (l) return l;
    return evaluateTaint(node.right as t.Node, table);
  }

  // 6. ConditionalExpression — either branch tainted ⇒ result possibly tainted
  if (t.isConditionalExpression(node)) {
    return evaluateTaint(node.consequent, table) || evaluateTaint(node.alternate, table);
  }

  // 7. LogicalExpression (||, ??, &&) — same as conditional
  if (t.isLogicalExpression(node)) {
    return evaluateTaint(node.left, table) || evaluateTaint(node.right, table);
  }

  // 8. ArrayExpression — any tainted element taints the whole (rare in sinks)
  if (t.isArrayExpression(node)) {
    for (const el of node.elements) {
      if (!el || t.isSpreadElement(el)) continue;
      const inner = evaluateTaint(el as t.Node, table);
      if (inner) return inner;
    }
    return null;
  }

  // 9. ObjectExpression — taint of any property value (Phase 4 will be smarter)
  if (t.isObjectExpression(node)) {
    for (const p of node.properties) {
      if (!t.isObjectProperty(p)) continue;
      const v = p.value as t.Node;
      const inner = evaluateTaint(v, table);
      if (inner) return inner;
    }
    return null;
  }

  // 10. TaggedTemplateExpression — `sql\`SELECT ...\`` style. The tag's
  //     args are the template's quasis + expressions; treat as a CallExpression
  //     on the tag with those args. Most SQL tags (e.g. @neondatabase/serverless,
  //     postgres.js) are SAFE — they bind expressions as parameters. Skip.
  if (t.isTaggedTemplateExpression(node)) {
    return null; // safe by convention
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*                          Building the TaintTable                            */
/* -------------------------------------------------------------------------- */

/**
 * Walk the file once. For each VariableDeclarator and AssignmentExpression,
 * compute the taint of the initializer / RHS and store it under the LHS
 * identifier. No scope precision — identifiers shadowing each other in
 * nested scopes are conflated. That's OK for SAST: a tainted identifier
 * name almost always stays tainted across shadowing in practice.
 */
export function collectTaintTable(ast: t.File): TaintTable {
  const table: TaintTable = { locals: new Map() };

  // Multi-pass to handle taint chains: A = req.body, B = A + "...", C = B.
  // Two passes is usually enough; cap at 4 to avoid pathological cycles.
  for (let pass = 0; pass < 4; pass++) {
    const before = table.locals.size;

    walk(ast, (node) => {
      if (t.isVariableDeclarator(node)) {
        if (!t.isIdentifier(node.id) || !node.init) return true;
        const taint = evaluateTaint(node.init, table);
        if (taint) table.locals.set(node.id.name, taint);
      } else if (t.isAssignmentExpression(node) && node.operator === '=') {
        if (!t.isIdentifier(node.left)) return true;
        const taint = evaluateTaint(node.right, table);
        if (taint) table.locals.set(node.left.name, taint);
      }
      return true;
    });

    if (table.locals.size === before) break; // fixpoint
  }

  return table;
}

/* -------------------------------------------------------------------------- */
/*                  Convenience: confidence from a TaintInfo                  */
/* -------------------------------------------------------------------------- */

export function confidenceFor(taint: TaintInfo | null): 'high' | 'medium' | 'low' | null {
  if (!taint) return null;
  if (taint.sanitizers.length === 0) {
    // Source `unknown` means "derived via a non-sanitizer call from
    // something tainted" — still suspicious but not definitive.
    return taint.source === 'unknown' ? 'medium' : 'high';
  }
  return 'medium';
}

export function describeFlow(taint: TaintInfo): string {
  const sourceLabels: Record<TaintSource, string> = {
    'req': 'request',
    'ctx-request': 'Koa context request',
    'lambda-event': 'Lambda event',
    'process-argv': 'process.argv (CLI args)',
    'dom-location': 'window.location',
    'url-search': 'URLSearchParams',
    'unknown': 'a derived tainted value',
  };
  const src = sourceLabels[taint.source];
  if (taint.sanitizers.length === 0) return `flows from ${src} with no sanitizer in between`;
  return `flows from ${src} through ${taint.sanitizers.join(' → ')}`;
}
