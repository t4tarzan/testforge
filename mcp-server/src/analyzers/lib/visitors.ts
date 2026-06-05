// Node-classification predicates used by the security analyzer.
//
// Each helper takes a Babel node and answers a yes/no question about it.
// Helpers stay narrow on purpose — easier to test and to compose at the
// callsite than a single mega-classifier. When we move to taint-tracking
// in Phase 2, these become the "is this a source / sink / sanitizer"
// vocabulary.

import * as t from '@babel/types';

/* -------------------------------------------------------------------------- */
/* Request-borne user input                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Returns true if the node reads from a request object — `req.body`,
 * `req.body.X`, `req.query.X`, `req.params`, `req.headers`, etc.
 * Conservative: only flags when the *base* identifier is `req` or `request`.
 */
export function isReqAccess(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  // req.body, request.body
  if (t.isMemberExpression(node)) {
    let obj: t.Node = node;
    while (t.isMemberExpression(obj)) obj = obj.object;
    return t.isIdentifier(obj, { name: 'req' }) || t.isIdentifier(obj, { name: 'request' });
  }
  // Bare `req` or `request` — used like `req.body[x]` already handled by walking up
  return false;
}

/** True if any descendant of `node` reads from `req.*` / `request.*`. */
export function containsReqAccess(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  let found = false;
  walk(node, (n) => {
    if (found) return false;
    if (isReqAccess(n)) {
      found = true;
      return false;
    }
    return true;
  });
  return found;
}

/* -------------------------------------------------------------------------- */
/* Call-expression shape                                                      */
/* -------------------------------------------------------------------------- */

/** Dotted name of a callee, e.g. `db.query`, `fs.readFileSync`, or `eval`. */
export function getCalleeName(callee: t.Expression | t.V8IntrinsicIdentifier): string {
  if (t.isIdentifier(callee)) return callee.name;
  if (t.isMemberExpression(callee)) {
    const parts: string[] = [];
    let cur: t.Node = callee;
    while (t.isMemberExpression(cur)) {
      const prop = cur.property;
      if (t.isIdentifier(prop) && !cur.computed) {
        parts.unshift(prop.name);
      } else if (t.isStringLiteral(prop)) {
        parts.unshift(prop.value);
      } else {
        parts.unshift('[…]');
      }
      cur = cur.object;
    }
    if (t.isIdentifier(cur)) parts.unshift(cur.name);
    else if (t.isThisExpression(cur)) parts.unshift('this');
    return parts.join('.');
  }
  return '';
}

// Method names that are almost always a DB query regardless of receiver.
const STRONG_QUERY_METHOD = /(?:^|\.)(?:query|exec|execute|raw|findOne|findMany|findUnique|findFirst|aggregate|queryRaw|executeRaw)$/i;
// Method names that are DB-ish ONLY when the receiver looks like a DB handle.
// `get` / `find` / `all` / `run` / `count` are far too common on Maps,
// URLSearchParams, arrays, Promise, and HTTP helpers to flag unconditionally
// (this was the source of the Supabase false-positive flood: urlParams.get(),
// Promise.all(), map.get(), an http get() helper all tripped the SQL sink).
const WEAK_QUERY_METHOD = /(?:^|\.)(?:find|get|all|run|count)$/i;
// Receiver tokens that signal an actual DB handle / ORM / driver.
const DB_RECEIVER = /\b(?:db|database|conn|connection|client|pool|knex|prisma|sequelize|collection|coll|model|models|repository|repo|mongoose|mongo|sql|cursor|tx|trx|trans|transaction|queryrunner|datasource|orm|dao|pg|pgp|sqlite|d1|drizzle|stmt|statement|prepared)\b/i;

/**
 * True for DB query call sites: `db.query`, `connection.exec`,
 * `prisma.user.findMany`, `collection.find`, etc. Generic methods
 * (`get`/`find`/`all`/`run`/`count`) only count when the receiver looks
 * like a DB handle — otherwise `urlParams.get()` and `Promise.all()` would
 * be flagged as SQL injection.
 */
export function isDbQueryCall(name: string): boolean {
  if (STRONG_QUERY_METHOD.test(name)) return true;
  if (WEAK_QUERY_METHOD.test(name)) {
    const dot = name.lastIndexOf('.');
    const receiver = dot >= 0 ? name.slice(0, dot) : '';
    return DB_RECEIVER.test(receiver);
  }
  return false;
}

/** True for response writers: `res.send`, `res.json`, `res.render`, `reply.send`, etc. */
export function isResponseSink(name: string): boolean {
  return /(?:^|\.)(?:send|json|render|write|end|redirect)$/i.test(name) && /\b(?:res|reply|response|ctx)\b/.test(name);
}

/* -------------------------------------------------------------------------- */
/* String construction                                                        */
/* -------------------------------------------------------------------------- */

/**
 * True if `node` is a template literal with at least one interpolation that
 * isn't a trivial literal. `\`SELECT * FROM x\`` is safe; `\`SELECT * FROM
 * ${table}\`` is not (in a query context).
 */
export function hasUnsafeInterpolation(node: t.Node | null | undefined): boolean {
  if (!node) return false;
  if (t.isTemplateLiteral(node)) {
    return node.expressions.some((e) => !isTrivialLiteral(e as t.Node));
  }
  return false;
}

/** True if `node` is `a + b` style concatenation involving a non-literal. */
export function isStringConcatWithVar(node: t.Node | null | undefined): boolean {
  if (!node || !t.isBinaryExpression(node) || node.operator !== '+') return false;
  const left = node.left as t.Node;
  const right = node.right as t.Node;
  const leftNonTrivial = !isTrivialLiteral(left);
  const rightNonTrivial = !isTrivialLiteral(right);
  // At least one side has to be a non-literal (otherwise it's constant)
  return leftNonTrivial || rightNonTrivial;
}

export function isTrivialLiteral(node: t.Node | null | undefined): boolean {
  return !!node && (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isRegExpLiteral(node)
  );
}

/* -------------------------------------------------------------------------- */
/* Property accessors                                                         */
/* -------------------------------------------------------------------------- */

/** True if `node` is an object property whose key matches one of the names. */
export function hasPropertyNamed(node: t.Node, names: string[]): boolean {
  if (!t.isObjectExpression(node)) return false;
  return node.properties.some((p) => {
    if (!t.isObjectProperty(p)) return false;
    const k = p.key;
    if (t.isIdentifier(k)) return names.includes(k.name.toLowerCase());
    if (t.isStringLiteral(k)) return names.includes(k.value.toLowerCase());
    return false;
  });
}

/* -------------------------------------------------------------------------- */
/* Tiny inline walker                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Depth-first walk. Visitor returns false to stop descending into a subtree.
 * Avoids pulling @babel/traverse for the few places we want a local search.
 */
export function walk(node: t.Node, visit: (n: t.Node) => boolean | void): void {
  if (visit(node) === false) return;
  for (const key of Object.keys(node)) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child) continue;
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && (c as t.Node).type) walk(c as t.Node, visit);
      }
    } else if (typeof child === 'object' && (child as t.Node).type) {
      walk(child as t.Node, visit);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Location helpers                                                           */
/* -------------------------------------------------------------------------- */

export interface LocPair {
  line: number;
  column: number;
}

export function nodeLoc(node: t.Node | null | undefined): LocPair {
  const loc = node?.loc?.start;
  return { line: loc?.line ?? 0, column: loc?.column ?? 0 };
}

/** Extract the source text for a node's first line, capped at maxChars. */
export function snippetForLine(content: string, line: number, maxChars = 140): string {
  if (line <= 0) return '';
  const lines = content.split('\n');
  return (lines[line - 1] ?? '').trim().slice(0, maxChars);
}

/**
 * A window of source around `line` (default ±10 lines), capped at maxChars.
 * Unlike snippetForLine (one trimmed line for display), this keeps original
 * indentation and a `>` marker on the offending line — enough real context for
 * Tier-2 to reproduce the actual code's logic rather than a description of it.
 */
export function snippetWindow(content: string, line: number, radius = 10, maxChars = 1200): string {
  if (line <= 0) return '';
  const lines = content.split('\n');
  const start = Math.max(0, line - 1 - radius);
  const end = Math.min(lines.length, line + radius);
  const out: string[] = [];
  for (let i = start; i < end; i++) out.push(`${i + 1 === line ? '> ' : '  '}${lines[i]}`);
  return out.join('\n').slice(0, maxChars);
}
