// Advanced Analyzers — completing all 13 testing dimensions
// Contract, Visual Regression, Edge Case, Property-Based, Chaos, Mutation, Predictive

import { parseFile, isParseable } from './lib/parse.js';
import { findNPlusOneHits } from './lib/n-plus-one.js';
import { findDeadCode } from './lib/dead-code.js';
import { extractOpenApi, canonicalPath } from './lib/openapi-parse.js';
import { discoverEndpoints, endpointSet, type DiscoveredEndpoint } from './lib/endpoint-discovery.js';
import { computeFileComplexity } from './lib/complexity.js';
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

export interface ChaosReport {
  score: number;
  resilienceLevel: string;
  findings: Finding[];
}

export async function runChaosAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  techStack: string[]
): Promise<ChaosReport> {
  const findings: Finding[] = [];
  const allContent = Object.values(fileContents).join('\n');

  // Check error handling
  const hasTryCatch = (allContent.match(/try\s*{/g) || []).length;
  const hasCircuitBreaker = dependencies.some(d =>
    d.includes('opossum') || d.includes('circuit-breaker') || d.includes('resilience')
  );
  const hasRetry = dependencies.some(d =>
    d.includes('retry') || d.includes('exponential-backoff') || d.includes('p-retry')
  );

  if (!hasTryCatch) {
    findings.push({
      severity: 'critical',
      title: 'No Error Handling (try/catch)',
      description: 'Zero try/catch blocks found. Any unhandled exception will crash the application.',
      fixSuggestion: 'Add try/catch around all async operations. Create a global error handler middleware.',
      category: 'Chaos Engineering',
    });
  }

  if (!hasCircuitBreaker && techStack.some(t => ['Express', 'Fastify', 'Koa'].includes(t))) {
    findings.push({
      severity: 'high',
      title: 'No Circuit Breaker Pattern',
      description: 'Without circuit breakers, cascading failures will bring down the entire system when one dependency fails.',
      fixSuggestion: 'Implement circuit breaker (opossum library) for all external API calls and database connections.',
      category: 'Chaos Engineering',
    });
  }

  if (!hasRetry) {
    findings.push({
      severity: 'medium',
      title: 'No Retry/Backoff Logic',
      description: 'Transient failures will become permanent. Retry with exponential backoff handles temporary outages gracefully.',
      fixSuggestion: 'Add retry logic with exponential backoff (p-retry, axios-retry). Max 3 retries with jitter.',
      category: 'Chaos Engineering',
    });
  }

  // Check graceful shutdown
  const hasGracefulShutdown = allContent.includes('SIGTERM') || allContent.includes('SIGINT') ||
    allContent.includes('graceful') || allContent.includes('shutdown');
  if (!hasGracefulShutdown && techStack.length > 2) {
    findings.push({
      severity: 'high',
      title: 'No Graceful Shutdown',
      description: 'Application will drop in-flight requests on SIGTERM. Container orchestrators send SIGTERM before killing.',
      fixSuggestion: 'Listen for SIGTERM/SIGINT. Close server, drain connections, then exit. Kubernetes sends SIGTERM 30s before SIGKILL.',
      category: 'Chaos Engineering',
    });
  }

  // Check timeouts
  const hasTimeout = allContent.includes('setTimeout') || allContent.includes('timeout') ||
    allContent.includes('AbortController') || allContent.includes('abort');
  if (!hasTimeout && dependencies.length > 5) {
    findings.push({
      severity: 'medium',
      title: 'No Request Timeouts',
      description: 'Hanging requests will exhaust connection pools. Always set timeouts on external calls.',
      fixSuggestion: 'Add AbortController with timeouts to all fetch/axios calls. Set server timeout (e.g., 30s).',
      category: 'Chaos Engineering',
    });
  }

  let resilienceLevel: string;
  if (findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0) {
    resilienceLevel = 'High — Application has good fault tolerance patterns';
  } else if (findings.filter(f => f.severity === 'critical').length === 0) {
    resilienceLevel = 'Medium — Some resilience gaps. Add circuit breakers and graceful shutdown.';
  } else {
    resilienceLevel = 'Low — Critical gaps in error handling and fault tolerance.';
  }

  const score = Math.max(0, 100 -
    findings.filter(f => f.severity === 'critical').length * 30 -
    findings.filter(f => f.severity === 'high').length * 15 -
    findings.filter(f => f.severity === 'medium').length * 8
  );

  return { score, resilienceLevel, findings };
}

// ═══════════════════════════════════════════════════════════════════
// 6. MUTATION TESTING — Test quality assessment
// ═══════════════════════════════════════════════════════════════════

export interface MutationReport {
  score: number;
  estimatedMutationScore: number;
  totalMutants: number;
  killedMutants: number;
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
    d.includes('jest') || d.includes('vitest') || d.includes('mocha')
  );
  const hasMutationTool = devDependencies.some(d =>
    d.includes('stryker') || d.includes('mutant')
  );

  if (!hasTestFramework) {
    return {
      score: 0, estimatedMutationScore: 0, totalMutants: 0, killedMutants: 0,
      findings: [{
        severity: 'high', title: 'Mutation Testing Requires Tests',
        description: 'No test framework found. Mutation testing measures test quality by injecting bugs.',
        fixSuggestion: 'Set up Jest or Vitest. Write unit tests. Then run Stryker for mutation testing.',
        category: 'Mutation Testing',
      }],
    };
  }

  // Estimate mutants from code size. Each source file produces ~3 candidate
  // mutations on average, plus ~1 per 100 lines of business logic. This is
  // an order-of-magnitude approximation, not a Stryker substitute.
  const totalMutants = Math.floor(totalFiles * 3 + totalLines / 100);

  // Estimate mutation score deterministically from the test footprint we
  // can actually observe: ratio of test files to source files. We can't
  // measure real coverage without running Stryker, so we surface a coarse
  // upper bound and tell the user to run the real tool for an exact number.
  //
  // Heuristic: a project with 1 test file per 2 source files is "well-tested"
  // in this rough sense; less than that scales linearly down to a floor.
  let testFiles = 0;
  let sourceFiles = 0;
  for (const fp of Object.keys(fileContents)) {
    if (fp.includes('node_modules')) continue;
    if (/\.(test|spec)\.[jt]sx?$/.test(fp) || fp.includes('/__tests__/')) testFiles++;
    else if (/\.[jt]sx?$/.test(fp)) sourceFiles++;
  }
  const testRatio = sourceFiles > 0 ? testFiles / sourceFiles : 0;
  // Map test-ratio to an estimated mutation score band.
  //   ratio ≥ 0.5  → 75 (well-tested)
  //   ratio  0.25  → ~55
  //   ratio  0.1   → ~40
  //   ratio  0     → 25 (floor — even untyped JS catches some mutations)
  const baseScore = Math.min(75, Math.round(25 + testRatio * 100));
  // If Stryker (or similar) is configured the team is actively running
  // mutation tests, which empirically lifts effective scores ~10 points.
  const estimatedMutationScore = hasMutationTool ? Math.min(85, baseScore + 10) : baseScore;
  const killedMutants = Math.floor((totalMutants * estimatedMutationScore) / 100);

  findings.push({
    severity:
      estimatedMutationScore < 50 ? 'high' : estimatedMutationScore < 70 ? 'medium' : 'low',
    title: `Estimated Mutation Score: ~${estimatedMutationScore}% (heuristic)`,
    description:
      `Estimate from test-to-source ratio of ${testFiles}/${sourceFiles}. ` +
      `~${killedMutants}/${totalMutants} candidate mutants likely killed. ` +
      `Run Stryker for the exact number.`,
    fixSuggestion:
      estimatedMutationScore < 70
        ? 'Add tests for boundary conditions, error paths, and edge cases. Then run Stryker to confirm.'
        : 'Strong test footprint. Run Stryker to validate and push toward 80%+.',
    category: 'Mutation Testing',
  });

  if (!hasMutationTool) {
    findings.push({
      severity: 'medium',
      title: 'Mutation Testing Tool Not Configured',
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

// Supply Chain Security Audit
export interface SupplyChainReport {
  score: number;
  totalDeps: number;
  knownVulnerable: number;
  criticalVulns: number;
  findings: Finding[];
}

export function runSupplyChainAudit(dependencies: string[], devDependencies: string[]): SupplyChainReport {
  const findings: Finding[] = [];
  const allDeps = [...dependencies, ...devDependencies];
  
  // Known vulnerable patterns (simplified — in production, call OSV API)
  const vulnerablePatterns: Record<string, { cve: string; severity: string; fixVersion: string }> = {
    'lodash': { cve: 'CVE-2021-23337', severity: 'high', fixVersion: '4.17.21' },
    'express': { cve: 'CVE-2024-29041', severity: 'medium', fixVersion: '4.19.0' },
    'axios': { cve: 'CVE-2023-45857', severity: 'medium', fixVersion: '1.6.0' },
    'webpack': { cve: 'CVE-2023-28154', severity: 'high', fixVersion: '5.76.0' },
    'json5': { cve: 'CVE-2022-46175', severity: 'high', fixVersion: '2.2.2' },
    'glob-parent': { cve: 'CVE-2020-28469', severity: 'high', fixVersion: '5.1.2' },
    'semver': { cve: 'CVE-2022-25883', severity: 'medium', fixVersion: '7.5.2' },
    'node-fetch': { cve: 'CVE-2022-0235', severity: 'medium', fixVersion: '3.2.10' },
  };

  let knownVulnerable = 0;
  let criticalVulns = 0;
  
  for (const dep of allDeps) {
    const depName = dep.replace(/^[@]/, '').split('@')[0] || dep;
    for (const [vulnName, vuln] of Object.entries(vulnerablePatterns)) {
      if (depName.toLowerCase().includes(vulnName.toLowerCase())) {
        knownVulnerable++;
        if (vuln.severity === 'critical' || vuln.severity === 'high') criticalVulns++;
        findings.push({
          severity: vuln.severity as Finding['severity'],
          title: `${depName}: ${vuln.cve}`,
          description: `Known vulnerability in dependency. Update to >= ${vuln.fixVersion}.`,
          fixSuggestion: `npm install ${depName}@${vuln.fixVersion}`,
          category: 'Supply Chain',
        });
        break;
      }
    }
  }

  const score = Math.max(0, 100 - knownVulnerable * 10 - criticalVulns * 15);
  return { score, totalDeps: allDeps.length, knownVulnerable, criticalVulns, findings };
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

// License Compliance Check
export interface LicenseReport { score: number; copyleftDeps: string[]; unknownLicense: number; findings: Finding[]; }

export function runLicenseCheck(dependencies: string[]): LicenseReport {
  const findings: Finding[] = [];
  const copyleftDeps: string[] = [];
  
  // Simplified — in production, call npm registry API for license info
  const knownGPL = ['react', 'vue', 'angular', 'moment', 'underscore']; // Example GPL-adjacent
  
  for (const dep of dependencies) {
    const depName = dep.replace(/^[@]/, '').split('@')[0] || dep;
    if (knownGPL.some(g => depName.toLowerCase().includes(g.toLowerCase())) && 
        !findings.some(f => f.title.includes('License'))) {
      findings.push({
        severity: 'low',
        title: 'Verify Dependency Licenses',
        description: `${dependencies.length} dependencies — verify all licenses are compatible with your project. Check for GPL/copyleft risks.`,
        fixSuggestion: 'Run: npx license-checker --summary. Add license-check to CI. Avoid GPL dependencies in proprietary code.',
        category: 'License Compliance',
      });
      break;
    }
  }

  const score = Math.max(0, 100 - copyleftDeps.length * 20);
  return { score, copyleftDeps, unknownLicense: 0, findings };
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

// OWASP Top 10 Coverage
export interface OwaspReport { score: number; coverage: number; coveredCategories: string[]; missingCategories: string[]; findings: Finding[]; }

export function runOwaspCoverage(securityFindings: Finding[]): OwaspReport {
  const owaspMap: Record<string, string> = {
    'SQL Injection': 'A03:2021 - Injection',
    'NoSQL Injection': 'A03:2021 - Injection',
    'XSS': 'A03:2021 - Injection',
    'Hardcoded Secret': 'A07:2021 - Identification Failures',
    'Authentication': 'A07:2021 - Identification Failures',
    'CORS': 'A01:2021 - Broken Access Control',
    'Path Traversal': 'A01:2021 - Broken Access Control',
    'eval()': 'A03:2021 - Injection',
    'Rate Limiting': 'A04:2021 - Insecure Design',
    'Vulnerable Dep': 'A06:2021 - Vulnerable Components',
    'Encryption': 'A02:2021 - Cryptographic Failures',
    'Logging': 'A09:2021 - Security Logging Failures',
  };

  const allCategories = [
    'A01:2021 - Broken Access Control', 'A02:2021 - Cryptographic Failures',
    'A03:2021 - Injection', 'A04:2021 - Insecure Design', 'A05:2021 - Security Misconfiguration',
    'A06:2021 - Vulnerable Components', 'A07:2021 - Identification Failures',
    'A08:2021 - Software Integrity Failures', 'A09:2021 - Security Logging Failures',
    'A10:2021 - SSRF'
  ];

  const covered = new Set<string>();
  for (const f of securityFindings) {
    for (const [keyword, owasp] of Object.entries(owaspMap)) {
      if (f.title?.includes(keyword) || f.category?.includes(keyword)) {
        covered.add(owasp);
      }
    }
  }

  const missingCategories = allCategories.filter(c => !covered.has(c));
  const coverage = Math.round((covered.size / allCategories.length) * 100);

  const findings: Finding[] = [];
  if (missingCategories.length > 5) {
    findings.push({
      severity: 'medium',
      title: `OWASP Coverage: ${coverage}% (${covered.size}/${allCategories.length})`,
      description: `Missing: ${missingCategories.slice(0, 3).join(', ')}`,
      fixSuggestion: 'Add security rules covering remaining OWASP categories. Use OWASP ZAP for DAST scanning.',
      category: 'OWASP Coverage',
    });
  }

  return { score: coverage, coverage, coveredCategories: Array.from(covered), missingCategories, findings };
}
