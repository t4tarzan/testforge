// Agentic Scale Prediction — 21st Testing Dimension
// Simulates AI agent behavior at scale against target APIs
// Predicts what happens when thousands of AI agents hit your system
import { severityScore } from './lib/score.js';

export interface AgenticScaleReport {
  score: number;
  resilienceLevel: string;
  maxPredictedAgents: number;
  predictedBottleneck: string;
  failurePatterns: string[];
  recommendations: string[];
  findings: Finding[];
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  fixSuggestion: string;
  category: string;
}

/**
 * Agentic Scale Prediction — analyzes codebase for how it would behave
 * when thousands of AI agents (like Cursor, Claude, GPT) hit it simultaneously.
 * 
 * AI agents are different from human users:
 * - They make parallel requests (10-50x more than humans)
 * - They explore edge cases aggressively
 * - They retry with variations on failure
 * - They don't respect rate limits intuitively
 * - They chain API calls in unexpected patterns
 */
export function runAgenticScalePrediction(
  fileContents: Record<string, string>,
  dependencies: string[],
  techStack: string[],
  endpoints: number,
  _totalLines: number
): AgenticScaleReport {
  const findings: Finding[] = [];
  const failurePatterns: string[] = [];
  const recommendations: string[] = [];
  const allContent = Object.values(fileContents).join('\n');

  // ═══════════════════════════════════════════════════════════
  // 1. Rate Limiting Analysis — critical for agentic load
  // ═══════════════════════════════════════════════════════════
  const hasRateLimit = dependencies.some(d => {
    const x = d.toLowerCase();
    return x.includes('rate-limit') || x.includes('express-rate-limit') ||
      x.includes('rate-limiter') || x.includes('bottleneck') ||
      x.includes('p-limit') || x.includes('throttle') ||
      // Python (FastAPI/Starlette)
      x === 'slowapi' || x === 'fastapi-limiter' || x === 'asgi-ratelimit' || x === 'limits';
  });
  const hasRateLimitCode = allContent.includes('rateLimit') || allContent.includes('rate_limit') ||
    allContent.includes('maxRequests') || allContent.includes('windowMs') ||
    allContent.includes('RATE_LIMIT') ||
    // Python slowapi
    allContent.includes('SlowAPIMiddleware') || allContent.includes('@limiter.limit') ||
    allContent.includes('Limiter(');

  if (!hasRateLimit && !hasRateLimitCode) {
    findings.push({
      severity: 'critical',
      title: 'No Rate Limiting — Critical for Agentic Scale',
      description: 'AI agents make 10-50x more requests than humans. Without rate limiting, your API will be overwhelmed instantly under agentic load.',
      fixSuggestion: 'Add express-rate-limit with 100 req/min per IP. For agentic scale, implement token bucket algorithm with Redis for distributed rate limiting.',
      category: 'Agentic Scale',
    });
    failurePatterns.push('Immediate overload — no rate limiting means first 100 agents will exhaust all resources');
  }

  // ═══════════════════════════════════════════════════════════
  // 2. Connection Pool & Database Scaling
  // ═══════════════════════════════════════════════════════════
  const hasORM = dependencies.some(d =>
    d.includes('prisma') || d.includes('drizzle') || d.includes('sequelize') ||
    d.includes('typeorm') || d.includes('mongoose')
  );
  let maxConnections = 10; // default
  
  const poolMatch = allContent.match(/pool[:\s]*{[^}]*max[:\s]*(\d+)/i) ||
    allContent.match(/maxPoolSize[:\s]*(\d+)/i) ||
    allContent.match(/connectionLimit[:\s]*(\d+)/i);
  
  if (poolMatch) maxConnections = parseInt(poolMatch[1]);

  if (hasORM && maxConnections <= 10) {
    findings.push({
      severity: 'high',
      title: `Small Connection Pool (${maxConnections}) — Will Exhaust Under Agentic Load`,
      description: `Your DB connection pool is limited to ${maxConnections}. AI agents making parallel requests will exhaust this quickly — each agent may hold 2-3 connections for chained queries.`,
      fixSuggestion: 'Increase connection pool to 50+. Use PgBouncer for connection multiplexing. Consider read replicas for agentic workloads.',
      category: 'Agentic Scale',
    });
    failurePatterns.push(`Database connection exhaustion at ~${Math.floor(maxConnections / 3)} concurrent agents`);
  }

  // ═══════════════════════════════════════════════════════════
  // 3. Caching Strategy — critical because agents repeat patterns
  // ═══════════════════════════════════════════════════════════
  const hasCache = dependencies.some(d =>
    d.includes('redis') || d.includes('ioredis') || d.includes('cache') ||
    d.includes('memcached') || d.includes('lru-cache')
  );
  const hasCacheHeaders = allContent.includes('Cache-Control') || allContent.includes('ETag') ||
    allContent.includes('max-age') || allContent.includes('etag');

  if (!hasCache && !hasCacheHeaders) {
    findings.push({
      severity: 'high',
      title: 'No Caching — Agents Will Repeat-Query Same Endpoints',
      description: 'AI agents often re-query the same endpoints (list, search, detail). Without caching, every agent request hits the database — exponential load amplification.',
      fixSuggestion: 'Add Redis caching with 30s TTL for list endpoints. Implement ETag/304 responses. Use CDN for static resources.',
      category: 'Agentic Scale',
    });
    failurePatterns.push('Cache-less architecture means 10 agents searching = 10x DB load for identical queries');
  }

  // ═══════════════════════════════════════════════════════════
  // 4. Error Handling & Retry Behavior
  // ═══════════════════════════════════════════════════════════
  const hasRetry = allContent.includes('retry') || allContent.includes('Retry-After') ||
    allContent.includes('backoff') || allContent.includes('429');

  if (!hasRetry && endpoints > 5) {
    findings.push({
      severity: 'medium',
      title: 'No Retry-After Headers — Agents Will Retry Aggressively',
      description: 'AI agents retry failed requests. Without Retry-After headers or 429 responses, agents will hammer your API during outages, causing cascading failures.',
      fixSuggestion: 'Return 429 with Retry-After header on rate limit. Implement exponential backoff. Use circuit breaker pattern.',
      category: 'Agentic Scale',
    });
    failurePatterns.push('Thundering herd: all agents retry simultaneously after failure, amplifying load 5-10x');
  }

  // ═══════════════════════════════════════════════════════════
  // 5. Predict max agents and bottleneck
  // ═══════════════════════════════════════════════════════════
  let maxPredictedAgents = 10;
  let predictedBottleneck = 'Rate limiting (none configured)';

  if (hasRateLimit || hasRateLimitCode) {
    maxPredictedAgents = 100;
    predictedBottleneck = 'Database connection pool';
  }
  if (hasCache) {
    maxPredictedAgents = 500;
    predictedBottleneck = 'API server CPU/memory';
  }
  if (hasCache && hasRateLimit && maxConnections > 20) {
    maxPredictedAgents = 2000;
    predictedBottleneck = 'Network bandwidth / load balancer';
  }
  if (dependencies.some(d => d.includes('cluster') || d.includes('pm2'))) {
    maxPredictedAgents *= 2;
  }

  // ═══════════════════════════════════════════════════════════
  // 6. Agent-specific failure patterns
  // ═══════════════════════════════════════════════════════════
  
  // Check for pagination (agents will hit all pages)
  const hasPagination = allContent.includes('page=') || allContent.includes('offset=') ||
    allContent.includes('cursor') || allContent.includes('limit=');
  if (!hasPagination && endpoints > 3) {
    findings.push({
      severity: 'medium',
      title: 'No Pagination — Agents Will Fetch Entire Datasets',
      description: 'List endpoints without pagination will return entire datasets. An AI agent exploring your API will fetch everything — potentially gigabytes of data.',
      fixSuggestion: 'Implement cursor-based pagination. Limit default page size to 50. Return total count in headers.',
      category: 'Agentic Scale',
    });
    failurePatterns.push('Unpaginated list endpoints: agents will fetch full datasets, causing memory exhaustion');
  }

  // Check for authentication rate limiting (agents will hammer auth)
  const hasAuth = allContent.includes('auth') || allContent.includes('jwt') || allContent.includes('token');
  if (hasAuth && !allContent.includes('maxLoginAttempts') && !allContent.includes('loginRateLimit')) {
    findings.push({
      severity: 'high',
      title: 'Auth Endpoints Not Rate Limited',
      description: 'AI agents frequently re-authenticate (token refresh, retry on 401). Without auth rate limiting, agents can brute-force or DoS your auth system.',
      fixSuggestion: 'Rate limit auth endpoints separately: 5 attempts/min per IP. Add account locking after 10 failures. Monitor for unusual auth patterns.',
      category: 'Agentic Scale',
    });
    failurePatterns.push('Auth endpoint saturation: agents refreshing tokens every request = 2x load amplification');
  }

  // ═══════════════════════════════════════════════════════════
  // 7. Recommendations
  // ═══════════════════════════════════════════════════════════
  recommendations.push('Implement token bucket rate limiting (100 req/min per agent identity)');
  recommendations.push('Add Redis caching with 30s TTL for all GET endpoints');
  recommendations.push('Increase database connection pool to 50+ with PgBouncer');
  recommendations.push('Add Retry-After headers and 429 status codes');
  recommendations.push('Implement circuit breaker for external API calls');
  recommendations.push('Paginate all list endpoints (max 50 items per page)');
  recommendations.push('Rate limit auth endpoints separately (5/min)');
  recommendations.push('Monitor for agentic traffic patterns (bursty, exploratory, retry-heavy)');

  // ═══════════════════════════════════════════════════════════
  // Score
  // ═══════════════════════════════════════════════════════════
  // Diminishing returns: scale-resilience gaps shouldn't cliff to 0.
  const score = severityScore(findings, 5);

  let resilienceLevel: string;
  if (score >= 80) {
    resilienceLevel = 'Agent-Ready — Your API can handle 2000+ concurrent AI agents';
  } else if (score >= 50) {
    resilienceLevel = `Moderate — Can handle ${maxPredictedAgents} agents. Add caching and rate limiting for scale.`;
  } else {
    resilienceLevel = `Fragile — Critical gaps. Your API would fail under ${maxPredictedAgents} concurrent agents.`;
  }

  return {
    score,
    resilienceLevel,
    maxPredictedAgents,
    predictedBottleneck,
    failurePatterns,
    recommendations: recommendations.slice(0, 8),
    findings,
  };
}
