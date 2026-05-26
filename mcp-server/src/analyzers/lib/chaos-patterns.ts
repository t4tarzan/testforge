// AST-based chaos / resilience pattern detection.
//
// Pass 6 (load) already detected circuit breakers, timeouts on
// outbound calls, and health endpoints. Pass 10 adds the pure
// fault-tolerance patterns that aren't already covered:
//
//   - graceful shutdown      (process.on('SIGTERM'|'SIGINT', ...) + server.close())
//   - retry libraries        (p-retry, async-retry, axios-retry imports + calls)
//   - manual retry loops     (for/while with try/catch + setTimeout — heuristic)
//   - global error middleware
//        Express:  app.use((err, req, res, next) => ...)
//        Fastify:  app.setErrorHandler(...) / fastify.setErrorHandler(...)
//   - process-level safety
//        process.on('unhandledRejection'|'uncaughtException', ...)
//   - idempotency-key reads  (req.headers['Idempotency-Key'] / req.get(...))
//
// Out of scope:
//   - Bulkheading (separate pools) — requires data-flow analysis on
//     pool configurations.
//   - Saga / compensating transactions — pattern is too varied to
//     detect reliably with shallow AST passes.

import * as t from '@babel/types';
import type { File } from '@babel/types';
import { walk, getCalleeName } from './visitors.js';

export interface ChaosPatternHit {
  filePath: string;
  line: number;
  pattern: string;
}

export interface ChaosPatterns {
  /** process.on('SIGTERM'|'SIGINT', handler) where the handler closes the server */
  gracefulShutdown: ChaosPatternHit[];
  /** Retry library imports + their call sites */
  retryHits: ChaosPatternHit[];
  /** Manual retry loops (for/while + try/catch + setTimeout) — heuristic */
  manualRetryLoops: ChaosPatternHit[];
  /** Express/Fastify global error handler registrations */
  errorHandlers: ChaosPatternHit[];
  /** process.on('unhandledRejection'|'uncaughtException', ...) */
  processGuards: ChaosPatternHit[];
  /** Reading the Idempotency-Key header */
  idempotencyKey: ChaosPatternHit[];
  /** AbortController / signal-based cancellation */
  abortControllers: ChaosPatternHit[];
}

const SIGNAL_NAMES = new Set(['SIGTERM', 'SIGINT', 'SIGQUIT']);
const PROCESS_GUARD_EVENTS = new Set(['unhandledRejection', 'uncaughtException', 'beforeExit']);
const RETRY_MODULES = new Set([
  'p-retry', 'async-retry', 'axios-retry', 'retry',
  'exponential-backoff', 'retry-axios', 'cockatiel',
]);
const RETRY_CALL_NAMES = new Set([
  'pRetry', 'asyncRetry', 'retry', 'exponentialBackoff', 'backOff',
]);
const IDEMPOTENCY_KEYS = new Set(['idempotency-key', 'Idempotency-Key']);

export function findChaosPatterns(filePath: string, ast: File): ChaosPatterns {
  const out: ChaosPatterns = {
    gracefulShutdown: [],
    retryHits: [],
    manualRetryLoops: [],
    errorHandlers: [],
    processGuards: [],
    idempotencyKey: [],
    abortControllers: [],
  };

  walk(ast, (node) => {
    // ── process.on('SIGTERM', handler) / process.once('SIGTERM', handler)
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.object, { name: 'process' })
      && t.isIdentifier(node.callee.property)
      && (node.callee.property.name === 'on' || node.callee.property.name === 'once')
      && node.arguments.length >= 2
      && t.isStringLiteral(node.arguments[0])
    ) {
      const event = node.arguments[0].value;
      if (SIGNAL_NAMES.has(event)) {
        out.gracefulShutdown.push(hit(filePath, node, `process.${node.callee.property.name}('${event}', …)`));
      } else if (PROCESS_GUARD_EVENTS.has(event)) {
        out.processGuards.push(hit(filePath, node, `process.${node.callee.property.name}('${event}', …)`));
      }
    }

    // ── Retry library imports
    if (t.isImportDeclaration(node) && RETRY_MODULES.has(node.source.value)) {
      out.retryHits.push(hit(filePath, node, `import '${node.source.value}'`));
    }
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'require' })
      && node.arguments.length >= 1 && t.isStringLiteral(node.arguments[0])
      && RETRY_MODULES.has(node.arguments[0].value)
    ) {
      out.retryHits.push(hit(filePath, node, `require('${node.arguments[0].value}')`));
    }

    // ── Retry function calls: pRetry(fn) / asyncRetry(fn) / backOff(fn)
    if (t.isCallExpression(node) && t.isIdentifier(node.callee) && RETRY_CALL_NAMES.has(node.callee.name)) {
      out.retryHits.push(hit(filePath, node, `${node.callee.name}(…)`));
    }
    // axios-retry: `axiosRetry(client, { retries: N })` — module + first arg pattern
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'axiosRetry' })) {
      out.retryHits.push(hit(filePath, node, 'axiosRetry(…)'));
    }

    // ── new AbortController()
    if (t.isNewExpression(node) && t.isIdentifier(node.callee, { name: 'AbortController' })) {
      out.abortControllers.push(hit(filePath, node, 'new AbortController()'));
    }

    // ── Express global error middleware: app.use((err, req, res, next) => …)
    //    Signature with 4 params is the discriminator in Express.
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.property, { name: 'use' })
      && t.isIdentifier(node.callee.object)
      && /^(?:app|server|router|api|express)$/i.test(node.callee.object.name)
    ) {
      for (const arg of node.arguments) {
        if ((t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) && arg.params.length === 4) {
          out.errorHandlers.push(hit(filePath, node, `${node.callee.object.name}.use(err, req, res, next)`));
        }
      }
    }

    // ── Fastify error handler: app.setErrorHandler(...) / fastify.setErrorHandler(...)
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.property, { name: 'setErrorHandler' })
    ) {
      out.errorHandlers.push(hit(filePath, node, 'fastify.setErrorHandler(…)'));
    }

    // ── Idempotency-Key reads: req.headers['Idempotency-Key'] / req.get('idempotency-key')
    if (t.isMemberExpression(node) && node.computed) {
      const prop = node.property;
      if (t.isStringLiteral(prop) && IDEMPOTENCY_KEYS.has(prop.value)) {
        out.idempotencyKey.push(hit(filePath, node, `req.headers['${prop.value}']`));
      }
    }
    if (t.isCallExpression(node)
      && t.isMemberExpression(node.callee) && !node.callee.computed
      && t.isIdentifier(node.callee.property, { name: 'get' })
      && node.arguments[0] && t.isStringLiteral(node.arguments[0])
      && IDEMPOTENCY_KEYS.has(node.arguments[0].value)
    ) {
      out.idempotencyKey.push(hit(filePath, node, `req.get('${node.arguments[0].value}')`));
    }

    return true;
  });

  // Manual retry loops: a for/while statement whose body contains BOTH a
  // try-catch AND a setTimeout call. Heuristic, but useful — catches
  // hand-rolled exponential backoff implementations.
  walk(ast, (node) => {
    const isLoop =
      t.isForStatement(node) || t.isWhileStatement(node) ||
      t.isDoWhileStatement(node) || t.isForOfStatement(node) || t.isForInStatement(node);
    if (!isLoop) return true;
    const loopNode = node as t.ForStatement | t.WhileStatement | t.DoWhileStatement | t.ForOfStatement | t.ForInStatement;
    let hasTryCatch = false;
    let hasSetTimeout = false;
    walk(loopNode.body as t.Node, (inner) => {
      if (t.isTryStatement(inner) && inner.handler) hasTryCatch = true;
      if (t.isCallExpression(inner) && getCalleeName(inner.callee).split('.').pop() === 'setTimeout') {
        hasSetTimeout = true;
      }
      return true;
    });
    if (hasTryCatch && hasSetTimeout) {
      out.manualRetryLoops.push(hit(filePath, loopNode, 'loop + try/catch + setTimeout (manual retry)'));
    }
    return true;
  });

  return out;
}

function hit(filePath: string, node: t.Node, pattern: string): ChaosPatternHit {
  return {
    filePath,
    line: node.loc?.start.line ?? 1,
    pattern,
  };
}
