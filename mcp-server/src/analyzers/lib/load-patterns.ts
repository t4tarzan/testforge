// AST-based load / performance pattern detection.
//
// The prior line-level checks tried to infer middleware presence from
// substring matches like `allContent.includes('rateLimit')`. That has
// obvious failure modes:
//   - any variable named `rateLimitConfig` matched, even if no
//     middleware was ever applied
//   - `cache` matched any of `cacheKey`, `cached`, `Cache-Control`,
//     even inside comments
//   - the circuit-breaker check had a precedence bug:
//        `!hasCircuitBreaker && allContent.includes('fetch') || ...`
//     so the right-hand `||` swallowed everything and the rule fired
//     on every codebase with fetch in it.
//
// This module walks ASTs for ACTUAL middleware registrations and call
// patterns, scoped to where they matter. We don't return findings
// directly — we return a `LoadPatterns` snapshot the analyzer then
// turns into severity-graded findings.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk, getCalleeName } from './visitors.js';

export interface LoadPatternsHit {
  filePath: string;
  line: number;
  /** Short label for the user-visible finding. */
  pattern: string;
}

export interface LoadPatterns {
  /** `app.use(rateLimit(...))` / `fastify.register(fastifyRateLimit)` / `koa.use(ratelimit(...))` */
  rateLimitRegistrations: LoadPatternsHit[];
  /** `app.use(compression())` / `fastify.register(compress)` */
  compressionRegistrations: LoadPatternsHit[];
  /** `redis.get/set/incr`, `cache.get/set`, `memcached.*` calls */
  cacheCalls: LoadPatternsHit[];
  /** `new Pool(...)`, `mysql.createPool(...)`, `new pg.Pool(...)` */
  poolConstructions: LoadPatternsHit[];
  /** `server.timeout = N`, `app.timeout(N)`, `axios.create({ timeout })` etc. */
  timeoutSets: LoadPatternsHit[];
  /** Route registrations matching /health, /healthz, /ready, /live */
  healthEndpoints: LoadPatternsHit[];
  /** Circuit breaker imports (opossum, brakes) or `breaker.fire(...)` calls. */
  circuitBreakerHits: LoadPatternsHit[];
  /** readFileSync / writeFileSync / execSync etc. inside route handlers (heuristic) */
  syncIoInHandlers: LoadPatternsHit[];
}

const CACHE_RECEIVER_RE = /^(?:redis|cache|memcached|memCache|kv|ioredis|cacheClient)\d*$/i;
const POOL_CTORS = new Set(['Pool', 'createPool']);
const HEALTH_PATH_RE = /^\/(?:health|healthz|liveness|readiness|ready|live|status|ping)\b/i;
const SYNC_IO_NAMES = new Set([
  'readFileSync', 'writeFileSync', 'appendFileSync', 'readdirSync',
  'statSync', 'existsSync', 'unlinkSync', 'mkdirSync', 'rmSync',
  'execSync', 'spawnSync',
]);

/** Patterns the analyzer cares about — collected from a single file's AST. */
export function findLoadPatterns(filePath: string, ast: File): LoadPatterns {
  const out: LoadPatterns = {
    rateLimitRegistrations: [],
    compressionRegistrations: [],
    cacheCalls: [],
    poolConstructions: [],
    timeoutSets: [],
    healthEndpoints: [],
    circuitBreakerHits: [],
    syncIoInHandlers: [],
  };

  // Pass 1: top-level signals (middleware registrations, pool constructions,
  // route registrations, cache calls, timeouts).
  walk(ast, (node) => {
    // ── app.use(rateLimit(...)) / app.use(compression())
    if (t.isCallExpression(node)) {
      const callee = node.callee;

      // app.use(X(...)) — where X is a call
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property, { name: 'use' })) {
        for (const arg of node.arguments) {
          if (t.isCallExpression(arg)) {
            const inner = arg.callee;
            const innerName = t.isIdentifier(inner) ? inner.name : '';
            if (matchesRateLimitFn(innerName)) {
              out.rateLimitRegistrations.push(hit(filePath, node, `app.use(${innerName}(...))`));
            } else if (matchesCompressionFn(innerName)) {
              out.compressionRegistrations.push(hit(filePath, node, `app.use(${innerName}(...))`));
            }
          } else if (t.isIdentifier(arg)) {
            if (matchesRateLimitFn(arg.name)) {
              out.rateLimitRegistrations.push(hit(filePath, node, `app.use(${arg.name})`));
            }
            if (matchesCompressionFn(arg.name)) {
              out.compressionRegistrations.push(hit(filePath, node, `app.use(${arg.name})`));
            }
          }
        }
      }

      // fastify.register(X)
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.property, { name: 'register' })) {
        const a = node.arguments[0];
        if (t.isIdentifier(a)) {
          if (matchesRateLimitFn(a.name)) {
            out.rateLimitRegistrations.push(hit(filePath, node, `fastify.register(${a.name})`));
          }
          if (matchesCompressionFn(a.name)) {
            out.compressionRegistrations.push(hit(filePath, node, `fastify.register(${a.name})`));
          }
        }
      }

      // redis.get / cache.set / etc.
      if (t.isMemberExpression(callee) && !callee.computed
        && t.isIdentifier(callee.object) && CACHE_RECEIVER_RE.test(callee.object.name)
        && t.isIdentifier(callee.property)
        && ['get', 'set', 'incr', 'decr', 'mget', 'hget', 'hset', 'expire', 'del'].includes(callee.property.name)
      ) {
        out.cacheCalls.push(hit(filePath, node, `${callee.object.name}.${callee.property.name}()`));
      }

      // new Pool({...}) / mysql.createPool / pg.Pool — handled below via NewExpression too
      const calleeName = getCalleeName(callee);
      if (POOL_CTORS.has(calleeName.split('.').pop() ?? '')) {
        out.poolConstructions.push(hit(filePath, node, calleeName));
      }

      // axios.create({ timeout: N })
      if (
        t.isMemberExpression(callee) && !callee.computed
        && t.isIdentifier(callee.object, { name: 'axios' })
        && t.isIdentifier(callee.property, { name: 'create' })
        && node.arguments[0] && t.isObjectExpression(node.arguments[0])
        && hasObjectProp(node.arguments[0], 'timeout')
      ) {
        out.timeoutSets.push(hit(filePath, node, 'axios.create({ timeout })'));
      }

      // fetch(url, { signal: AbortSignal.timeout(N) })
      if (t.isIdentifier(callee, { name: 'fetch' }) && node.arguments.length >= 2) {
        const opts = node.arguments[1];
        if (t.isObjectExpression(opts) && hasObjectProp(opts, 'signal')) {
          out.timeoutSets.push(hit(filePath, node, 'fetch(..., { signal })'));
        }
      }

      // app.get('/health', ...) / router.get(...) — receiver-name heuristic
      if (
        t.isMemberExpression(callee) && !callee.computed
        && t.isIdentifier(callee.property) && callee.property.name === 'get'
        && t.isIdentifier(callee.object)
      ) {
        const firstArg = node.arguments[0];
        if (firstArg && t.isStringLiteral(firstArg) && HEALTH_PATH_RE.test(firstArg.value)) {
          out.healthEndpoints.push(hit(filePath, node, `${callee.object.name}.get('${firstArg.value}')`));
        }
      }

      // breaker.fire(...) — opossum-style
      if (t.isMemberExpression(callee) && !callee.computed
        && t.isIdentifier(callee.property, { name: 'fire' })
        && t.isIdentifier(callee.object)
        && /breaker$/i.test(callee.object.name)
      ) {
        out.circuitBreakerHits.push(hit(filePath, node, `${callee.object.name}.fire()`));
      }
    }

    // new Pool / new pg.Pool
    if (t.isNewExpression(node)) {
      const ctor = node.callee;
      if (t.isIdentifier(ctor) && POOL_CTORS.has(ctor.name)) {
        out.poolConstructions.push(hit(filePath, node, `new ${ctor.name}()`));
      } else if (t.isMemberExpression(ctor) && t.isIdentifier(ctor.property) && POOL_CTORS.has(ctor.property.name)) {
        out.poolConstructions.push(hit(filePath, node, `new ${getCalleeName(ctor)}()`));
      }
    }

    // server.timeout = N
    if (t.isAssignmentExpression(node) && node.operator === '=') {
      const left = node.left;
      if (
        t.isMemberExpression(left) && !left.computed
        && t.isIdentifier(left.property, { name: 'timeout' })
        && (t.isNumericLiteral(node.right) || t.isIdentifier(node.right))
      ) {
        out.timeoutSets.push(hit(filePath, node, `${getCalleeName(left.object as t.Expression)}.timeout = ...`));
      }
    }

    // import opossum / brakes — circuit breakers
    if (t.isImportDeclaration(node)) {
      const spec = node.source.value;
      if (spec === 'opossum' || spec === 'brakes') {
        out.circuitBreakerHits.push(hit(filePath, node, `import '${spec}'`));
      }
    }
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'require' })
      && node.arguments.length === 1 && t.isStringLiteral(node.arguments[0])) {
      const spec = node.arguments[0].value;
      if (spec === 'opossum' || spec === 'brakes') {
        out.circuitBreakerHits.push(hit(filePath, node, `require('${spec}')`));
      }
    }

    return true;
  });

  // Pass 2: route handlers + sync I/O inside them.
  walk(ast, (node) => {
    if (!t.isCallExpression(node)) return true;
    const callee = node.callee;
    if (!t.isMemberExpression(callee) || callee.computed) return true;
    if (!t.isIdentifier(callee.property)) return true;
    const method = callee.property.name;
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return true;
    if (!t.isIdentifier(callee.object)) return true;
    const receiverName = callee.object.name;
    if (!/^(?:app|server|router|api|fastify|koa|hono|v\d+Router)$/i.test(receiverName)) return true;

    const handler = node.arguments[node.arguments.length - 1];
    if (!handler) return true;

    walk(handler, (inner) => {
      if (!t.isCallExpression(inner)) return true;
      const innerName = getCalleeName(inner.callee).split('.').pop() ?? '';
      if (SYNC_IO_NAMES.has(innerName)) {
        out.syncIoInHandlers.push(hit(filePath, inner, `${innerName}() inside ${receiverName}.${method}() handler`));
      }
      return true;
    });
    return true;
  });

  return out;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function hit(filePath: string, node: t.Node, pattern: string): LoadPatternsHit {
  return {
    filePath,
    line: node.loc?.start.line ?? 1,
    pattern,
  };
}

function matchesRateLimitFn(name: string): boolean {
  return /(?:^|[A-Z._])(?:rateLimit|ratelimit|rateLimiter|fastifyRateLimit|throttle|expressRateLimit)$/i.test(name)
    || name === 'rateLimit'
    || name === 'fastifyRateLimit'
    || name === 'koaRatelimit';
}

function matchesCompressionFn(name: string): boolean {
  return name === 'compression' || /(?:^|[A-Z])compress$/i.test(name) || name === 'fastifyCompress' || name === 'koaCompress';
}

function hasObjectProp(obj: t.ObjectExpression, name: string): boolean {
  return obj.properties.some(
    (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name })
  );
}
