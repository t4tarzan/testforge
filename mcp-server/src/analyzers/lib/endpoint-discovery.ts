// AST-aware route-handler discovery.
//
// Finds the real HTTP endpoints registered in source code so we can
// cross-reference them against an OpenAPI / Swagger spec. Recognized
// patterns:
//
//   express / fastify / koa-router:
//     app.get('/users/:id', handler)
//     router.post('/items', mw, handler)
//     fastify.put('/x', { schema: … }, handler)
//
//   chained / namespaced routers:
//     v1Router.delete('/items/:id', ...)
//
//   Hono / itty-router:
//     hono.get('/x', ...) — same shape
//
//   Next.js / app-router: skipped (file-based routing; out of scope here).
//
// Out of scope by design:
//   - dynamic path strings (variable, not a literal)
//   - higher-order helpers (`routes.forEach(r => app.get(r.path, ...))`)
//     — we can't statically resolve those without running the code.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk } from './visitors.js';
import { canonicalPath } from './openapi-parse.js';

export interface DiscoveredEndpoint {
  /** Path as written in the source code, e.g. "/users/:id". */
  path: string;
  /** Lowercased HTTP method, e.g. "get". */
  method: string;
  /** Source file the registration was found in. */
  filePath: string;
  /** Line of the registration call. */
  line: number;
  /** Bare receiver name: `app`, `router`, `fastify`, etc. */
  receiverName: string;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all']);

// Recognize identifiers that "look like a server / router / app handle".
// We match by name shape rather than imports to keep this useful even
// when the user assigns the server to a custom variable name.
const RECEIVER_NAME_RE = /^(?:app|server|router|api|v\d+Router|hono|fastify|koa|express|router\d*)$/i;

export function discoverEndpoints(filePath: string, ast: File): DiscoveredEndpoint[] {
  const out: DiscoveredEndpoint[] = [];

  walk(ast, (node) => {
    if (!t.isCallExpression(node)) return true;
    const callee = node.callee;
    if (!t.isMemberExpression(callee) || callee.computed) return true;

    const receiver = callee.object;
    const methodNode = callee.property;
    if (!t.isIdentifier(receiver)) return true;
    if (!t.isIdentifier(methodNode)) return true;

    const method = methodNode.name.toLowerCase();
    if (!HTTP_METHODS.has(method)) return true;
    if (!RECEIVER_NAME_RE.test(receiver.name)) return true;

    const firstArg = node.arguments[0];
    if (!firstArg) return true;

    // Only handle literal paths. Skip dynamic ones (template literal,
    // identifier, member expression).
    let pathStr: string | null = null;
    if (t.isStringLiteral(firstArg)) {
      pathStr = firstArg.value;
    } else if (t.isTemplateLiteral(firstArg) && firstArg.expressions.length === 0 && firstArg.quasis.length === 1) {
      pathStr = firstArg.quasis[0].value.cooked ?? null;
    }
    if (!pathStr) return true;
    if (!pathStr.startsWith('/')) return true; // not a path

    out.push({
      path: pathStr,
      method,
      filePath,
      line: node.loc?.start.line ?? 1,
      receiverName: receiver.name,
    });
    return true;
  });

  return out;
}

/**
 * Build a Set of canonical "method path" strings from a list of
 * endpoints. Useful for membership checks against an OpenAPI set.
 */
export function endpointSet(endpoints: Array<{ path: string; method: string }>): Set<string> {
  const set = new Set<string>();
  for (const e of endpoints) {
    set.add(`${e.method} ${canonicalPath(e.path)}`);
  }
  return set;
}
