import { glob } from 'glob';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface UnitTestReport {
  testFiles: Array<{ path: string; testCount: number }>;
  totalTestFiles: number;
  totalTests: number;
  sourceFiles: Array<{ path: string; lines: number }>;
  totalSourceFiles: number;
  totalSourceLines: number;
  testedFunctions: string[];
  untestedFunctions: string[];
  testCoverage: number; // percentage estimate
  frameworks: string[];
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

  // 1. Find test files
  const testPatterns = ['**/*.{test,spec}.{ts,js,tsx,jsx}', '!**/node_modules/**', '!**/dist/**'];
  const testFiles = await glob(testPatterns, { cwd: projectPath, absolute: false });

  // 2. Find source files (non-test)
  const sourcePatterns = ['**/*.{ts,js,tsx,jsx}', '!**/node_modules/**', '!**/.git/**', '!**/dist/**', '!**/build/**', '!**/*.{test,spec}.{ts,js,tsx,jsx}'];
  const sourceFiles = await glob(sourcePatterns, { cwd: projectPath, absolute: false });

  // 3. Parse test files to count tests and identify tested functions
  const parsedTestFiles: Array<{ path: string; testCount: number }> = [];
  const testedFunctions = new Set<string>();
  const testFrameworks = new Set<string>();

  for (const tf of testFiles) {
    const fullPath = join(projectPath, tf);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const testCount = countTests(content);
      parsedTestFiles.push({ path: tf, testCount });

      // Detect test framework
      if (content.includes("from 'jest'") || content.includes('describe(')) testFrameworks.add('Jest');
      if (content.includes("from 'vitest'") || content.includes('vitest')) testFrameworks.add('Vitest');
      if (content.includes("from 'mocha'") || content.includes('mocha')) testFrameworks.add('Mocha');
      if (content.includes('ava')) testFrameworks.add('AVA');
      if (content.includes('tap') || content.includes('test(')) testFrameworks.add('Node Tap');

      // Extract names of functions being tested (heuristic)
      const tested = extractTestedFunctions(content);
      for (const fn of tested) {
        testedFunctions.add(fn.toLowerCase());
      }
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

  // 6. Calculate estimated coverage
  const totalFunctions = testedList.length + untestedList.length;
  const coverageEstimate = totalFunctions > 0 ? Math.round((testedList.length / totalFunctions) * 100) : 0;

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

  if (coverageEstimate < 30 && parsedTestFiles.length > 0) {
    findings.push({
      severity: 'high',
      title: 'Low Test Coverage',
      description: `Estimated function coverage is ${coverageEstimate}%. ${untestedList.length} functions appear untested.`,
      filePath: projectPath,
      suggestion: 'Add unit tests for core business logic, utility functions, and API handlers. Aim for at least 70% coverage.',
    });
  } else if (coverageEstimate < 60) {
    findings.push({
      severity: 'medium',
      title: 'Moderate Test Coverage',
      description: `Estimated function coverage is ${coverageEstimate}%. ${untestedList.length} functions may lack tests.`,
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

  // Check for common test anti-patterns
  for (const tf of parsedTestFiles) {
    const fullPath = join(projectPath, tf.path);
    try {
      const content = readFileSync(fullPath, 'utf-8');

      if (content.includes('.only(')) {
        findings.push({
          severity: 'medium',
          title: 'Test Focus (only) Found',
          description: `Test file ${tf.path} contains .only() which skips other tests.`,
          filePath: tf.path,
          suggestion: 'Remove .only() before committing. Consider using a lint rule to block it.',
        });
      }

      if (content.includes('console.log') || content.includes('console.error')) {
        findings.push({
          severity: 'low',
          title: 'Console Output in Tests',
          description: `Test file ${tf.path} contains console statements.`,
          filePath: tf.path,
          suggestion: 'Remove console.log from tests. Use proper assertion messages instead.',
        });
      }

      // Check for snapshot tests without updates
      if (content.includes('toMatchSnapshot') && !content.includes('toMatchInlineSnapshot')) {
        findings.push({
          severity: 'low',
          title: 'External Snapshots Used',
          description: 'External snapshot files can become outdated. Inline snapshots are easier to review.',
          filePath: tf.path,
          suggestion: 'Consider using toMatchInlineSnapshot for better code review visibility.',
        });
      }
    } catch {
      // skip
    }
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
    testCoverage: coverageEstimate,
    frameworks: [...testFrameworks],
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

  // function foo(...)
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let match: RegExpExecArray | null;
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
