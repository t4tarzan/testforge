// Advanced Analyzers — completing all 13 testing dimensions
// Contract, Visual Regression, Edge Case, Property-Based, Chaos, Mutation, Predictive

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
  const allContent = Object.values(fileContents).join('\n');

  // Check for OpenAPI/Swagger specs
  const hasOpenApi = Object.keys(fileContents).some(f =>
    f.includes('openapi') || f.includes('swagger') || f.endsWith('.yaml') || f.endsWith('.yml')
  );
  const hasGraphQL = dependenciesInclude(fileContents, 'graphql', 'apollo');
  const hasGrpc = dependenciesInclude(fileContents, 'grpc', 'protobuf');

  if (!hasOpenApi && !hasGraphQL && !hasGrpc && endpoints > 5) {
    findings.push({
      severity: 'high',
      title: 'No API Contract Specification',
      description: `${endpoints} endpoints detected but no OpenAPI/Swagger/GraphQL schema found. Without contracts, breaking changes go undetected.`,
      fixSuggestion: 'Add OpenAPI 3.0 spec (swagger.yaml) or GraphQL schema. Use tools like swagger-jsdoc or tsoa for auto-generation.',
      category: 'API Contracts',
    });
  }

  if (hasOpenApi) {
    // Check for versioning
    const hasVersioning = allContent.includes('/v1/') || allContent.includes('/v2/') ||
      allContent.includes('apiVersion') || allContent.includes('version');
    if (!hasVersioning && endpoints > 10) {
      findings.push({
        severity: 'medium',
        title: 'API Without Versioning Strategy',
        description: 'OpenAPI spec found but no API versioning detected. Breaking changes will affect all consumers simultaneously.',
        fixSuggestion: 'Implement URL-based versioning (/v1/, /v2/) or header-based versioning. Deprecate old versions gradually.',
        category: 'API Contracts',
      });
    }
  }

  // Check response consistency
  let inconsistentResponses = 0;
  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules')) continue;
    const hasJsonRes = content.includes('res.json(') || content.includes('response.json(') || content.includes('.json(');
    const hasSendRes = content.includes('res.send(') || content.includes('.send(');
    if (hasJsonRes && hasSendRes) inconsistentResponses++;
    // Check for undocumented endpoints (routes without comments)
    const routes = content.match(/\.(get|post|put|delete|patch)\s*\(/g);
    const comments = content.match(/\/\/|\/\*\*/g);
    if (routes && (!comments || routes.length > comments.length * 2)) {
      findings.push({
        severity: 'low',
        title: 'Undocumented API Endpoints',
        description: `Route handlers without inline documentation in ${filePath}. Contract testing requires documented endpoints.`,
        filePath,
        fixSuggestion: 'Add JSDoc comments above each route handler describing input/output contracts.',
        category: 'API Contracts',
      });
      break;
    }
  }

  if (inconsistentResponses > 0) {
    findings.push({
      severity: 'medium',
      title: 'Inconsistent Response Patterns',
      description: `${inconsistentResponses} files mix res.json() and res.send(). Consistent response format is key to API contracts.`,
      fixSuggestion: 'Standardize on res.json() for API responses. Create a shared response helper.',
      category: 'API Contracts',
    });
  }

  const score = Math.max(0, 100 - findings.reduce((s, f) =>
    s + (f.severity === 'high' ? 25 : f.severity === 'medium' ? 15 : 8), 0
  ));
  const documentedEndpoints = hasOpenApi ? endpoints : 0;

  return {
    score,
    totalEndpoints: endpoints,
    documentedEndpoints,
    undocumentedEndpoints: endpoints - documentedEndpoints,
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
  findings: Finding[];
}

export async function runPredictiveAnalysis(
  fileContents: Record<string, string>,
  dependencies: string[],
  devDependencies: string[]
): Promise<PredictiveReport> {
  const findings: Finding[] = [];
  const allContent = Object.values(fileContents).join('\n');
  let riskScore = 0;

  // Risk factor 1: Large files (more lines = more bugs statistically)
  let largeFiles = 0;
  for (const [fp, content] of Object.entries(fileContents)) {
    if (fp.includes('node_modules') || fp.includes('test')) continue;
    const lines = content.split('\n').length;
    if (lines > 300) largeFiles++;
  }
  if (largeFiles > 3) {
    riskScore += 15;
    findings.push({
      severity: 'medium',
      title: `${largeFiles} Large Files (>300 lines)`,
      description: 'Files with 300+ lines have 40% higher defect density. Consider splitting into smaller modules.',
      fixSuggestion: 'Refactor large files. Single Responsibility Principle: one file, one purpose. Target <200 lines per file.',
      category: 'Predictive',
    });
  }

  // Risk factor 2: Code churn indicators (TODO/FIXME/HACK)
  const todos = (allContent.match(/TODO|FIXME|HACK|XXX|WORKAROUND/gi) || []).length;
  if (todos > 5) {
    riskScore += 10;
    findings.push({
      severity: 'medium',
      title: `${todos} TODO/FIXME/HACK Comments`,
      description: 'Unresolved TODOs and workarounds are strong predictors of future bugs. Each one is deferred technical debt.',
      fixSuggestion: 'Create GitHub issues for each TODO. Schedule debt reduction sprints. Use eslint-plugin-todo for CI enforcement.',
      category: 'Predictive',
    });
  }

  // Risk factor 3: Deep nesting (predicts complexity bugs)
  let maxNesting = 0;
  for (const content of Object.values(fileContents)) {
    const lines = content.split('\n');
    let depth = 0;
    for (const line of lines) {
      if (line.includes('{')) depth++;
      if (line.includes('}')) depth--;
      maxNesting = Math.max(maxNesting, depth);
    }
  }
  if (maxNesting > 5) {
    riskScore += 12;
    findings.push({
      severity: 'medium',
      title: `Deep Nesting Detected (max depth: ${maxNesting})`,
      description: 'Deeply nested code (5+ levels) is exponentially harder to test and 3x more likely to contain bugs.',
      fixSuggestion: 'Use early returns (guard clauses). Extract nested logic into functions. Apply the "happy path left" pattern.',
      category: 'Predictive',
    });
  }

  // Risk factor 4: Outdated dependencies
  if (dependencies.length > 10 && !devDependencies.some(d => d.includes('renovate') || d.includes('dependabot'))) {
    riskScore += 8;
    findings.push({
      severity: 'low',
      title: 'No Automated Dependency Updates',
      description: 'Without Renovate/Dependabot, dependencies drift and accumulate security vulnerabilities over time.',
      fixSuggestion: 'Enable Dependabot or Renovate for automated dependency updates. Schedule weekly dependency reviews.',
      category: 'Predictive',
    });
  }

  // Risk factor 5: Console.log in production code
  let consoleLogs = 0;
  for (const [fp, content] of Object.entries(fileContents)) {
    if (fp.includes('test') || fp.includes('node_modules')) continue;
    consoleLogs += (content.match(/console\.(log|warn|error)/g) || []).length;
  }
  if (consoleLogs > 20) {
    riskScore += 8;
    findings.push({
      severity: 'low',
      title: `${consoleLogs} console.log Statements`,
      description: 'Console statements in production code leak data, slow execution, and indicate immature logging.',
      fixSuggestion: 'Replace console.log with structured logging (Pino/Winston). Set up log levels. Use linting to block console in CI.',
      category: 'Predictive',
    });
  }

  const score = Math.max(0, 100 - riskScore);

  // predictedFailures is now a deterministic function of riskScore: roughly
  // one expected incident per quarter for every 5 risk points. Same input →
  // same number, so two runs on identical code produce identical reports.
  // This is a heuristic, not a forecast — communicate it as such.
  const predictedFailures = Math.floor(riskScore / 5);
  let riskLevel: string;
  if (riskScore < 15) {
    riskLevel = 'Low — Codebase shows good engineering practices.';
  } else if (riskScore < 30) {
    riskLevel = 'Medium — Some risk factors present. Address TODOs and large files.';
  } else {
    riskLevel = 'High — Multiple risk factors. High probability of production incidents.';
  }

  return { score, riskLevel, predictedFailures, findings };
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

// N+1 Query Detection
export interface NPlusOneReport { score: number; potentialNPlusOne: number; findings: Finding[]; }

export function runNPlusOneDetection(fileContents: Record<string, string>): NPlusOneReport {
  const findings: Finding[] = [];
  let potentialNPlusOne = 0;

  for (const [filePath, content] of Object.entries(fileContents)) {
    if (filePath.includes('node_modules') || filePath.includes('test')) continue;
    const lines = content.split('\n');
    
    // Detect: for/while loop with DB query inside
    let inLoop = false;
    let loopDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/for\s*\(|while\s*\(|\.forEach\(|\.map\(/)) { inLoop = true; loopDepth++; }
      if (line.includes('}') && inLoop) { loopDepth--; if (loopDepth === 0) inLoop = false; }
      
      if (inLoop && (line.includes('.find(') || line.includes('.findOne(') || 
          line.includes('await db') || line.includes('sql`') || line.includes('prisma.') ||
          line.includes('mongoose.') || line.includes('sequelize.'))) {
        potentialNPlusOne++;
        if (findings.length < 5) {
          findings.push({
            severity: 'high',
            title: `Potential N+1 Query in Loop`,
            description: `Database query detected inside a loop at ${filePath}:${i+1}. This will cause N+1 queries.`,
            filePath,
            lineNumber: i + 1,
            fixSuggestion: 'Use eager loading (.include(), .populate(), JOINs) or batch queries (WHERE IN) instead of querying in a loop.',
            category: 'N+1 Query',
          });
        }
      }
    }
  }

  const score = Math.max(0, 100 - potentialNPlusOne * 15);
  return { score: Math.min(100, score), potentialNPlusOne, findings };
}

// Dead Code & Unused Dependencies
export interface DeadCodeReport { score: number; unusedDeps: string[]; deadFunctions: number; findings: Finding[]; }

export function runDeadCodeAnalysis(fileContents: Record<string, string>, dependencies: string[]): DeadCodeReport {
  const findings: Finding[] = [];
  const allContent = Object.values(fileContents).join('\n');
  const unusedDeps: string[] = [];

  // Check if each dependency is actually imported
  for (const dep of dependencies) {
    const depName = dep.replace(/^[@]/, '').split('@')[0] || dep;
    const importPattern = new RegExp(`(from\\s+['"]${depName}|require\\(['"]${depName})`, 'i');
    if (!importPattern.test(allContent)) {
      unusedDeps.push(dep);
    }
  }

  if (unusedDeps.length > 0) {
    findings.push({
      severity: 'medium',
      title: `${unusedDeps.length} Unused Dependencies`,
      description: `Dependencies not imported anywhere: ${unusedDeps.slice(0, 5).join(', ')}. These increase bundle size and attack surface.`,
      fixSuggestion: 'Remove unused dependencies with: npm uninstall ' + unusedDeps.slice(0, 3).join(' '),
      category: 'Dead Code',
    });
  }

  // Count exported but unused functions (heuristic)
  let deadFunctions = 0;
  for (const [fp, content] of Object.entries(fileContents)) {
    if (fp.includes('node_modules') || fp.includes('test')) continue;
    const exports = content.match(/export\s+(const|function|class)\s+(\w+)/g) || [];
    for (const exp of exports) {
      const name = exp.split(/\s+/)[2];
      if (name && !allContent.includes(name) && deadFunctions < 10) {
        deadFunctions++;
      }
    }
  }

  if (deadFunctions > 3) {
    findings.push({
      severity: 'low',
      title: `${deadFunctions}+ Potentially Unused Exports`,
      description: 'Functions exported but possibly never imported. Consider removing or marking as @internal.',
      fixSuggestion: 'Use TypeScript noUnusedLocals. Run eslint-plugin-unused-imports. Remove dead code to reduce bundle size.',
      category: 'Dead Code',
    });
  }

  const score = Math.max(0, 100 - unusedDeps.length * 10 - Math.floor(deadFunctions / 3) * 5);
  return { score: Math.min(100, score), unusedDeps, deadFunctions, findings };
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
