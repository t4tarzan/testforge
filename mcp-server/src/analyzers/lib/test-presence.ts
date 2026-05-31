/**
 * Detect whether a repo has test files — language-agnostic and workspace-aware.
 *
 * The signal is "are there test files?", NOT "is jest/vitest in the ROOT
 * package.json devDeps." A monorepo whose test framework lives in a top-level
 * sibling or workspace member is otherwise mis-graded as having no tests:
 * TestForge's own `mcp-server/` has vitest + 365 tests, but the root
 * package.json declares no test framework and isn't a discovered workspace
 * member (no `workspaces` field, and `mcp-server/` isn't under a conventional
 * monorepo dir). The unit analyzer scans test files directly and saw the tests;
 * the stack + DORA analyzers checked only merged root/workspace devDeps and
 * cried "no testing framework — cannot verify code correctness." Contradiction.
 *
 * This mirrors the same fix already made in the mutation analyzer
 * (advanced-analyzer.ts) — patterns kept identical so the three analyzers agree
 * on what counts as a test file.
 */
/**
 * True if a single path is a test file. Use this instead of the naive
 * `path.includes('test')` substring check, which wrongly skips real source
 * files like `generate-tests.ts` or `test-runner.ts` (that bug hid a `zod`
 * import from the dead-code analyzer, flagging zod as unused).
 */
export function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.[jt]sx?$/.test(filePath)
    || filePath.includes('/__tests__/')
    || /(?:^|\/)test_[^/]+\.py$/.test(filePath)
    || /_test\.py$/.test(filePath)
    || /_test\.go$/.test(filePath)
  );
}

export function hasTestFiles(fileContents: Record<string, string>): boolean {
  return Object.keys(fileContents).some((fp) => !fp.includes('node_modules') && isTestFile(fp));
}
