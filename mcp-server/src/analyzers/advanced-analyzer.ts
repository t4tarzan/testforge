// Advanced Analyzers — completing all 13 testing dimensions
// Contract, Visual Regression, Edge Case, Property-Based, Chaos, Mutation, Predictive

import { parseFile, isParseable } from './lib/parse.js';
import { findNPlusOneHits } from './lib/n-plus-one.js';
import { findDeadCode } from './lib/dead-code.js';
import { extractOpenApi, canonicalPath } from './lib/openapi-parse.js';
import { discoverEndpoints, endpointSet, type DiscoveredEndpoint } from './lib/endpoint-discovery.js';
import { computeFileComplexity } from './lib/complexity.js';
import { OWASP_2021, owaspCodesForCategory, type OwaspCode } from './lib/owasp-map.js';
import {
  loadLockGraph,
  findSupplyChainFlags,
  type SupplyChainGraph,
  type LockfileEntry,
} from './lib/supply-chain.js';
import { auditLicenses, type LicenseCategory, type PackageLicense } from './lib/license-audit.js';
import { findChaosPatterns, type ChaosPatternHit } from './lib/chaos-patterns.js';
import { analyzeAssertionQuality, type TestFileAssertionStats } from './lib/mutation-quality.js';
import {
  aggregateFileRisk,
  bucketSecurityByFile,
  type FileRisk,
  type Severity as PredictiveSeverity,
} from './lib/predictive.js';
import type * as t from '@babel/types';

export interface AdvancedReport {
  contract: ContractReport;
  visualRegression: VisualReport;
  edgeCases: EdgeCaseReport;
  propertyBased: PropertyReport;
  chaos: ChaosReport;
  mutation: MutationReport;
  predictive: PredictiveReport;
}

// ═══════════════════════════════════════════════════════════════════
// 1. CONTRACT TESTING — API endpoint signature validation
// ═══════════════════════════════════════════════════════════════════

export interface ContractReport {
  score: number;
  totalEndpoints: number;
  documentedEndpoints: number;
  undocumentedEndpoints: number;
  breakingChanges: number;
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

export async function runContractAnalysis(
  fileContents: Record<string, string>,
  endpoints: number
): Promise<ContractReport> {
  const findings: Finding[] = [];

  // 1. Discover endpoints from source code (AST).
  const discovered: DiscoveredEndpoint[] = [];
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;
    discovered.push(...discoverEndpoints(filePath, parsed.ast));
  }

  // 2. Extract documented endpoints from OpenAPI / Swagger spec files.
  const openapi = extractOpenApi(fileContents);
  const docSet = endpointSet(openapi.endpoints);
  const discoveredSet = endpointSet(discovered);

  const hasGraphQL = dependenciesInclude(fileContents, 'graphql', 'apollo');
  const hasGrpc = dependenciesInclude(fileContents, 'grpc', 'protobuf');

  // 3. Triage: undocumented (in code, not in spec) + orphan (in spec, not in code).
  const undocumentedInCode = discovered.filter(
    (e) => !docSet.has(`${e.method} ${canonicalPath(e.path)}`)
  );
  const orphansInSpec = openapi.endpoints.filter(
    (e) => !discoveredSet.has(`${e.method} ${canonicalPath(e.path)}`)
  );

  // Fall-back endpoint count when AST discovery turns up nothing.
  // (Some codebases use higher-order route registration we don't follow.)
  const totalEndpoints = Math.max(discovered.length, endpoints);

  // ── Finding 1: missing spec entirely
  if (openapi.validFiles.length === 0 && !hasGraphQL && !hasGrpc && totalEndpoints > 5) {
    findings.push({
      severity: 'high',
      title: 'No API contract specification',
      description: `${totalEndpoints} endpoint(s) discovered in source but no OpenAPI/Swagger/GraphQL/gRPC schema was found. Breaking changes will land silently.`,
      fixSuggestion:
        'Add an OpenAPI 3.x spec at `openapi.yaml` / `swagger.json`. Generate from code with `swagger-jsdoc`, `tsoa`, `zod-to-openapi`, or write by hand for the top-N stable endpoints first.',
      category: 'API Contracts',
    });
  }

  // ── Finding 2: invalid candidate file (looked like a spec but didn't parse / lacked openapi key)
  const invalidCandidates = openapi.candidateFiles.filter((p) => !openapi.validFiles.includes(p));
  for (const f of invalidCandidates.slice(0, 3)) {
    findings.push({
      severity: 'medium',
      title: `Spec file present but not a valid OpenAPI/Swagger doc: ${f}`,
      description: 'File name looks like an API spec, but the contents are missing the `openapi:` or `swagger:` root key, or the YAML/JSON failed to parse.',
      filePath: f,
      fixSuggestion: 'Add an `openapi: 3.0.x` root (or `swagger: "2.0"` for the older format). Run the spec through `swagger-cli validate` before committing.',
      category: 'API Contracts',
    });
  }

  // ── Finding 3: undocumented endpoints (in code, not in spec)
  if (openapi.validFiles.length > 0 && undocumentedInCode.length > 0) {
    const sample = undocumentedInCode.slice(0, 5)
      .map((e) => `${e.method.toUpperCase()} ${e.path} (${e.filePath}:${e.line})`).join(', ');
    findings.push({
      severity: undocumentedInCode.length > totalEndpoints / 2 ? 'high' : 'medium',
      title: `${undocumentedInCode.length} undocumented endpoint(s) — present in code, absent from spec`,
      description: `Examples: ${sample}${undocumentedInCode.length > 5 ? ', …' : ''}.`,
      fixSuggestion:
        'Add each path under `paths:` in the spec. For express + JSDoc: `swagger-jsdoc` auto-generates entries from `@openapi` JSDoc comments above each route handler.',
      category: 'API Contracts',
    });
  }

  // ── Finding 4: orphan endpoints (in spec, no implementation in code)
  if (orphansInSpec.length > 0 && discovered.length > 0) {
    const sample = orphansInSpec.slice(0, 5)
      .map((e) => `${e.method.toUpperCase()} ${e.path}`).join(', ');
    findings.push({
      severity: 'medium',
      title: `${orphansInSpec.length} spec-only endpoint(s) — documented but no handler found in code`,
      description: `Examples: ${sample}${orphansInSpec.length > 5 ? ', …' : ''}. Either the implementation is missing, the path moved, or the route is registered via a pattern we don't recognize.`,
      fixSuggestion:
        "Implement the missing handler, remove the orphan from the spec, or annotate it as `deprecated: true` if it's an intentional sunset path.",
      category: 'API Contracts',
    });
  }

  // ── Finding 5: no versioning strategy (only when there's a spec to anchor against)
  if (openapi.validFiles.length > 0 && totalEndpoints > 10) {
    const hasVersioning = openapi.endpoints.some((e) => /\/v\d+\b/.test(e.path)) ||
      discovered.some((e) => /\/v\d+\b/.test(e.path));
    if (!hasVersioning) {
      findings.push({
        severity: 'medium',
        title: 'API has no visible versioning strategy',
        description: 'No `/v1/` / `/v2/` path prefix detected in either the spec or the discovered routes. Breaking changes will affect all consumers simultaneously.',
        fixSuggestion:
          'Pick a versioning scheme — URL-based (`/v1/users`) is the most discoverable; header-based (`Accept-Version`) leaves the URL cleaner. Document the deprecation policy in the spec\'s `info.description`.',
        category: 'API Contracts',
      });
    }
  }

  // ── Finding 6: inconsistent response shape across the same path (heuristic)
  const responseShapeByPath = new Map<string, Set<string>>();
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    // crude — `res.json` vs `res.send` mixed in the same file flags it.
    const usesJson = content.includes('res.json(') || content.includes('reply.send(');
    const usesPlainSend = content.includes('res.send(') && !content.includes('res.json(');
    if (usesJson && usesPlainSend) {
      const set = responseShapeByPath.get(filePath) ?? new Set<string>();
      set.add('mixed');
      responseShapeByPath.set(filePath, set);
    }
  }
  if (responseShapeByPath.size > 0) {
    findings.push({
      severity: 'low',
      title: `Mixed response patterns in ${responseShapeByPath.size} file(s)`,
      description: 'Some handlers use `res.json(...)` and others use `res.send(...)` in the same file. Consumers can\'t rely on a single content-type.',
      fixSuggestion:
        'Standardize on `res.json()` (or `reply.send()` in Fastify). Use a shared response helper to enforce the shape: `{ data, error, meta }` etc.',
      category: 'API Contracts',
    });
  }

  const score = Math.max(0, 100 - findings.reduce((s, f) =>
    s + (f.severity === 'high' ? 25 : f.severity === 'medium' ? 15 : 8), 0
  ));

  const documented = totalEndpoints - undocumentedInCode.length;

  return {
    score,
    totalEndpoints,
    documentedEndpoints: documented < 0 ? 0 : documented,
    undocumentedEndpoints: undocumentedInCode.length,
    breakingChanges: findings.filter(f => f.severity === 'high').length,
    findings,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 2. VISUAL REGRESSION — UI consistency analysis
// ═══════════════════════════════════════════════════════════════════

export interface VisualReport {
  score: number;
  htmlFiles: number;
  cssFiles: number;
  findings: Finding[];
}

export async function runVisualRegressionAnalysis(
  fileContents: Record<string, string>
): Promise<VisualReport> {
  const findings: Finding[] = [];
  let htmlFiles = 0, cssFiles = 0;

  for (const filePath of Object.keys(fileContents)) {
    if (filePath.endsWith('.html') || filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) htmlFiles++;
    if (filePath.endsWith('.css') || filePath.endsWith('.scss') || filePath.endsWith('.less')) cssFiles++;
  }

  if (htmlFiles === 0 && cssFiles === 0) {
    findings.push({
      severity: 'low',
      title: 'No UI Files for Visual Regression',
      description: 'No HTML/JSX/TSX or CSS files detected. Visual regression testing requires UI components.',
      fixSuggestion: 'Visual regression tests are applicable to frontend applications with UI components.',
      category: 'Visual Regression',
    });
    return { score: 100, htmlFiles: 0, cssFiles: 0, findings };
  }

  // Check for CSS-in-JS or style inconsistencies
  let inlineStyles = 0;
  let cssModules = 0;
  const allContent = Object.values(fileContents).join('\n');

  for (const [fp, content] of Object.entries(fileContents)) {
    if (fp.includes('node_modules')) continue;
    if (content.includes('style={') || content.includes('style={{')) inlineStyles++;
    if (content.includes('.module.css') || content.includes('.module.scss')) cssModules++;
  }

  if (inlineStyles > 5 && cssModules === 0) {
    findings.push({
      severity: 'medium',
      title: 'Heavy Inline Styles Without CSS Modules',
      description: `${inlineStyles} files use inline styles. This makes visual regression testing difficult and can cause layout inconsistencies.`,
      fixSuggestion: 'Adopt CSS Modules, Tailwind, or styled-components for consistent, testable styling.',
      category: 'Visual Regression',
    });
  }

  // Check for hardcoded dimensions
  const hardcodedPx = allContent.match(/\d{2,4}px/g);
  if (hardcodedPx && hardcodedPx.length > 20) {
    findings.push({
      severity: 'low',
      title: `${hardcodedPx.length}+ Hardcoded Pixel Values`,
      description: 'Many hardcoded pixel values detected. These break across screen sizes and make visual regression testing unreliable.',
      fixSuggestion: 'Use relative units (rem, em, %) or design tokens. Define breakpoints in a shared theme.',
      category: 'Visual Regression',
    });
  }

  const score = Math.max(0, 100 - findings.reduce((s, f) =>
    s + (f.severity === 'high' ? 20 : f.severity === 'medium' ? 12 : 6), 0
  ));

  return { score, htmlFiles, cssFiles, findings };
}

// ═══════════════════════════════════════════════════════════════════
// 3. EDGE CASE GENERATOR — Boundary and edge case detection
// ═══════════════════════════════════════════════════════════════════

export interface EdgeCaseReport {
  score: number;
  potentialCases: number;
  findings: Finding[];
}

export async function runEdgeCaseAnalysis(
  fileContents: Record<string, string>
): Promise<EdgeCaseReport> {
  const findings: Finding[] = [];
  let potentialCases = 0;

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Array index access without bounds checking
      if (line.match(/\[(\w+)\]/) && !content.includes(`if (${/\w+/.exec(line)?.[1]} >=`) && !content.includes(`.length`)) {
        potentialCases++;
      }

      // Division without zero check
      if (line.includes('/') && (line.includes('var') || line.includes('let') || line.includes('const')) && !content.includes('=== 0') && !content.includes('!== 0')) {
        potentialCases++;
      }

      // String operations without null/empty check
      if ((line.includes('.substring') || line.includes('.slice') || line.includes('.charAt')) &&
        !content.includes('.length >') && !content.includes('if (') && !content.includes('&&')) {
        potentialCases++;
      }

      // Type coercion risks
      if (line.includes('==') && !line.includes('===') && !line.includes('!==')) {
        if (potentialCases < 20) {
          findings.push({
            severity: 'medium',
            title: 'Loose Equality (==) Usage',
            description: `Loose equality at ${filePath}:${i + 1} can cause unexpected type coercion edge cases.`,
            filePath,
            lineNumber: i + 1,
            fixSuggestion: 'Use === instead of == to avoid type coercion surprises. Run ESLint eqeqeq rule.',
            category: 'Edge Cases',
          });
        }
      }
    }

    // Missing default in switch
    const switchMatches = content.match(/switch\s*\(/g);
    const defaultMatches = content.match(/default:/g);
    if (switchMatches && (!defaultMatches || switchMatches.length > defaultMatches.length)) {
      findings.push({
        severity: 'medium',
        title: 'Switch Statement Without Default Case',
        description: 'Switch without a default case can miss unexpected input values.',
        filePath,
        fixSuggestion: 'Always add a default case to switch statements to handle unexpected values.',
        category: 'Edge Cases',
      });
    }
  }

  if (potentialCases > 10) {
    findings.push({
      severity: 'high',
      title: `${potentialCases}+ Potential Edge Cases Detected`,
      description: 'Multiple array accesses, divisions, and string operations without bounds/null checks found.',
      fixSuggestion: 'Add input validation. Use TypeScript strict mode. Write tests for boundary conditions (empty arrays, null, undefined, max values).',
      category: 'Edge Cases',
    });
  }

  const score = Math.max(0, 100 - findings.length * 10 - Math.floor(potentialCases / 5));
  return { score: Math.min(100, score), potentialCases, findings: findings.slice(0, 15) };
}

// ═══════════════════════════════════════════════════════════════════
// 4. PROPERTY-BASED TESTING — Invariant detection
// ═══════════════════════════════════════════════════════════════════

export interface PropertyReport {
  score: number;
  invariantsDetected: number;
  findings: Finding[];
}

export async function runPropertyBasedAnalysis(
  fileContents: Record<string, string>
): Promise<PropertyReport> {
  const findings: Finding[] = [];
  let invariantsDetected = 0;

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;

    // Detect common invariants
    if (content.includes('assert(') || content.includes('invariant(')) invariantsDetected++;
    if (content.includes('Array.isArray') && content.includes('.length')) invariantsDetected++;
    if (content.includes('typeof') && content.includes('===')) invariantsDetected++;
    if (content.includes('.hasOwnProperty') || content.includes('Object.keys')) invariantsDetected++;

    // Check for functions that should be pure but might not be
    const funcMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
    if (funcMatches) {
      for (let i = 0; i < Math.min(funcMatches.length, 3); i++) {
        const funcStart = content.indexOf(funcMatches[i]);
        const funcEnd = content.indexOf('}', funcStart);
        const funcBody = content.substring(funcStart, funcEnd);

        // Function modifies external state (not pure)
        if ((funcBody.match(/this\./g) || []).length > 1 ||
          funcBody.includes('global.') || funcBody.includes('window.') ||
          funcBody.includes('process.env')) {
          findings.push({
            severity: 'low',
            title: 'Impure Function Detected',
            description: `Function in ${filePath} modifies external state. Property-based testing requires pure functions.`,
            filePath,
            fixSuggestion: 'Refactor to pure functions — same inputs always produce same outputs without side effects.',
            category: 'Property-Based Testing',
          });
          break;
        }
      }
    }
  }

  if (invariantsDetected === 0) {
    findings.push({
      severity: 'high',
      title: 'No Invariants or Assertions Detected',
      description: 'Property-based testing relies on invariants. No assertions or type guards found in codebase.',
      fixSuggestion: 'Add runtime assertions (assert, invariant) and TypeScript type guards. Document function contracts with JSDoc @param and @returns.',
      category: 'Property-Based Testing',
    });
  }

  const score = Math.max(0, 40 + invariantsDetected * 5 - findings.filter(f => f.severity === 'high').length * 20);
  return { score: Math.min(100, score), invariantsDetected, findings };
}

// ═══════════════════════════════════════════════════════════════════
// 5. CHAOS ENGINEERING — Fault tolerance analysis
// ═══════════════════════════════════════════════════════════════════

// Chaos / resilience analysis (pass 10 — AST-aware).
//
// The previous version substring-matched the WORD "SIGTERM"/"timeout"
// across all file content combined. Any comment containing the word
// flipped the flag. This version walks each parseable AST and looks
// for actual patterns:
//
//   - process.on('SIGTERM'|'SIGINT', …) listeners (graceful shutdown)
//   - process.on('unhandledRejection'|'uncaughtException', …) guards
//   - p-retry / async-retry / axios-retry imports + their call sites
//   - manual retry loops (for/while + try/catch + setTimeout)
//   - Express global error middleware (4-param handler)
//   - Fastify setErrorHandler
//   - new AbortController()
//   - Idempotency-Key header reads
//
// Pass 6 (load) covers circuit breakers and outbound-call timeouts;
// not duplicated here.
export interface ChaosReport {
  score: number;
  resilienceLevel: string;
  /** AST-verified pattern hits. */
  patterns: {
    gracefulShutdown: ChaosPatternHit[];
    processGuards: ChaosPatternHit[];
    retryHits: ChaosPatternHit[];
    manualRetryLoops: ChaosPatternHit[];
    errorHandlers: ChaosPatternHit[];
    abortControllers: ChaosPatternHit[];
    idempotencyKey: ChaosPatternHit[];
  };
  findings: Finding[];
}

export async function runChaosAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  techStack: string[]
): Promise<ChaosReport> {
  const findings: Finding[] = [];

  // Aggregate AST hits across all parseable files.
  const patterns = {
    gracefulShutdown: [] as ChaosPatternHit[],
    processGuards: [] as ChaosPatternHit[],
    retryHits: [] as ChaosPatternHit[],
    manualRetryLoops: [] as ChaosPatternHit[],
    errorHandlers: [] as ChaosPatternHit[],
    abortControllers: [] as ChaosPatternHit[],
    idempotencyKey: [] as ChaosPatternHit[],
  };
  let hasAnyTryCatch = false;
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;
    const p = findChaosPatterns(filePath, parsed.ast);
    patterns.gracefulShutdown.push(...p.gracefulShutdown);
    patterns.processGuards.push(...p.processGuards);
    patterns.retryHits.push(...p.retryHits);
    patterns.manualRetryLoops.push(...p.manualRetryLoops);
    patterns.errorHandlers.push(...p.errorHandlers);
    patterns.abortControllers.push(...p.abortControllers);
    patterns.idempotencyKey.push(...p.idempotencyKey);

    // Light try/catch detection from content — used only for the "zero
    // try/catch in entire project" finding. Substring match is fine here
    // because the cost of a false negative (we miss a real try/catch)
    // outweighs the false-positive cost of seeing "try { foo }" in a string.
    if (!hasAnyTryCatch && /\btry\s*\{/.test(content)) hasAnyTryCatch = true;
  }

  const isServerApp = techStack.some((t) =>
    ['Express', 'Fastify', 'Koa', 'NestJS', 'Hono'].includes(t)
  );

  // ── Critical: no try/catch anywhere
  if (!hasAnyTryCatch && isServerApp) {
    findings.push({
      severity: 'critical',
      title: 'No try/catch blocks found anywhere in the codebase',
      description: 'Zero try/catch blocks detected in non-test files. Any unhandled exception in an async path will crash the worker.',
      fixSuggestion: 'Wrap all async I/O in try/catch. Register a global error handler middleware. For Fastify, `app.setErrorHandler(...)`.',
      category: 'Chaos Engineering',
    });
  }

  // ── High: no graceful shutdown registered
  if (patterns.gracefulShutdown.length === 0 && isServerApp) {
    findings.push({
      severity: 'high',
      title: 'No graceful shutdown handler',
      description: 'No `process.on(\'SIGTERM\', …)` or `process.on(\'SIGINT\', …)` listener found. Container orchestrators send SIGTERM before SIGKILL; without a handler, in-flight requests are dropped.',
      fixSuggestion:
        'Register a SIGTERM listener: `process.on(\'SIGTERM\', async () => { await server.close(); /* drain DB pool, redis, ... */ process.exit(0); });`. Kubernetes sends SIGTERM 30s before SIGKILL.',
      category: 'Chaos Engineering',
    });
  }

  // ── High: no global error handler (Express/Fastify)
  if (patterns.errorHandlers.length === 0 && isServerApp) {
    findings.push({
      severity: 'high',
      title: 'No global error handler registered',
      description:
        'For Express, no `app.use((err, req, res, next) => …)` 4-arg middleware found. For Fastify, no `setErrorHandler`. Errors propagating to the framework will return generic 500s without structured logging.',
      fixSuggestion:
        'Express: `app.use((err, req, res, next) => { logger.error(err); res.status(500).json({ error: err.message }); });`. Fastify: `app.setErrorHandler(...)`. Log + return a stable error shape.',
      category: 'Chaos Engineering',
    });
  }

  // ── Medium: no retry/backoff anywhere
  const hasAnyRetry =
    patterns.retryHits.length > 0 ||
    patterns.manualRetryLoops.length > 0 ||
    dependencies.some((d) =>
      d === 'p-retry' || d === 'async-retry' || d === 'axios-retry' ||
      d === 'retry' || d === 'exponential-backoff' || d === 'cockatiel'
    );
  if (!hasAnyRetry && isServerApp) {
    findings.push({
      severity: 'medium',
      title: 'No retry / backoff library or pattern detected',
      description: 'No `p-retry` / `async-retry` / `axios-retry` import, no manual retry loop. Transient failures (network flake, rate limit) become permanent errors.',
      fixSuggestion:
        'Wrap external calls in `p-retry(fn, { retries: 3, factor: 2, minTimeout: 500 })`. Or use `cockatiel` for combined retry + circuit-breaker.',
      category: 'Chaos Engineering',
    });
  }

  // ── Medium: no process-level safety net
  if (patterns.processGuards.length === 0 && isServerApp) {
    findings.push({
      severity: 'medium',
      title: 'No `unhandledRejection` / `uncaughtException` guard',
      description: 'Node\'s default behavior on unhandled promise rejection is to crash the process. Without a guard, you can\'t log the rejection or trigger a graceful drain.',
      fixSuggestion:
        '`process.on(\'unhandledRejection\', (reason) => { logger.fatal({ reason }, \'unhandled rejection\'); process.exit(1); });` — log it, then exit. Letting the process die after logging is fine; silently swallowing the rejection is not.',
      category: 'Chaos Engineering',
    });
  }

  // ── Info / low: idempotency-key handling
  if (patterns.idempotencyKey.length === 0 && isServerApp && dependencies.some((d) => d === 'stripe' || d === '@stripe/stripe-js' || d.includes('payment'))) {
    findings.push({
      severity: 'medium',
      title: 'Payment-related code without Idempotency-Key handling',
      description: 'Payment / billing dependencies detected, but no read of the `Idempotency-Key` header. Network retries can double-charge customers.',
      fixSuggestion: 'Require `Idempotency-Key` on mutating payment endpoints. Cache the result by key + endpoint for ≥24 hours. Stripe\'s API uses this convention.',
      category: 'Chaos Engineering',
    });
  }

  let resilienceLevel: string;
  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  if (criticalCount === 0 && highCount === 0) {
    resilienceLevel = 'High — application has graceful shutdown, error handler, and retry/timeout patterns.';
  } else if (criticalCount === 0) {
    resilienceLevel = `Medium — ${highCount} high-severity resilience gap(s). Address graceful shutdown and global error handling first.`;
  } else {
    resilienceLevel = 'Low — Critical gaps in error handling. Errors will crash the worker.';
  }

  const score = Math.max(0, 100 -
    findings.filter((f) => f.severity === 'critical').length * 30 -
    findings.filter((f) => f.severity === 'high').length * 15 -
    findings.filter((f) => f.severity === 'medium').length * 8
  );

  return { score, resilienceLevel, patterns, findings };
}

// ═══════════════════════════════════════════════════════════════════
// 6. MUTATION TESTING — Test quality assessment
// ═══════════════════════════════════════════════════════════════════

// Mutation Testing (pass 11 — assertion-quality-aware).
//
// True mutation testing requires running mutated code (Stryker etc.).
// What we CAN do statically is estimate test quality from assertion
// SHAPES, which strongly correlates with mutation-kill rate:
//
//   - STRONG matchers   (toBe(specificValue), toEqual({…}), toThrow,
//                        toHaveLength, toMatchObject, …) kill many mutants
//   - WEAK matchers     (toBeTruthy, toBeDefined, toBeNull, …) catch
//                        almost nothing — a mutation 42→41 still passes
//   - SNAPSHOT matchers catch SOME mutants but are brittle
//
// We walk test files and aggregate these signals, then surface them
// alongside the existing test-to-source ratio.
export interface MutationReport {
  score: number;
  estimatedMutationScore: number;
  totalMutants: number;
  killedMutants: number;
  /** Per-file assertion-quality stats. Includes test files only. */
  assertionStats: TestFileAssertionStats[];
  /** Project-level rollup. */
  assertionTotals: {
    total: number;
    strong: number;
    weak: number;
    snapshot: number;
    other: number;
    weakRatio: number;
    snapshotRatio: number;
    /** Total distinct strong-matcher types used across all test files. */
    overallVariety: number;
  };
  findings: Finding[];
}

export async function runMutationAnalysis(
  fileContents: Record<string, string>,
  devDependencies: string[],
  totalFiles: number,
  totalLines: number
): Promise<MutationReport> {
  const findings: Finding[] = [];
  const hasTestFramework = devDependencies.some(d =>
    d.includes('jest') || d.includes('vitest') || d.includes('mocha') || d.includes('ava')
  );
  const hasMutationTool = devDependencies.some(d =>
    d.includes('stryker') || d.includes('mutant')
  );

  if (!hasTestFramework) {
    return {
      score: 0, estimatedMutationScore: 0, totalMutants: 0, killedMutants: 0,
      assertionStats: [],
      assertionTotals: {
        total: 0, strong: 0, weak: 0, snapshot: 0, other: 0,
        weakRatio: 0, snapshotRatio: 0, overallVariety: 0,
      },
      findings: [{
        severity: 'high', title: 'Mutation testing requires tests',
        description: 'No test framework found. Mutation testing measures test quality by injecting bugs.',
        fixSuggestion: 'Set up Jest or Vitest. Write unit tests. Then run Stryker for mutation testing.',
        category: 'Mutation Testing',
      }],
    };
  }

  // ── Per-test-file AST analysis: assertion quality. ─────────────────
  const assertionStats: TestFileAssertionStats[] = [];
  const allDistinctMatchers = new Set<string>();
  let testFiles = 0;
  let sourceFiles = 0;

  for (const [fp, content] of Object.entries(fileContents)) {
    if (fp.includes('node_modules')) continue;
    const isTest = /\.(test|spec)\.[jt]sx?$/.test(fp) || fp.includes('/__tests__/');
    if (isTest) testFiles++;
    else if (/\.[jt]sx?$/.test(fp)) sourceFiles++;
    if (!isTest) continue;
    if (!isParseable(fp)) continue;
    const parsed = parseFile(fp, content);
    if (!parsed.ast) continue;
    const stats = analyzeAssertionQuality(fp, parsed.ast);
    if (stats.total > 0) {
      assertionStats.push(stats);
      for (const h of stats.hits) {
        if (h.class === 'strong') allDistinctMatchers.add(h.matcher);
      }
    }
  }

  // Aggregate.
  const totals = assertionStats.reduce((acc, s) => {
    acc.total += s.total; acc.strong += s.strong; acc.weak += s.weak;
    acc.snapshot += s.snapshot; acc.other += s.other; return acc;
  }, { total: 0, strong: 0, weak: 0, snapshot: 0, other: 0 });
  const weakRatio = totals.total > 0 ? totals.weak / totals.total : 0;
  const snapshotRatio = totals.total > 0 ? totals.snapshot / totals.total : 0;

  // ── Mutant count estimate (unchanged from prior version). ─────────
  const totalMutants = Math.floor(totalFiles * 3 + totalLines / 100);

  // ── Score: combine test-to-source ratio + assertion quality. ──────
  //   baseScore from test-to-source:  25..75
  //   adjustments:
  //     - high variety (distinct strong matchers ≥ 5)        : +5
  //     - very weak (weakRatio > 0.3)                         : −10
  //     - snapshot-heavy (snapshotRatio > 0.5)                : −5
  //     - has Stryker / @stryker-mutator/core                 : +10
  const testRatio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  const baseScore = Math.min(75, Math.round(25 + testRatio * 100));
  let adjusted = baseScore;
  if (allDistinctMatchers.size >= 5) adjusted += 5;
  if (weakRatio > 0.3) adjusted -= 10;
  if (snapshotRatio > 0.5) adjusted -= 5;
  if (hasMutationTool) adjusted += 10;
  const estimatedMutationScore = Math.max(10, Math.min(90, adjusted));
  const killedMutants = Math.floor((totalMutants * estimatedMutationScore) / 100);

  findings.push({
    severity:
      estimatedMutationScore < 50 ? 'high' : estimatedMutationScore < 70 ? 'medium' : 'low',
    title: `Estimated mutation score: ~${estimatedMutationScore}% (heuristic)`,
    description:
      `Inputs: ${testFiles} test files / ${sourceFiles} source files (ratio ${testRatio.toFixed(2)}), ` +
      `${totals.total} assertions (${totals.strong} strong, ${totals.weak} weak, ${totals.snapshot} snapshot), ` +
      `${allDistinctMatchers.size} distinct strong-matcher type(s)${hasMutationTool ? ', Stryker present' : ''}. ` +
      `~${killedMutants}/${totalMutants} candidate mutants likely killed. ` +
      'Run Stryker for the exact number.',
    fixSuggestion:
      estimatedMutationScore < 70
        ? 'Boost the kill rate: replace `toBeTruthy()` with `toBe(specificValue)`, add boundary-condition tests, vary the matcher types you use.'
        : 'Strong test footprint. Run Stryker to validate.',
    category: 'Mutation Testing',
  });

  // ── Per-anti-pattern surfacing. ───────────────────────────────────
  // Weak-assertion-heavy files.
  const weakHeavy = assertionStats.filter((s) => s.total >= 3 && s.weak / s.total > 0.5);
  if (weakHeavy.length > 0) {
    findings.push({
      severity: 'medium',
      title: `${weakHeavy.length} test file(s) dominated by weak assertions`,
      description:
        'Files where >50% of assertions are toBeTruthy / toBeFalsy / toBeDefined / toBeNull. ' +
        `Examples: ${weakHeavy.slice(0, 3).map((s) => `${s.filePath} (${s.weak}/${s.total} weak)`).join('; ')}.`,
      fixSuggestion:
        'A mutation that changes `42` to `41` still satisfies `toBeTruthy()`. Replace with `toBe(42)` or `toEqual({…})` to actually catch behaviour changes.',
      category: 'Mutation Testing',
    });
  }

  // Snapshot-only files.
  const snapshotOnly = assertionStats.filter((s) => s.total >= 2 && s.snapshot / s.total >= 0.9);
  if (snapshotOnly.length > 0) {
    findings.push({
      severity: 'low',
      title: `${snapshotOnly.length} test file(s) dominated by snapshot assertions`,
      description:
        `Files where ≥90% of assertions are toMatchSnapshot / toMatchInlineSnapshot. ` +
        `Examples: ${snapshotOnly.slice(0, 3).map((s) => `${s.filePath} (${s.snapshot}/${s.total})`).join('; ')}.`,
      fixSuggestion:
        'Snapshots catch SOME mutants but are brittle (changes in unrelated fields cause failures). Mix in concrete assertions on the values that actually matter.',
      category: 'Mutation Testing',
    });
  }

  // Low variety overall.
  if (allDistinctMatchers.size < 4 && assertionStats.length >= 3) {
    findings.push({
      severity: 'low',
      title: `Low matcher variety: only ${allDistinctMatchers.size} distinct strong-matcher type(s) across all tests`,
      description:
        'A test suite that uses only one or two matcher shapes (e.g. all `toBe`) misses categories of mutations that other matchers would catch — `toEqual` for object equality, `toThrow` for error paths, `toHaveLength` for array sizes, etc.',
      fixSuggestion:
        'Audit your assertion library — use the right matcher for each property. The Jest docs\' "Expect" page is a checklist of options.',
      category: 'Mutation Testing',
    });
  }

  if (!hasMutationTool) {
    findings.push({
      severity: 'low',
      title: 'Mutation testing tool not configured',
      description: 'Stryker Mutator or similar not found in devDependencies. Install to get real mutation scores.',
      fixSuggestion: 'npm install -D @stryker-mutator/core && npx stryker init',
      category: 'Mutation Testing',
    });
  }

  return {
    score: estimatedMutationScore,
    estimatedMutationScore,
    totalMutants,
    killedMutants,
    assertionStats,
    assertionTotals: {
      ...totals,
      weakRatio: Math.round(weakRatio * 100) / 100,
      snapshotRatio: Math.round(snapshotRatio * 100) / 100,
      overallVariety: allDistinctMatchers.size,
    },
    findings,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 7. PREDICTIVE MODEL — Failure prediction based on code patterns
// ═══════════════════════════════════════════════════════════════════

export interface PredictiveReport {
  score: number;
  riskLevel: string;
  predictedFailures: number;
  /** Per-file risk breakdown, sorted highest score first. Empty when no file has any risk signal. */
  topRiskyFiles: FileRisk[];
  findings: Finding[];
}

/**
 * Cross-signal predictive risk aggregator (pass 4).
 *
 * Optional `crossSignals` argument: if the caller has already run
 * security / n+1 / dead-code analyzers, pass their findings in and
 * predictive will incorporate them into per-file scores. Otherwise
 * predictive does its own light-weight versions internally so it
 * still produces meaningful output when invoked standalone.
 *
 * Determinism: same inputs → same scores. Weights are fixed in
 * `lib/predictive.ts`.
 */
export async function runPredictiveAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  devDependencies: string[],
  crossSignals?: {
    securityFindings?: Array<{ filePath: string; severity: string }>;
    nPlusOneFindings?: Array<{ filePath: string }>;
    deadExports?: Array<{ filePath: string; name: string }>;
  }
): Promise<PredictiveReport> {
  const findings: Finding[] = [];

  /* ── Per-file signals ────────────────────────────────────────────── */
  const files: Array<{ path: string; loc: number }> = [];
  const complexityByFile = new Map<string, { maxCc: number; totalCc: number; hottest?: string }>();
  const nPlusOneByFile = new Map<string, number>();
  const deadByFile = new Map<string, number>();
  const todoByFile = new Map<string, number>();
  const parseable: Array<{ filePath: string; ast: t.File }> = [];

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    if (filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const loc = content.split('\n').length;
    files.push({ path: filePath, loc });

    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;
    parseable.push({ filePath, ast: parsed.ast });

    // Complexity per file
    const cc = computeFileComplexity(filePath, parsed.ast);
    complexityByFile.set(filePath, {
      maxCc: cc.maxCc,
      totalCc: cc.totalCc,
      hottest: cc.hottest[0]?.name,
    });

    // Self-derived N+1 if caller didn't provide
    if (!crossSignals?.nPlusOneFindings) {
      const hits = findNPlusOneHits(parsed.ast);
      if (hits.length > 0) nPlusOneByFile.set(filePath, hits.length);
    }

    // TODO/FIXME density per file
    const todos = (content.match(/\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b|\bWORKAROUND\b/g) || []).length;
    if (todos > 0) todoByFile.set(filePath, todos);
  }

  // Cross-signal: security findings supplied by caller (preferred).
  const securityByFile = crossSignals?.securityFindings
    ? bucketSecurityByFile(crossSignals.securityFindings)
    : new Map<string, Record<PredictiveSeverity, number>>();

  // Cross-signal: n+1 findings supplied by caller (override self-derived above).
  if (crossSignals?.nPlusOneFindings) {
    for (const f of crossSignals.nPlusOneFindings) {
      if (!f.filePath) continue;
      nPlusOneByFile.set(f.filePath, (nPlusOneByFile.get(f.filePath) ?? 0) + 1);
    }
  }

  // Cross-signal: dead exports supplied by caller (otherwise derive).
  if (crossSignals?.deadExports) {
    for (const d of crossSignals.deadExports) {
      deadByFile.set(d.filePath, (deadByFile.get(d.filePath) ?? 0) + 1);
    }
  } else if (parseable.length > 0) {
    const asts = new Map(parseable.map(({ filePath, ast }) => [filePath, ast]));
    const report = findDeadCode(asts, dependencies);
    for (const d of report.unusedExports) {
      deadByFile.set(d.filePath, (deadByFile.get(d.filePath) ?? 0) + 1);
    }
  }

  /* ── Aggregate ───────────────────────────────────────────────────── */
  const risks = aggregateFileRisk({
    files,
    complexityByFile,
    securityByFile,
    nPlusOneByFile,
    deadExportsByFile: deadByFile,
    todoCountByFile: todoByFile,
  });

  /* ── Findings: top-N risky files surfaced ────────────────────────── */
  const topN = Math.min(risks.length, 5);
  for (let i = 0; i < topN; i++) {
    const r = risks[i];
    const sev: 'high' | 'medium' | 'low' = r.score >= 30 ? 'high' : r.score >= 12 ? 'medium' : 'low';
    findings.push({
      severity: sev,
      title: `Risk hotspot: ${r.filePath} (score ${r.score})`,
      description: `Aggregated signals: ${r.reasons.join(' · ')}.`,
      filePath: r.filePath,
      fixSuggestion:
        'Triage the contributing signals in order: critical-security first, then N+1 hits, then refactor the hottest function (extract guard clauses, split into smaller fns). Add tests around the hottest function before refactoring.',
      category: 'Predictive',
    });
  }

  /* ── Project-level dep-hygiene finding (preserved from prior version) ── */
  if (dependencies.length > 10 && !devDependencies.some((d) => d.includes('renovate') || d.includes('dependabot'))) {
    findings.push({
      severity: 'low',
      title: 'No automated dependency updates',
      description:
        'No Renovate / Dependabot detected. Dependencies will drift, accumulating CVEs.',
      fixSuggestion:
        'Enable Dependabot via `.github/dependabot.yml`, or Renovate via the GitHub App. Schedule a weekly security sprint to land the PRs.',
      category: 'Predictive',
    });
  }

  /* ── Score & risk level ──────────────────────────────────────────── */
  // Project-level score: 100 minus a curve over (sum of risk scores).
  // We use the SUM not the max so concentrated risk in one file and
  // spread risk across many both register.
  const projectRiskRaw = risks.reduce((s, r) => s + r.score, 0);
  // Curve: each 5 risk points knocks off 1 score point, capped at 90 off.
  const score = Math.max(10, Math.round(100 - Math.min(projectRiskRaw / 5, 90)));

  let riskLevel: string;
  if (projectRiskRaw < 10) {
    riskLevel = 'Low — no concentrated risk in any single file.';
  } else if (projectRiskRaw < 40) {
    riskLevel = `Medium — ${risks.length} file(s) carry measurable risk; ${risks[0]?.filePath ?? ''} is the hottest.`;
  } else {
    riskLevel = `High — ${risks.length} file(s) flagged; address ${risks.slice(0, 3).map((r) => r.filePath).join(', ')} first.`;
  }

  const predictedFailures = Math.floor(projectRiskRaw / 5);

  return {
    score,
    riskLevel,
    predictedFailures,
    topRiskyFiles: risks.slice(0, 10),
    findings,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════════

function dependenciesInclude(fileContents: Record<string, string>, ...terms: string[]): boolean {
  const allContent = Object.values(fileContents).join('\n').toLowerCase();
  return terms.some(t => allContent.includes(t.toLowerCase()));
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2 DEEP ENHANCEMENTS
// ═══════════════════════════════════════════════════════════════════

// Supply-chain audit (pass 8 — lockfile-aware).
//
// Now reads package-lock.json (when present) to expose the full
// transitive graph. Adds detection for:
//   - non-registry sources (git+, file:, link:, http:)
//   - missing integrity hashes
//   - duplicate-version drift (same package at multiple versions)
// Plus the existing direct-dep CVE check, now extended to also scan
// transitive deps in the lockfile.
export interface SupplyChainReport {
  score: number;
  /** Direct (package.json) deps. */
  totalDeps: number;
  /** Total entries including transitives (from lockfile). 0 if no lockfile. */
  totalTransitive: number;
  /** Direct + transitive entries that match the CVE list. */
  knownVulnerable: number;
  /** Subset of knownVulnerable at high/critical severity. */
  criticalVulns: number;
  /** Distinct packages installed from non-registry sources. */
  nonRegistrySources: number;
  /** Entries that should have integrity but don't. */
  missingIntegrity: number;
  /** Package names with multiple installed versions. */
  duplicateVersions: number;
  findings: Finding[];
}

export function runSupplyChainAudit(
  dependencies: string[],
  devDependencies: string[],
  projectPath?: string
): SupplyChainReport {
  const findings: Finding[] = [];
  const allDirect = [...dependencies, ...devDependencies];

  // ── 1. CVE catalogue (extend over time; OSV API is a v2 follow-up). ──
  const vulnerablePatterns: Record<string, { cve: string; severity: 'critical' | 'high' | 'medium' | 'low'; fixVersion: string }> = {
    'lodash':        { cve: 'CVE-2021-23337', severity: 'high',   fixVersion: '4.17.21' },
    'express':       { cve: 'CVE-2024-29041', severity: 'medium', fixVersion: '4.19.0'  },
    'axios':         { cve: 'CVE-2023-45857', severity: 'medium', fixVersion: '1.6.0'   },
    'webpack':       { cve: 'CVE-2023-28154', severity: 'high',   fixVersion: '5.76.0'  },
    'json5':         { cve: 'CVE-2022-46175', severity: 'high',   fixVersion: '2.2.2'   },
    'glob-parent':   { cve: 'CVE-2020-28469', severity: 'high',   fixVersion: '5.1.2'   },
    'semver':        { cve: 'CVE-2022-25883', severity: 'medium', fixVersion: '7.5.2'   },
    'node-fetch':    { cve: 'CVE-2022-0235',  severity: 'medium', fixVersion: '3.2.10'  },
    'minimist':      { cve: 'CVE-2021-44906', severity: 'high',   fixVersion: '1.2.6'   },
    'word-wrap':     { cve: 'CVE-2023-26115', severity: 'medium', fixVersion: '1.2.4'   },
    'jsonwebtoken':  { cve: 'CVE-2022-23541', severity: 'high',   fixVersion: '9.0.0'   },
  };

  let knownVulnerable = 0;
  let criticalVulns = 0;
  const reportedDirect = new Set<string>();

  for (const dep of allDirect) {
    const depName = dep.replace(/^[@]/, '').split('@')[0] || dep;
    const vuln = vulnerablePatterns[depName.toLowerCase()];
    if (!vuln) continue;
    reportedDirect.add(depName.toLowerCase());
    knownVulnerable++;
    if (vuln.severity === 'critical' || vuln.severity === 'high') criticalVulns++;
    findings.push({
      severity: vuln.severity,
      title: `${depName}: ${vuln.cve}`,
      description: `Direct dependency \`${depName}\` matches a known vulnerable version range. Recommended fix: >= ${vuln.fixVersion}.`,
      fixSuggestion: `npm install ${depName}@${vuln.fixVersion}`,
      category: 'Supply Chain',
    });
  }

  // ── 2. Lockfile-aware checks (NEW). ──
  let graph: SupplyChainGraph = {
    totalEntries: 0, directCount: 0, entries: [], lockfileVersion: null, sourceFile: null,
  };
  if (projectPath) graph = loadLockGraph(projectPath);

  // 2a. Transitive CVE matches.
  if (graph.entries.length > 0) {
    for (const entry of graph.entries) {
      const lowerName = entry.name.toLowerCase();
      if (reportedDirect.has(lowerName)) continue; // already surfaced as direct
      const vuln = vulnerablePatterns[lowerName];
      if (!vuln) continue;
      knownVulnerable++;
      if (vuln.severity === 'critical' || vuln.severity === 'high') criticalVulns++;
      findings.push({
        severity: vuln.severity,
        title: `Transitive: ${entry.name}@${entry.version} — ${vuln.cve}`,
        description: `Transitive dependency (installed via a top-level dep) matches a known CVE. Resolved from: ${entry.resolved ?? '(unknown)'}.`,
        fixSuggestion: `Run \`npm audit fix\`, or add an override in package.json: { "overrides": { "${entry.name}": ">=${vuln.fixVersion}" } }`,
        category: 'Supply Chain',
      });
    }
  }

  // 2b. Lockfile flags.
  const flags = findSupplyChainFlags(graph);

  if (flags.nonRegistry.length > 0) {
    const sample = flags.nonRegistry.slice(0, 3)
      .map((e: LockfileEntry) => `${e.name}@${e.version} (${e.resolved})`).join('; ');
    findings.push({
      severity: 'medium',
      title: `${flags.nonRegistry.length} dependency / dependencies from non-registry sources`,
      description:
        `Some packages are installed from git URLs, local files, or non-https registries. Examples: ${sample}. ` +
        'Non-registry sources skip npm\'s tarball signing and can be replaced silently.',
      fixSuggestion:
        'Publish forked packages to a private registry (npm/Verdaccio/GitHub Packages) instead of pulling from git. Pin the git refs to commit SHAs if you must.',
      category: 'Supply Chain',
    });
  }

  if (flags.missingIntegrity.length > 0) {
    findings.push({
      severity: 'medium',
      title: `${flags.missingIntegrity.length} package(s) without integrity hashes`,
      description:
        'Lockfile entries with no `integrity` SHA mean npm can\'t verify the bytes match what was published. Usually a sign of an outdated lockfile or a manual edit.',
      fixSuggestion: 'Run `rm -rf node_modules package-lock.json && npm install` to regenerate the lockfile with fresh integrity hashes.',
      category: 'Supply Chain',
    });
  }

  if (flags.duplicateVersions.size > 0) {
    const sample = [...flags.duplicateVersions.entries()].slice(0, 3)
      .map(([n, vs]) => `${n} @ {${vs.join(', ')}}`).join('; ');
    findings.push({
      severity: 'low',
      title: `${flags.duplicateVersions.size} package(s) installed at multiple versions`,
      description:
        `Version drift inflates bundle size and is a red flag for transitive-dep replacement attacks. Examples: ${sample}.`,
      fixSuggestion:
        'Use `npm ls <name>` to find which deps pin the older version. Add an `overrides` entry to deduplicate, or upgrade the parent dep.',
      category: 'Supply Chain',
    });
  }

  if (graph.entries.length === 0 && projectPath) {
    findings.push({
      severity: 'low',
      title: 'No package-lock.json found',
      description: 'Without a lockfile, every install can pull different transitive versions. Only direct-dep CVEs were checked.',
      fixSuggestion: 'Commit a `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm), or `yarn.lock` (yarn). Treat lockfile changes as security-sensitive in code review.',
      category: 'Supply Chain',
    });
  }

  const score = Math.max(0,
    100
    - knownVulnerable * 6
    - criticalVulns * 9
    - flags.nonRegistry.length * 4
    - Math.min(flags.missingIntegrity.length, 10) * 1
    - Math.min(flags.duplicateVersions.size, 10) * 1
  );

  return {
    score,
    totalDeps: allDirect.length,
    totalTransitive: graph.entries.length,
    knownVulnerable,
    criticalVulns,
    nonRegistrySources: flags.nonRegistry.length,
    missingIntegrity: flags.missingIntegrity.length,
    duplicateVersions: flags.duplicateVersions.size,
    findings,
  };
}

// N+1 Query Detection (AST-aware as of 0.9.0).
//
// Walks each parseable file looking for db.query / db.findOne / sql`...` /
// prisma.x / mongoose.x / sequelize.x calls inside loop constructs
// (for / for-of / for-in / while / do-while / arr.{forEach,map,filter,…}).
// Skips Promise.all / Promise.allSettled wrappers (parallelised, not N+1).
//
// Replaces the prior line-counting regex which over-fired on inner
// closures and missed db calls inside arrow-function loop bodies.
export interface NPlusOneReport { score: number; potentialNPlusOne: number; findings: Finding[]; }

export function runNPlusOneDetection(fileContents: Record<string, string>): NPlusOneReport {
  const findings: Finding[] = [];
  let potentialNPlusOne = 0;

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;

    const parsed = parseFile(filePath, content);
    if (!parsed.ast) continue;

    const hits = findNPlusOneHits(parsed.ast);
    potentialNPlusOne += hits.length;

    for (const hit of hits) {
      if (findings.length >= 8) break;
      const lines = content.split('\n');
      const snippet = (lines[hit.line - 1] || '').trim().slice(0, 140);
      findings.push({
        severity: 'high',
        title: `Potential N+1 Query in ${hit.loopKind}`,
        description: `\`${hit.calleeName}()\` is invoked inside a \`${hit.loopKind}\` loop at ${filePath}:${hit.line}. Each iteration issues its own DB round-trip.\nLine: ${snippet}`,
        filePath,
        lineNumber: hit.line,
        fixSuggestion:
          'Batch the query: pre-build the id list, fire one query with `WHERE id IN (...)`, ' +
          'or use eager-loading (`.include()` / `.populate()` / `JOIN`). For parallelisation only, ' +
          'wrap in `Promise.all([...].map(...))` so the round-trips overlap.',
        category: 'N+1 Query',
      });
    }
  }

  // Score model: each N+1 detection costs 12 points; cap at 100.
  const score = Math.max(0, 100 - potentialNPlusOne * 12);
  return { score: Math.min(100, score), potentialNPlusOne, findings };
}

// Dead Code & Unused Dependencies (AST-aware as of 0.9.0).
//
// Replaces the prior `allContent.includes(name)` heuristic which marked
// the symbol's OWN declaration as a usage and treated common words
// (process, data, …) as "referenced everywhere." This version:
//   - Parses every file once.
//   - For each declared/exported symbol, asks: does ANY OTHER file
//     reference an identifier with this name? Only then "used."
//   - For deps: matches on the module ROOT, so `lodash/get` counts as
//     a use of `lodash`.
//
// Limitation: cross-file identifier matching is still name-based, so a
// global `app` declared in two files would be considered cross-used.
// Acceptable for a static analyzer; future work can do scope-aware
// resolution.
export interface DeadCodeReport {
  score: number;
  unusedDeps: string[];
  deadFunctions: number;
  findings: Finding[];
}

export function runDeadCodeAnalysis(fileContents: Record<string, string>, dependencies: string[]): DeadCodeReport {
  const findings: Finding[] = [];

  // Parse every parseable file once. Skip oversize / unparseable.
  const asts = new Map<string, t.File>();
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    if (!isParseable(filePath)) continue;
    const parsed = parseFile(filePath, content);
    if (parsed.ast) asts.set(filePath, parsed.ast);
  }

  const report = findDeadCode(asts, dependencies);

  if (report.unusedDeps.length > 0) {
    findings.push({
      severity: 'medium',
      title: `${report.unusedDeps.length} Unused Dependencies`,
      description: `Dependencies not imported anywhere: ${report.unusedDeps.slice(0, 5).join(', ')}${report.unusedDeps.length > 5 ? ', …' : ''}. These increase bundle size, install time, and supply-chain attack surface.`,
      fixSuggestion: 'Remove with: `npm uninstall ' + report.unusedDeps.slice(0, 3).join(' ') + '`. ' +
        'Confirm with `npx depcheck` before removing — some packages are loaded by side-effect (Babel plugins, polyfills) without explicit imports.',
      category: 'Dead Code',
    });
  }

  // Group dead exports by file for a concise top-N listing.
  const deadByFile = new Map<string, string[]>();
  for (const { filePath, name } of report.unusedExports) {
    if (!deadByFile.has(filePath)) deadByFile.set(filePath, []);
    deadByFile.get(filePath)!.push(name);
  }
  const deadFunctions = report.unusedExports.length;
  if (deadFunctions > 0) {
    const top = [...deadByFile.entries()].slice(0, 5);
    const detail = top.map(([f, names]) => `  ${f}: ${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''}`).join('\n');
    findings.push({
      severity: deadFunctions > 10 ? 'medium' : 'low',
      title: `${deadFunctions} Exported Symbols Not Referenced Anywhere`,
      description: `Exports that no other file imports:\n${detail}`,
      fixSuggestion:
        'Either remove the export, narrow it to `@internal` / non-exported, or use it from another module. ' +
        'For dual-purpose exports (used by external consumers via the package surface), add them to the package\'s main entry index file so they\'re reachable.',
      category: 'Dead Code',
    });
  }

  const score = Math.max(0, 100 - report.unusedDeps.length * 8 - Math.min(deadFunctions, 20) * 2);
  return {
    score: Math.min(100, score),
    unusedDeps: report.unusedDeps,
    deadFunctions,
    findings,
  };
}

// License Compliance Check (pass 9 — SPDX-categorized from node_modules).
//
// Walks `node_modules/` (when present) and reads each package's
// `license` field. Categorizes per SPDX into:
//   - permissive   (MIT, ISC, Apache-2.0, BSD-*)
//   - copyleftWeak (LGPL-*, MPL-*, EPL-*)
//   - copyleftStrong (GPL-*, AGPL-*) ← incompatible with proprietary distribution
//   - proprietary (UNLICENSED, "SEE LICENSE IN …")
//   - unknown      (missing license field)
//
// When node_modules isn't present, emits a "license audit not run"
// finding so the limitation is honest, not silently misreported.
export interface LicenseReport {
  score: number;
  /** Whether we found a node_modules tree to inspect. */
  inspected: boolean;
  /** Counts by SPDX category. */
  byCategory: Record<LicenseCategory, number>;
  /** All packages whose license falls into copyleftStrong (acts on info downstream). */
  copyleftDeps: string[];
  /** Subset list — strong copyleft packages with their version + license. */
  strongCopyleft: PackageLicense[];
  /** Subset list — weak copyleft packages (LGPL/MPL/EPL) — usually OK with caveats. */
  weakCopyleft: PackageLicense[];
  /** Subset list — packages with no resolvable license field. */
  unknownLicense: number;
  findings: Finding[];
}

export function runLicenseCheck(dependencies: string[], projectPath?: string): LicenseReport {
  const findings: Finding[] = [];

  // Pull from disk-installed node_modules if available.
  const audit = projectPath
    ? auditLicenses(projectPath)
    : { inspected: false, nodeModulesPath: null, packages: [],
        byCategory: { permissive: 0, copyleftWeak: 0, copyleftStrong: 0, proprietary: 0, unknown: 0 } as Record<LicenseCategory, number> };

  const strongCopyleft = audit.packages.filter((p) => p.category === 'copyleftStrong');
  const weakCopyleft = audit.packages.filter((p) => p.category === 'copyleftWeak');
  const proprietary = audit.packages.filter((p) => p.category === 'proprietary');

  if (!audit.inspected) {
    findings.push({
      severity: 'low',
      title: 'License audit could not run — no node_modules/ found',
      description:
        'License compliance requires reading each installed package\'s `license` field, but no `node_modules/` directory was present.',
      fixSuggestion:
        `Run \`npm install\` (or your package manager's equivalent) before the analysis, or supply pre-installed dependencies. ` +
        `Without this, ${dependencies.length} declared deps are unchecked for license compatibility.`,
      category: 'License Compliance',
    });
  } else {
    if (strongCopyleft.length > 0) {
      const sample = strongCopyleft.slice(0, 5)
        .map((p) => `${p.name}@${p.version} (${p.spdx})`).join('; ');
      findings.push({
        severity: 'high',
        title: `${strongCopyleft.length} strong-copyleft (GPL/AGPL) dependency / dependencies`,
        description:
          `Strong copyleft licenses can require you to release your source under the same terms when you redistribute. Examples: ${sample}.`,
        fixSuggestion:
          'If you ship proprietary code: replace these with permissively-licensed alternatives, or carve them into a separate process boundary so the AGPL/GPL boundary doesn\'t extend to your code. Get sign-off from legal regardless.',
        category: 'License Compliance',
      });
    }
    if (weakCopyleft.length > 0) {
      const sample = weakCopyleft.slice(0, 5)
        .map((p) => `${p.name}@${p.version} (${p.spdx})`).join('; ');
      findings.push({
        severity: 'medium',
        title: `${weakCopyleft.length} weak-copyleft (LGPL/MPL/EPL) dependency / dependencies`,
        description:
          `Weak copyleft is usually compatible with proprietary distribution, BUT the specific license terms (linking exceptions, distribution requirements) vary. Examples: ${sample}.`,
        fixSuggestion:
          'Document in your THIRD_PARTY_NOTICES file. For LGPL specifically: dynamic linking is fine, static linking triggers source-disclosure obligations.',
        category: 'License Compliance',
      });
    }
    if (proprietary.length > 0) {
      findings.push({
        severity: 'medium',
        title: `${proprietary.length} package(s) with UNLICENSED / "SEE LICENSE IN …" markers`,
        description: 'Packages with explicit "UNLICENSED" or custom-license markers can\'t be used without permission. Examples: ' +
          proprietary.slice(0, 5).map((p) => `${p.name}@${p.version}`).join(', ') + '.',
        fixSuggestion:
          'Read the LICENSE file in each affected package and verify your team has written permission. If it\'s a leaked private package, replace it immediately.',
        category: 'License Compliance',
      });
    }
    const unknownCount = audit.byCategory.unknown;
    if (unknownCount > 0) {
      findings.push({
        severity: 'low',
        title: `${unknownCount} package(s) with no resolvable license field`,
        description: 'These dependencies omit the `license` field in their package.json. Their LICENSE file (if any) may still provide one, but it can\'t be inspected automatically.',
        fixSuggestion: 'Run `npx license-checker --summary` for a deeper crawl that reads LICENSE files. Open issues upstream asking maintainers to add SPDX identifiers.',
        category: 'License Compliance',
      });
    }
  }

  // Score: 100 minus weighted deductions.
  const score = Math.max(0,
    100
    - strongCopyleft.length * 15
    - weakCopyleft.length * 5
    - proprietary.length * 8
    - (audit.inspected ? 0 : 10)  // honest penalty for not running
  );

  const copyleftDeps = strongCopyleft.map((p) => `${p.name}@${p.version}`);

  return {
    score,
    inspected: audit.inspected,
    byCategory: audit.byCategory,
    copyleftDeps,
    strongCopyleft,
    weakCopyleft,
    unknownLicense: audit.byCategory.unknown,
    findings,
  };
}

// DORA Metrics Estimation
export interface DoraReport { score: number; deploymentFreq: string; leadTime: string; mttr: string; changeFailRate: string; findings: Finding[]; }

export function runDoraEstimation(fileContents: Record<string, string>, devDependencies: string[]): DoraReport {
  const findings: Finding[] = [];
  const allContent = Object.values(fileContents).join('\n');
  
  // Check CI/CD indicators
  const hasCI = Object.keys(fileContents).some(f => f.includes('.github/workflows') || f.includes('.gitlab-ci')) ||
    allContent.includes('github-actions') || allContent.includes('circleci');
  const hasDocker = Object.keys(fileContents).some(f => f.includes('Dockerfile'));
  const hasTests = devDependencies.some(d => d.includes('jest') || d.includes('vitest'));
  const hasMonitoring = devDependencies.some(d => d.includes('sentry') || d.includes('datadog'));

  let deploymentFreq = 'Unknown';
  let leadTime = 'Unknown';
  let mttr = 'Unknown';
  let changeFailRate = 'Unknown';

  if (hasCI && hasDocker) {
    deploymentFreq = 'Daily (estimated)';
    leadTime = '< 1 day (estimated)';
  } else if (hasCI) {
    deploymentFreq = 'Weekly (estimated)';
    leadTime = '1-3 days (estimated)';
  } else {
    deploymentFreq = 'Manual';
    leadTime = '> 1 week (estimated)';
  }

  mttr = hasMonitoring ? '< 1 hour (estimated)' : '> 4 hours (estimated)';
  changeFailRate = hasTests ? '< 15% (estimated)' : '> 30% (estimated)';

  if (!hasCI) {
    findings.push({
      severity: 'high',
      title: 'No CI/CD Pipeline Detected',
      description: 'Deployment frequency and lead time cannot be optimized without CI/CD.',
      fixSuggestion: 'Set up GitHub Actions CI. Add automated testing. Use Docker for consistent deployments.',
      category: 'DORA Metrics',
    });
  }

  const score = hasCI ? (hasDocker ? 85 : 65) : 30;
  return { score, deploymentFreq, leadTime, mttr, changeFailRate, findings };
}

// OWASP Top 10 (2021) Coverage — pass 7.
//
// The report distinguishes three signals so dashboards can render them
// as separate concepts:
//
//   analyzerCoverage: which categories the ANALYZER has rules for
//                     (independent of any specific project)
//   projectFindings:  for each category, how many findings THIS project
//                     has, with severity breakdown
//   gaps:             categories the analyzer ships no rules for
//                     (A08 Software-Integrity, A10 SSRF as of v0.15.0)
//
// Score: analyzer-coverage as a percentage. Project-findings count is
// surfaced separately in `byCategory` so the user can see, e.g.,
// "the analyzer covers 8/10 categories; this project has 7 findings
// concentrated in A03 (Injection) and A02 (Cryptographic Failures)."
export interface OwaspCategoryReport {
  code: OwaspCode;
  title: string;
  /** Analyzer ships ≥1 rule for this category. */
  analyzerCovers: boolean;
  /** Finding count in this project, by severity. */
  findings: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  /** Specific security-analyzer category names that mapped here. */
  detectorCategories: string[];
}

export interface OwaspReport {
  /** % of OWASP 2021 categories the analyzer has rules for. */
  score: number;
  /** Alias of score, kept for backward compatibility. */
  coverage: number;
  /** OWASP titles the analyzer covers, e.g. "A03:2021 — Injection". */
  coveredCategories: string[];
  /** OWASP titles the analyzer does NOT yet cover. */
  missingCategories: string[];
  /** Full per-category breakdown. */
  byCategory: OwaspCategoryReport[];
  findings: Finding[];
}

export function runOwaspCoverage(securityFindings: Finding[]): OwaspReport {
  // Initialize per-category counters.
  const byCategory: OwaspCategoryReport[] = OWASP_2021.map((meta) => ({
    code: meta.code,
    title: meta.title,
    analyzerCovers: meta.analyzerCovers,
    findings: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    detectorCategories: meta.detectorCategories,
  }));
  const codeIndex = new Map(byCategory.map((c) => [c.code, c]));

  // Bucket project findings.
  for (const f of securityFindings) {
    const codes = owaspCodesForCategory(f.category);
    for (const code of codes) {
      const bucket = codeIndex.get(code);
      if (!bucket) continue;
      bucket.findings.total++;
      if (f.severity === 'critical') bucket.findings.critical++;
      else if (f.severity === 'high') bucket.findings.high++;
      else if (f.severity === 'medium') bucket.findings.medium++;
      else if (f.severity === 'low') bucket.findings.low++;
    }
  }

  const analyzerCoveredCount = byCategory.filter((c) => c.analyzerCovers).length;
  const coverage = Math.round((analyzerCoveredCount / byCategory.length) * 100);
  const coveredCategories = byCategory.filter((c) => c.analyzerCovers).map((c) => c.title);
  const missingCategories = byCategory.filter((c) => !c.analyzerCovers).map((c) => c.title);

  // Emit findings:
  // 1) Analyzer-gap finding (covers <10 categories). Tells the USER OF
  //    the analyzer that we don't catch everything yet — honest framing.
  const findings: Finding[] = [];
  if (missingCategories.length > 0) {
    findings.push({
      severity: 'low',
      title: `OWASP Top 10 analyzer coverage: ${coverage}% (${analyzerCoveredCount}/${byCategory.length})`,
      description:
        `TestForge ships rules for ${analyzerCoveredCount} of the 10 OWASP 2021 categories. ` +
        `Categories without dedicated rules yet: ${missingCategories.join(', ')}. ` +
        'These are gaps in the analyzer itself — your project may still have issues in these areas that this report won\'t surface.',
      fixSuggestion:
        'For the un-covered categories, complement TestForge with: dependency-track for A08 (software integrity), an SSRF-focused fuzzer or proxy-based runtime scan for A10. Track the gap in your threat model.',
      category: 'OWASP Coverage',
    });
  }

  // 2) Per-category "concentrated risk" findings: any category with
  //    ≥1 critical or ≥3 high findings is worth surfacing as a single
  //    rollup so the user sees the OWASP framing.
  for (const c of byCategory) {
    if (c.findings.critical > 0 || c.findings.high >= 3) {
      const sev: 'critical' | 'high' = c.findings.critical > 0 ? 'critical' : 'high';
      findings.push({
        severity: sev,
        title: `${c.title}: ${c.findings.total} finding(s)`,
        description:
          `Severity breakdown: ${c.findings.critical} critical, ${c.findings.high} high, ${c.findings.medium} medium, ${c.findings.low} low. ` +
          `Detector categories that contributed: ${c.detectorCategories.join(', ') || '—'}.`,
        fixSuggestion:
          'Triage the underlying findings in the Security section. OWASP framing is a roll-up; act on the per-file findings.',
        category: 'OWASP Coverage',
      });
    }
  }

  return {
    score: coverage,
    coverage,
    coveredCategories,
    missingCategories,
    byCategory,
    findings,
  };
}
