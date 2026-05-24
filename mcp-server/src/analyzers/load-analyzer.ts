import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export interface LoadTestReport {
  hasRateLimiting: boolean;
  hasCaching: boolean;
  hasConnectionPooling: boolean;
  hasCDNConfig: boolean;
  hasLoadBalancing: boolean;
  hasCompression: boolean;
  estimatedMaxConcurrentUsers: number;
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

  // 1. Check for rate limiting
  const hasRateLimiting =
    allDeps.some(d => d.includes('rate-limit') || d.includes('ratelimit')) ||
    allContent.includes('rateLimit') ||
    allContent.includes('rate_limit') ||
    allContent.includes('throttle');

  // 2. Check for caching
  const hasCaching =
    allDeps.some(d => d.includes('cache') || d.includes('redis') || d.includes('ioredis')) ||
    allContent.includes('redis') ||
    allContent.includes('cache') ||
    allContent.includes('Cache-Control') ||
    allContent.includes('ETag') ||
    allContent.includes('memoize');

  // 3. Check for connection pooling
  const hasConnectionPooling =
    allContent.includes('pool') ||
    allContent.includes('Pool') ||
    allContent.includes('maxConnections') ||
    allContent.includes('connectionLimit') ||
    allContent.includes('acquire') ||
    allContent.includes('idleTimeout') ||
    allDeps.some(d => d.includes('pg') || d.includes('mysql') || d.includes('prisma')); // Prisma has built-in pooling

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

  // 6. Check for response compression
  const hasCompression =
    allDeps.some(d => d.includes('compression')) ||
    allContent.includes('compression()') ||
    allContent.includes('gzip') ||
    allContent.includes('deflate') ||
    allContent.includes('brotli');

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

  // Check for missing health check endpoint
  const hasHealthCheck = allContent.includes('/health') || allContent.includes('/ready') || allContent.includes('/live');
  if (!hasHealthCheck) {
    findings.push({
      severity: 'medium',
      title: 'Missing Health Check Endpoint',
      description: 'No health check endpoint (/health, /ready) detected. Load balancers and orchestrators need this to route traffic.',
      filePath: projectPath,
      suggestion: 'Add a /health endpoint that checks DB connectivity and key dependencies. Return 200 only when healthy, 503 when degraded.',
    });
  }

  // Check for missing timeout configuration
  const hasTimeouts = allContent.includes('timeout') || allContent.includes('Timeout') || allContent.includes('server.timeout');
  if (!hasTimeouts) {
    findings.push({
      severity: 'medium',
      title: 'No Request Timeout Configuration',
      description: 'No request timeout handling detected. Slow requests can exhaust connections.',
      filePath: projectPath,
      suggestion: 'Set server timeout (e.g., server.timeout = 30000 for 30s). Add timeouts for external API calls using AbortController or axios timeout.',
    });
  }

  // Check for circuit breaker pattern
  const hasCircuitBreaker = allContent.includes('circuit') || allDeps.some(d => d.includes('opossum') || d.includes('circuit'));
  if (!hasCircuitBreaker && allContent.includes('fetch') || allContent.includes('axios')) {
    findings.push({
      severity: 'low',
      title: 'No Circuit Breaker Pattern',
      description: 'External API calls detected but no circuit breaker pattern found.',
      filePath: projectPath,
      suggestion: 'Implement circuit breaker pattern for external API calls. Use opossum or implement a simple state machine.',
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

  return {
    hasRateLimiting,
    hasCaching,
    hasConnectionPooling,
    hasCDNConfig,
    hasLoadBalancing,
    hasCompression,
    estimatedMaxConcurrentUsers,
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
