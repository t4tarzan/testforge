import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseFile, isParseable } from './lib/parse.js';
import { analyzeTestFile, type TestFileQuality } from './lib/test-quality.js';
import { findPythonTestQuality, type PyTestQuality } from './lib/py-test-quality.js';
import { readRealCoverage } from './lib/coverage.js';

export interface UnitTestReport {
  testFiles: Array<{ path: string; testCount: number }>;
  totalTestFiles: number;
  totalTests: number;
  sourceFiles: Array<{ path: string; lines: number }>;
  totalSourceFiles: number;
  totalSourceLines: number;
  testedFunctions: string[];
  untestedFunctions: string[];
  testCoverage: number; // measured % when a coverage artifact exists, else heuristic estimate
  /** Whether testCoverage is from a real coverage report or the heuristic. */
  coverageSource?: 'measured' | 'estimated';
  /** The coverage artifact used (relative path), when measured. */
  coverageArtifact?: string;
  frameworks: string[];
  /** Phase 5 pass 2: AST-aware quality signals. */
  quality: {
    /** Total test cases across all files. */
    totalCases: number;
    /** Cases declared with `.skip` / `xit` / `it.todo`. */
    skippedCases: number;
    /** Cases declared with `.only` / `fit` — pollutes other-suite execution. */
    focusedCases: number;
    /** Test bodies with NO assertion calls (expect/assert/t/should/etc.). */
    assertionlessCases: number;
    /** Test bodies that are empty or contain only trivial statements. */
    emptyCases: number;
    /** Test files that import nothing from the project (testing only their framework). */
    isolatedTestFiles: number;
  };
  findings: Array<{
    severity: 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    filePath: string;
    suggestion: string;
  }>;
}

/**
 * Analyze unit test coverage of the codebase.
 * Maps test files to source files and identifies untested functions.
 */
export async function runUnitAnalysis(config: {
  projectPath: string;
  fileContents?: Record<string, string>;
}): Promise<UnitTestReport> {
  const { projectPath } = config;

  if (!existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }

  // 1. Find test files — JS/TS .{test,spec} convention PLUS pytest
  //    conventions (test_*.py, *_test.py, anything under tests/). Python
  //    test counts come from a regex (def test_…) since our AST is JS-only.
  const testPatterns = [
    '**/*.{test,spec}.{ts,js,tsx,jsx}',
    '**/test_*.py',
    '**/*_test.py',
    '**/tests/**/*.py',
    '**/*_test.go', // Go: convention is foo_test.go next to foo.go
    '!**/node_modules/**', '!**/dist/**', '!**/__pycache__/**',
    '!**/.venv/**', '!**/venv/**', '!**/.tox/**', '!**/.pytest_cache/**',
    '!**/vendor/**',
  ];
  const testFiles = await glob(testPatterns, { cwd: projectPath, absolute: false });

  // 2. Find source files (non-test). Mirrors the test glob so Python source
  //    is counted as source. Excludes any path matched as a test above so
  //    pytest files don't double-count.
  const sourcePatterns = [
    '**/*.{ts,js,tsx,jsx,py,go}',
    '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**',
    '!**/__pycache__/**', '!**/.venv/**', '!**/venv/**', '!**/vendor/**',
    '!**/*.{test,spec}.{ts,js,tsx,jsx}',
    '!**/test_*.py', '!**/*_test.py', '!**/tests/**/*.py',
    '!**/*_test.go',
  ];
  const sourceFiles = await glob(sourcePatterns, { cwd: projectPath, absolute: false });

  // 3. Parse test files (AST) to count tests and gather quality signals.
  const parsedTestFiles: Array<{ path: string; testCount: number }> = [];
  const testedFunctions = new Set<string>();
  const testFrameworks = new Set<string>();
  const fileQuality: TestFileQuality[] = [];
  // Python (pytest/unittest) quality accumulator — JS quality comes from
  // fileQuality below; Python is analyzed via its own AST pass.
  const pyQ: PyTestQuality = { total: 0, assertionless: 0, skipped: 0, empty: 0 };

  for (const tf of testFiles) {
    const fullPath = join(projectPath, tf);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      let testCount = 0;
      const isPy = tf.endsWith('.py');
      const isGo = tf.endsWith('.go');

      if (isPy) {
        // pytest/unittest: AST-classify each test_* (assertion / skip / empty),
        // not just count. Falls back to a regex count if python3 is unavailable.
        const pq = findPythonTestQuality(content);
        pyQ.total += pq.total; pyQ.assertionless += pq.assertionless;
        pyQ.skipped += pq.skipped; pyQ.empty += pq.empty;
        const re = content.match(/^\s*(?:async\s+)?def\s+(test_\w+)\s*\(/gm);
        testCount = pq.total || (re ? re.length : 0);
        testFrameworks.add('pytest');
      } else if (isGo) {
        // go test: each top-level `func Test…/Benchmark…/Example…/Fuzz…`
        // is a case. The stdlib `testing` package is the framework.
        const goTestRe = /^func\s+(?:Test|Benchmark|Example|Fuzz)\w*\s*\(/gm;
        const matches = content.match(goTestRe);
        testCount = matches ? matches.length : 0;
        if (testCount > 0) testFrameworks.add('go test');
      } else if (isParseable(tf)) {
        const parsed = parseFile(tf, content);
        if (parsed.ast) {
          const q = analyzeTestFile(tf, parsed.ast);
          fileQuality.push(q);
          testCount = q.totalCases;
          for (const fw of q.frameworks) testFrameworks.add(fw);
        }
      }

      // Fall-back regex count if parse failed (oversize / syntax error)
      // or if neither JS parse nor pytest regex produced anything.
      if (testCount === 0) testCount = countTests(content);
      parsedTestFiles.push({ path: tf, testCount });

      // Extract names of functions being tested (used for the legacy
      // tested/untested heuristic — unchanged for backward compat).
      const tested = extractTestedFunctions(content);
      for (const fn of tested) testedFunctions.add(fn.toLowerCase());
    } catch {
      // skip unreadable
    }
  }

  // 4. Parse source files to find all functions
  const parsedSourceFiles: Array<{ path: string; lines: number }> = [];
  const allFunctions = new Map<string, string>(); // functionName -> filePath

  for (const sf of sourceFiles) {
    const fullPath = join(projectPath, sf);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      parsedSourceFiles.push({ path: sf, lines });

      const functions = extractFunctionNames(content);
      for (const fn of functions) {
        // Map function to its file
        if (!allFunctions.has(fn.toLowerCase())) {
          allFunctions.set(fn.toLowerCase(), sf);
        }
      }
    } catch {
      // skip
    }
  }

  // 5. Determine untested functions
  const testedList: string[] = [];
  const untestedList: string[] = [];

  for (const [fnName, filePath] of allFunctions.entries()) {
    // Check if this function is tested (exact or partial match)
    let isTested = false;
    for (const testedFn of testedFunctions) {
      if (fnName === testedFn || testedFn.includes(fnName) || fnName.includes(testedFn)) {
        isTested = true;
        break;
      }
    }
    if (isTested) {
      testedList.push(`${fnName} (${filePath})`);
    } else {
      untestedList.push(`${fnName} (${filePath})`);
    }
  }

  // 6. Calculate estimated coverage. Two signals, take the more honest one:
  //
  //   a) Function-name matching — tests named after the functions they
  //      exercise (e.g. `it('formatDate handles UTC', ...)` ↔ source
  //      `function formatDate()`). Precise for app code where this
  //      convention holds; collapses to ~0 on library code where test
  //      descriptions don't echo function names (LangChain showed 0%
  //      despite 4,849 test cases — the heuristic just couldn't see
  //      them).
  //
  //   b) Test-to-source-file ratio — N test files / M source files,
  //      capped at 95%. Less precise but resists the library-code
  //      blind spot of (a).
  //
  // Decision rule: use (a) when it returns a meaningful signal; fall
  // back to (b) when (a) is near-zero on a project with a substantial
  // test footprint (≥10 test files AND test:source ratio ≥ 0.1).
  // Together they keep app-code precision AND give library-code an
  // honest non-zero number.
  const totalFunctions = testedList.length + untestedList.length;
  const fnMatchEstimate = totalFunctions > 0 ? Math.round((testedList.length / totalFunctions) * 100) : 0;
  const testToSourceRatio = parsedSourceFiles.length > 0
    ? Math.min(95, Math.round((parsedTestFiles.length / parsedSourceFiles.length) * 100))
    : 0;
  const fnMatchClearlyFailed = fnMatchEstimate < 10
    && parsedTestFiles.length >= 10
    && parsedTestFiles.length / Math.max(1, parsedSourceFiles.length) >= 0.1;
  const coverageEstimate = fnMatchClearlyFailed ? testToSourceRatio : fnMatchEstimate;

  // 6b. Prefer a REAL coverage report when the repo ships one (lcov / Cobertura
  // / Istanbul). Falls back to the heuristic estimate, and records which.
  const realCov = await readRealCoverage(projectPath);
  const coverage = realCov ? realCov.overallPct : coverageEstimate;
  const coverageSource: 'measured' | 'estimated' = realCov ? 'measured' : 'estimated';
  const measuredNote = realCov ? `Measured ${coverage}% (from ${realCov.source})` : `Estimated function coverage is ${coverage}%`;

  // 7. Generate findings
  const findings: UnitTestReport['findings'] = [];

  if (parsedTestFiles.length === 0) {
    findings.push({
      severity: 'high',
      title: 'No Test Files Found',
      description: `No test files detected in ${projectPath}. The project has zero test coverage.`,
      filePath: projectPath,
      suggestion: 'Set up a testing framework (Jest, Vitest, or Mocha). Write tests for critical paths first: authentication, payment processing, data validation.',
    });
  }

  if (coverage < 30 && parsedTestFiles.length > 0) {
    findings.push({
      severity: 'high',
      title: 'Low Test Coverage',
      description: `${measuredNote}. ${untestedList.length} functions appear untested.`,
      filePath: projectPath,
      suggestion: 'Add unit tests for core business logic, utility functions, and API handlers. Aim for at least 70% coverage.',
    });
  } else if (coverage < 60) {
    findings.push({
      severity: 'medium',
      title: 'Moderate Test Coverage',
      description: `${measuredNote}. ${untestedList.length} functions may lack tests.`,
      filePath: projectPath,
      suggestion: 'Increase test coverage for edge cases and error handling paths.',
    });
  }

  if (parsedSourceFiles.length > 0 && parsedTestFiles.length > 0) {
    const ratio = parsedTestFiles.length / parsedSourceFiles.length;
    if (ratio < 0.1) {
      findings.push({
        severity: 'medium',
        title: 'Low Test-to-Source Ratio',
        description: `Only ${parsedTestFiles.length} test files for ${parsedSourceFiles.length} source files (${(ratio * 100).toFixed(1)}%).`,
        filePath: projectPath,
        suggestion: 'Aim for at least 1 test file per major module or component.',
      });
    }
  }

  // AST-derived quality findings
  let totalCases = 0;
  let skippedCases = 0;
  let focusedCases = 0;
  let assertionlessCases = 0;
  let emptyCases = 0;
  let isolatedTestFiles = 0;

  // Python (pytest/unittest) AST-classified quality folds into the same counters.
  totalCases += pyQ.total;
  skippedCases += pyQ.skipped;
  emptyCases += pyQ.empty;
  assertionlessCases += pyQ.assertionless;

  for (const q of fileQuality) {
    totalCases += q.totalCases;
    if (!q.importsSourceFiles) isolatedTestFiles++;
    for (const c of q.cases) {
      if (c.kind === 'skipped') skippedCases++;
      if (c.kind === 'focused') focusedCases++;
      if (c.isEmpty) emptyCases++;
      else if (!c.hasAssertion && c.kind !== 'skipped') assertionlessCases++;
    }

    if (q.cases.some((c) => c.kind === 'focused')) {
      const focused = q.cases.filter((c) => c.kind === 'focused');
      findings.push({
        severity: 'medium',
        title: `Test focus (.only) in ${q.filePath}`,
        description: `${focused.length} focused test(s) — siblings will be silently skipped in CI: ${focused.slice(0, 3).map((c) => `"${c.title}" (line ${c.line})`).join(', ')}.`,
        filePath: q.filePath,
        suggestion: 'Remove `.only` / `fit` before merging. Add an ESLint rule (no-focused-tests) to block.',
      });
    }

    const skippedInFile = q.cases.filter((c) => c.kind === 'skipped');
    if (skippedInFile.length >= 2) {
      findings.push({
        severity: 'medium',
        title: `${skippedInFile.length} skipped tests in ${q.filePath}`,
        description: `Skipped: ${skippedInFile.slice(0, 5).map((c) => `"${c.title}" (line ${c.line})`).join(', ')}. Skipped tests rot — they stop matching their intent.`,
        filePath: q.filePath,
        suggestion: 'Delete tests that are no longer relevant. Convert `.skip` placeholders to `.todo` so they\'re tracked, or fix and unskip them.',
      });
    }

    const assertionlessInFile = q.cases.filter((c) => !c.isEmpty && !c.hasAssertion && c.kind !== 'skipped');
    if (assertionlessInFile.length > 0) {
      findings.push({
        severity: 'high',
        title: `${assertionlessInFile.length} test(s) without assertions in ${q.filePath}`,
        description: `Tests pass trivially because nothing is checked: ${assertionlessInFile.slice(0, 3).map((c) => `"${c.title}" (line ${c.line})`).join(', ')}. These inflate test count without verifying behavior.`,
        filePath: q.filePath,
        suggestion: 'Add an `expect(...)` / `assert(...)` call. If the test only runs code to confirm it doesn\'t throw, assert that explicitly with `expect(() => fn()).not.toThrow()`.',
      });
    }

    const emptyInFile = q.cases.filter((c) => c.isEmpty);
    if (emptyInFile.length > 0) {
      findings.push({
        severity: 'medium',
        title: `${emptyInFile.length} empty test bodies in ${q.filePath}`,
        description: `Empty test cases: ${emptyInFile.slice(0, 3).map((c) => `"${c.title}" (line ${c.line})`).join(', ')}.`,
        filePath: q.filePath,
        suggestion: 'Either implement the test body or convert to `it.todo("...")` so the placeholder is tracked but doesn\'t falsely contribute to coverage.',
      });
    }

    if (!q.importsSourceFiles) {
      findings.push({
        severity: 'medium',
        title: `Test file imports no source files: ${q.filePath}`,
        description: 'This test file only imports its framework — it can\'t be testing any project code.',
        filePath: q.filePath,
        suggestion: 'Add imports from the modules under test, or remove the file if it\'s a leftover scaffold.',
      });
    }
  }

  // Snapshot heuristic (kept from prior version, applied once across all files).
  const anySnapshotFile = fileQuality.find((q) => {
    const fp = join(projectPath, q.filePath);
    try {
      const c = readFileSync(fp, 'utf-8');
      return c.includes('toMatchSnapshot') && !c.includes('toMatchInlineSnapshot');
    } catch { return false; }
  });
  if (anySnapshotFile) {
    findings.push({
      severity: 'low',
      title: 'External snapshots in use',
      description: `${anySnapshotFile.filePath} (and possibly others) uses \`toMatchSnapshot\`. External snapshot files easily rot.`,
      filePath: anySnapshotFile.filePath,
      suggestion: 'Prefer `toMatchInlineSnapshot` so the expected value lives next to the test and surfaces in code review diffs.',
    });
  }

  // Check for missing error handling tests
  if (parsedTestFiles.length > 0) {
    let hasErrorTests = false;
    for (const tf of parsedTestFiles) {
      const fullPath = join(projectPath, tf.path);
      try {
        const content = readFileSync(fullPath, 'utf-8');
        if (content.includes('throw') || content.includes('reject') || content.includes('catch') || content.includes('Error')) {
          hasErrorTests = true;
          break;
        }
      } catch { /* skip */ }
    }
    if (!hasErrorTests) {
      findings.push({
        severity: 'medium',
        title: 'No Error Handling Tests',
        description: 'No tests appear to cover error/exception cases.',
        filePath: projectPath,
        suggestion: 'Add tests for error conditions: invalid inputs, missing data, network failures, authentication errors.',
      });
    }
  }

  return {
    testFiles: parsedTestFiles,
    totalTestFiles: parsedTestFiles.length,
    totalTests: parsedTestFiles.reduce((sum, f) => sum + f.testCount, 0),
    sourceFiles: parsedSourceFiles,
    totalSourceFiles: parsedSourceFiles.length,
    totalSourceLines: parsedSourceFiles.reduce((sum, f) => sum + f.lines, 0),
    testedFunctions: testedList,
    untestedFunctions: untestedList,
    testCoverage: coverage,
    coverageSource,
    coverageArtifact: realCov?.source,
    frameworks: [...testFrameworks],
    quality: {
      totalCases,
      skippedCases,
      focusedCases,
      assertionlessCases,
      emptyCases,
      isolatedTestFiles,
    },
    findings,
  };
}

/* -------------------------------------------------------------------------- */
/*                              Helpers                                       */
/* -------------------------------------------------------------------------- */

function countTests(content: string): number {
  let count = 0;

  // it('...', ...) or test('...', ...)
  const testRegex = /(?:it|test)\s*\(\s*['"`]/g;
  while (testRegex.exec(content) !== null) {
    count++;
  }

  // describe blocks (count as test suites, not individual tests)
  // We already count 'it' and 'test' which are inside describes

  return count;
}

function extractFunctionNames(content: string): string[] {
  const names: string[] = [];

  // Python: def foo(...) / async def foo(...) at any indent
  const pyRegex = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = pyRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // function foo(...)
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  while ((match = fnRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // const foo = (...) =>
  const arrowFnRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
  while ((match = arrowFnRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // foo(...) { } (methods)
  const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g;
  while ((match = methodRegex.exec(content)) !== null) {
    if (!['if', 'while', 'for', 'switch', 'catch', 'await', 'else'].includes(match[1])) {
      names.push(match[1]);
    }
  }

  return [...new Set(names)];
}

function extractTestedFunctions(content: string): string[] {
  const names: string[] = [];

  // it('should handle foo', ...) -> foo
  const itDescRegex = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match: RegExpExecArray | null;
  while ((match = itDescRegex.exec(content)) !== null) {
    const desc = match[1].toLowerCase();
    // Extract likely function names from test descriptions
    const words = desc.split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && /^[a-z][a-zA-Z0-9]*$/.test(word)) {
        names.push(word);
      }
    }
  }

  // Direct function calls in test files
  const callRegex = /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"`][^'"`]+['"`]\s*\)/g;
  while ((match = callRegex.exec(content)) !== null) {
    names.push(match[1]);
  }

  // import { foo } from './bar'
  const importRegex = /import\s*\{([^}]+)\}\s*from/g;
  while ((match = importRegex.exec(content)) !== null) {
    const imported = match[1].split(',').map(s => s.trim().split(' ')[0]);
    for (const imp of imported) {
      if (imp.length > 2) names.push(imp);
    }
  }

  return [...new Set(names)];
}
