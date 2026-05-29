import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import { parseFile, isParseable } from './lib/parse.js';
import { findLoadPatterns, type LoadPatternsHit } from './lib/load-patterns.js';

export interface LoadTestReport {
  /**
   * Static load-readiness score (0–100). Reflects which scalability capabilities
   * the codebase demonstrably has (rate limiting, caching, pooling, health
   * probes, timeouts, compression/LB/CDN) minus penalties for blocking I/O in
   * request handlers. This is a capability score, not a benchmark — actual
   * throughput comes from the live /simulate engine.
   */
  score: number;
  hasRateLimiting: boolean;
  hasCaching: boolean;
  hasConnectionPooling: boolean;
  hasCDNConfig: boolean;
  hasLoadBalancing: boolean;
  hasCompression: boolean;
  estimatedMaxConcurrentUsers: number;
  /** AST-verified pattern hits with file + line. */
  patterns: {
    rateLimit: LoadPatternsHit[];
    compression: LoadPatternsHit[];
    cache: LoadPatternsHit[];
    pool: LoadPatternsHit[];
    timeout: LoadPatternsHit[];
    healthEndpoints: LoadPatternsHit[];
    circuitBreaker: LoadPatternsHit[];
    syncIoInHandlers: LoadPatternsHit[];
  };
  findings: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    filePath: string;
    suggestion: string;
  }>;
  recommendations: string[];
}

/**
 * Analyze the codebase for load handling capabilities.
 * This is a static analysis — actual load testing would require running the application.
 */
export async function runLoadAnalysis(config: {
  projectPath: string;
  fileContents?: Record<string, string>;
  dependencies?: string[];
}): Promise<LoadTestReport> {
  const { projectPath, fileContents, dependencies = [] } = config;

  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // Load file contents if not provided
  let contents = fileContents;
  if (!contents || Object.keys(contents).length === 0) {
    contents = {};
    const patterns = ['**/*.{ts,js,tsx,jsx}', '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**'];
    const files = await glob(patterns, { cwd: projectPath, absolute: false });
    for (const f of files) {
      try {
        contents[f] = readFileSync(join(projectPath, f), 'utf-8');
      } catch { /* skip */ }
    }
  }

  const allContent = Object.values(contents).join('\n');
  const allDeps = dependencies;

  // ── AST pass: collect real call/middleware patterns per file.
  const patterns = {
    rateLimit: [] as LoadPatternsHit[],
    compression: [] as LoadPatternsHit[],
    cache: [] as LoadPatternsHit[],
    pool: [] as LoadPatternsHit[],
    timeout: [] as LoadPatternsHit[],
    healthEndpoints: [] as LoadPatternsHit[],
    circuitBreaker: [] as LoadPatternsHit[],
    syncIoInHandlers: [] as LoadPatternsHit[],
  };
  for (const [filePath, content] of Object.entries(contents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;
    const p = findLoadPatterns(filePath, parsed.ast);
    patterns.rateLimit.push(...p.rateLimitRegistrations);
    patterns.compression.push(...p.compressionRegistrations);
    patterns.cache.push(...p.cacheCalls);
    patterns.pool.push(...p.poolConstructions);
    patterns.timeout.push(...p.timeoutSets);
    patterns.healthEndpoints.push(...p.healthEndpoints);
    patterns.circuitBreaker.push(...p.circuitBreakerHits);
    patterns.syncIoInHandlers.push(...p.syncIoInHandlers);
  }

  // ── Signal aggregation: AST hit OR strong-evidence dep import.
  // Boolean flags are now backed by REAL middleware/call registration,
  // not just substring presence.
  const hasRateLimiting =
    patterns.rateLimit.length > 0 ||
    allDeps.some(d => d === 'express-rate-limit' || d === '@fastify/rate-limit' || d === 'koa-ratelimit');

  const hasCaching =
    patterns.cache.length > 0 ||
    allDeps.some(d => d === 'redis' || d === 'ioredis' || d === 'memcached' || d === 'node-cache' || d === '@upstash/redis');

  const hasConnectionPooling =
    patterns.pool.length > 0 ||
    // Prisma + Drizzle ship with built-in pooling; Sequelize too.
    allDeps.some(d => d === 'prisma' || d === '@prisma/client' || d === 'drizzle-orm' || d === 'sequelize' || d === 'pg-pool');

  // 4. Check for CDN / static file serving config
  const hasCDNConfig =
    allContent.includes('CloudFront') ||
    allContent.includes('Cloudflare') ||
    allContent.includes('CDN') ||
    allContent.includes('static') ||
    allDeps.some(d => d.includes('serve-static'));

  // 5. Check for load balancing indicators
  const hasLoadBalancing =
    allContent.includes('cluster') ||
    allContent.includes('Cluster') ||
    allContent.includes('worker') ||
    allContent.includes('WORKERS') ||
    allContent.includes('cluster.fork') ||
    allContent.includes('pm2');

  // 6. Check for response compression (AST-confirmed middleware registration)
  const hasCompression =
    patterns.compression.length > 0 ||
    allDeps.some(d => d === 'compression' || d === '@fastify/compress' || d === 'koa-compress');

  // Estimate max concurrent users based on architecture
  let estimatedMaxConcurrentUsers = 100; // baseline
  if (hasConnectionPooling) estimatedMaxConcurrentUsers += 200;
  if (hasCaching) estimatedMaxConcurrentUsers += 300;
  if (hasRateLimiting) estimatedMaxConcurrentUsers += 100; // rate limiting means they thought about it
  if (hasLoadBalancing) estimatedMaxConcurrentUsers += 500;
  if (hasCompression) estimatedMaxConcurrentUsers += 100;
  if (hasCDNConfig) estimatedMaxConcurrentUsers += 400;
  if (allDeps.some(d => d.includes('fastify'))) estimatedMaxConcurrentUsers += 200; // Fastify is faster than Express

  // Generate findings
  const findings: LoadTestReport['findings'] = [];

  if (!hasRateLimiting) {
    findings.push({
      severity: 'high',
      title: 'No Rate Limiting Detected',
      description: 'No rate limiting middleware or configuration found. API endpoints are vulnerable to abuse and cascading failures under load.',
      filePath: projectPath,
      suggestion: 'Install express-rate-limit or @fastify/rate-limit. Apply per-IP limits on all API routes, with stricter limits on auth endpoints.',
    });
  }

  if (!hasCaching) {
    findings.push({
      severity: 'medium',
      title: 'No Caching Layer Detected',
      description: 'No caching mechanism (Redis, in-memory, or CDN) found. Every request hits the database/compute layer.',
      filePath: projectPath,
      suggestion: 'Add Redis for session storage and API response caching. Use cache headers for static assets. Consider a CDN for static files.',
    });
  }

  if (!hasConnectionPooling) {
    findings.push({
      severity: 'medium',
      title: 'No Database Connection Pooling',
      description: 'No explicit database connection pool configuration detected.',
      filePath: projectPath,
      suggestion: 'Configure connection pooling in your database client. Set max connections based on your DB tier. Use Prisma or pg-pool for automatic pooling.',
    });
  }

  if (!hasCompression) {
    findings.push({
      severity: 'low',
      title: 'No Response Compression',
      description: 'Response compression not detected. Larger payloads increase bandwidth and latency.',
      filePath: projectPath,
      suggestion: 'Add compression middleware (Express) or @fastify/compress. Enable gzip and/or brotli.',
    });
  }

  if (!hasLoadBalancing) {
    findings.push({
      severity: 'low',
      title: 'No Cluster/Load Balancing Configuration',
      description: 'No Node.js cluster mode or load balancing detected. Single-process Node.js cannot utilize multiple CPU cores.',
      filePath: projectPath,
      suggestion: 'Use Node.js cluster module, PM2, or deploy behind a load balancer (Nginx, AWS ALB).',
    });
  }

  // Check for missing health check endpoint (AST: actual route registration)
  const hasHealthCheck = patterns.healthEndpoints.length > 0;
  if (!hasHealthCheck) {
    findings.push({
      severity: 'medium',
      title: 'Missing health check endpoint',
      description: 'No `/health` / `/ready` / `/live` route handler was registered. Load balancers and orchestrators need this to route traffic.',
      filePath: projectPath,
      suggestion: 'Add a `/health` endpoint that checks DB connectivity and key dependencies. Return 200 only when healthy, 503 when degraded.',
    });
  }

  // Check for missing timeout configuration (AST: server.timeout = N, axios.create({timeout}), fetch+signal)
  const hasTimeouts = patterns.timeout.length > 0;
  if (!hasTimeouts) {
    findings.push({
      severity: 'medium',
      title: 'No request timeout configuration',
      description: 'No `server.timeout`, `axios.create({ timeout })`, or `fetch(url, { signal })` was found. Slow requests can exhaust connections.',
      filePath: projectPath,
      suggestion: 'Set `server.timeout = 30_000`. Configure `axios.create({ timeout: 10_000 })`. Pass `signal: AbortSignal.timeout(N)` to fetch.',
    });
  }

  // Check for circuit breaker pattern. Fixed precedence:
  // condition is "we make external calls AND we don't break circuits."
  const makesExternalCalls = /\bfetch\(|\baxios\b|\bgot\(|\bsuperagent\(/.test(allContent);
  const hasCircuitBreaker =
    patterns.circuitBreaker.length > 0 ||
    allDeps.some(d => d === 'opossum' || d === 'brakes' || d === 'cockatiel');
  if (makesExternalCalls && !hasCircuitBreaker) {
    findings.push({
      severity: 'low',
      title: 'No circuit breaker for external API calls',
      description: 'External API calls (`fetch`/`axios`/`got`) detected but no circuit-breaker library (opossum / brakes / cockatiel) is in use.',
      filePath: projectPath,
      suggestion: 'Wrap external calls with `opossum` or `cockatiel` so a downstream outage doesn\'t take you down too. Set thresholds: 50% error rate over 30s → open for 30s.',
    });
  }

  // NEW (pass 6): sync I/O inside route handlers — real performance bug.
  if (patterns.syncIoInHandlers.length > 0) {
    const sample = patterns.syncIoInHandlers.slice(0, 3)
      .map(h => `${h.pattern} at ${h.filePath}:${h.line}`).join('; ');
    findings.push({
      severity: 'high',
      title: `Sync I/O inside ${patterns.syncIoInHandlers.length} route handler(s)`,
      description: `Synchronous filesystem / shell calls inside async route handlers block the event loop for the entire process. Examples: ${sample}.`,
      filePath: patterns.syncIoInHandlers[0].filePath,
      suggestion: 'Replace `readFileSync` with `await fs.promises.readFile(...)` (or `fs.readFile` with await/promises). Same for write/append/exec/spawn — always use the async variant in request paths.',
    });
  }

  // Check for memory leak risks
  const hasEventListeners = allContent.includes('on(') || allContent.includes('addListener');
  const hasRemoveListeners = allContent.includes('removeListener') || allContent.includes('off(');
  if (hasEventListeners && !hasRemoveListeners) {
    findings.push({
      severity: 'medium',
      title: 'Potential Event Listener Leak',
      description: 'Event listeners are added but never removed. Under load this can cause memory leaks.',
      filePath: projectPath,
      suggestion: 'Always remove event listeners when done. Use once() for one-time events. Monitor EventEmitter.listenerCount().',
    });
  }

  // Static load-readiness: start from a baseline (a running HTTP service) and
  // add credit for each demonstrated scalability capability; subtract for
  // blocking sync I/O in request handlers. Bounded so it never reads as a hard
  // 0 (which would imply the dimension failed) — capped at 95 because static
  // analysis can't confirm real-world throughput, only the presence of patterns.
  let score = 45;
  if (hasRateLimiting) score += 12;
  if (hasCaching) score += 12;
  if (hasConnectionPooling) score += 10;
  if (patterns.healthEndpoints.length > 0) score += 8;
  if (patterns.timeout.length > 0) score += 8;
  if (patterns.circuitBreaker.length > 0) score += 5;
  if (hasCompression) score += 5;
  if (hasLoadBalancing) score += 5;
  if (hasCDNConfig) score += 5;
  score -= Math.min(patterns.syncIoInHandlers.length, 4) * 6;
  score = Math.max(15, Math.min(95, score));

  return {
    score,
    hasRateLimiting,
    hasCaching,
    hasConnectionPooling,
    hasCDNConfig,
    hasLoadBalancing,
    hasCompression,
    estimatedMaxConcurrentUsers,
    patterns,
    findings,
    recommendations: generateRecommendations(hasRateLimiting, hasCaching, hasConnectionPooling, hasCompression, hasLoadBalancing),
  };
}

function generateRecommendations(
  hasRateLimiting: boolean,
  hasCaching: boolean,
  hasConnectionPooling: boolean,
  hasCompression: boolean,
  hasLoadBalancing: boolean
): string[] {
  const recs: string[] = [];

  if (!hasRateLimiting) {
    recs.push('Install rate limiting on all API endpoints immediately');
  }
  if (!hasCaching) {
    recs.push('Add Redis caching for frequently accessed data');
  }
  if (!hasConnectionPooling) {
    recs.push('Configure database connection pooling');
  }
  if (!hasCompression) {
    recs.push('Enable gzip/brotli compression for API responses');
  }
  if (!hasLoadBalancing) {
    recs.push('Use PM2 cluster mode or deploy behind a load balancer');
  }
  recs.push('Set up a /health endpoint with dependency checks');
  recs.push('Configure request timeouts (server + external calls)');
  recs.push('Add request logging with correlation IDs for debugging');

  return recs;
}
