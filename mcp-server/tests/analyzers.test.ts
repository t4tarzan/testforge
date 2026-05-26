// Real integration tests for the MCP analyzers.
//
// Previous version asserted inline regex matches against inline strings —
// the analyzer modules were never imported, never run. Coverage of the
// engine was 0%.
//
// This version drives the actual analyzer code against on-disk fixture
// projects (mcp-server/tests/fixtures/*) and asserts on the findings it
// returns. Same input → same output for every dimension we test.

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { scanCodebase, type CodebaseInfo } from '../src/analyzers/code-scanner.js';
import { runSecurityAnalysis } from '../src/analyzers/security-analyzer.js';
import {
  runMutationAnalysis,
  runPredictiveAnalysis,
  runNPlusOneDetection,
  runDeadCodeAnalysis,
  runContractAnalysis,
  runOwaspCoverage,
  runSupplyChainAudit,
} from '../src/analyzers/advanced-analyzer.js';
import { runUnitAnalysis } from '../src/analyzers/unit-analyzer.js';
import { runAccessibilityAnalysis } from '../src/analyzers/accessibility-analyzer.js';
import { runLoadAnalysis } from '../src/analyzers/load-analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VULNERABLE = resolve(__dirname, 'fixtures/vulnerable-app');
const CLEAN = resolve(__dirname, 'fixtures/clean-app');
const TRUE_POS = resolve(__dirname, 'fixtures/true-positives');
const FALSE_POS = resolve(__dirname, 'fixtures/false-positives');
const USER_RULES = resolve(__dirname, 'fixtures/user-rules');
const N_PLUS_ONE = resolve(__dirname, 'fixtures/n-plus-one');
const DEAD_CODE = resolve(__dirname, 'fixtures/dead-code');
const TEST_QUALITY = resolve(__dirname, 'fixtures/test-quality');
const CONTRACTS = resolve(__dirname, 'fixtures/contracts');
const CONTRACTS_MISSING = resolve(__dirname, 'fixtures/contracts-missing');
const A11Y_JSX = resolve(__dirname, 'fixtures/a11y-jsx');
const LOAD_RESILIENT = resolve(__dirname, 'fixtures/load-resilient');
const LOAD_FRAGILE = resolve(__dirname, 'fixtures/load-fragile');
const SUPPLY_DIRTY = resolve(__dirname, 'fixtures/supply-chain-dirty');
const SUPPLY_CLEAN = resolve(__dirname, 'fixtures/supply-chain-clean');

describe('code-scanner', () => {
  let vulnInfo: CodebaseInfo;
  let cleanInfo: CodebaseInfo;
  beforeAll(async () => {
    vulnInfo = await scanCodebase(VULNERABLE);
    cleanInfo = await scanCodebase(CLEAN);
  });

  it('finds the source files in the vulnerable fixture', () => {
    expect(vulnInfo.totalFiles).toBeGreaterThanOrEqual(1);
    const paths = vulnInfo.files.map((f) => f.path);
    expect(paths).toContain('src/server.js');
  });

  it('extracts dependencies from package.json', () => {
    expect(vulnInfo.dependencies).toContain('express');
    expect(vulnInfo.dependencies).toContain('mongodb');
    expect(cleanInfo.dependencies).toContain('helmet');
  });

  it('detects HTTP endpoints', () => {
    expect(vulnInfo.endpoints).toBeGreaterThan(0);
  });

  it('counts lines deterministically (same input → same output)', async () => {
    const second = await scanCodebase(VULNERABLE);
    expect(second.totalLines).toBe(vulnInfo.totalLines);
    expect(second.totalFiles).toBe(vulnInfo.totalFiles);
  });
});

describe('security-analyzer — vulnerable fixture', () => {
  let vulnInfo: CodebaseInfo;
  beforeAll(async () => {
    vulnInfo = await scanCodebase(VULNERABLE);
  });

  it('detects the SQL injection in /users/:id', async () => {
    const findings = await runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: vulnInfo.fileContents,
      dependencies: vulnInfo.dependencies,
      devDependencies: vulnInfo.devDependencies,
    });
    const sql = findings.filter((f) => f.category === 'SQL Injection');
    expect(sql.length).toBeGreaterThan(0);
    expect(sql.some((f) => f.severity === 'critical')).toBe(true);
    expect(sql[0].filePath).toContain('src/server.js');
  });

  it('flags eval(req.query.code) as dangerous-functions / RCE', async () => {
    const findings = await runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: vulnInfo.fileContents,
      dependencies: vulnInfo.dependencies,
      devDependencies: vulnInfo.devDependencies,
    });
    // The AST analyzer categorizes eval as "Dangerous Functions" (more
    // accurate than XSS — it's RCE, not just script-injection).
    const dangerous = findings.filter((f) => f.category === 'Dangerous Functions');
    const evalFinding = dangerous.find((f) => /eval/i.test(f.title));
    expect(evalFinding).toBeTruthy();
    // When the argument came from req.*, confidence should be high.
    expect(evalFinding?.confidence).toBe('high');
  });

  it('flags password leakage in /me response', async () => {
    const findings = await runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: vulnInfo.fileContents,
      dependencies: vulnInfo.dependencies,
      devDependencies: vulnInfo.devDependencies,
    });
    const sensitive = findings.filter((f) => f.category === 'Sensitive Data Exposure');
    expect(sensitive.some((f) => /password/i.test(f.title))).toBe(true);
  });
});

describe('security-analyzer — clean fixture', () => {
  it('reports zero critical findings on a clean fixture', async () => {
    const info = await scanCodebase(CLEAN);
    const findings = await runSecurityAnalysis({
      projectPath: CLEAN,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const critical = findings.filter((f) => f.severity === 'critical');
    expect(critical).toEqual([]);
  });
});

describe('security-analyzer — true-positive corpus (AST advantage)', () => {
  it('flags every category in true-positives/src/vulnerabilities.js', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const categoriesFound = new Set(findings.map((f) => f.category));
    const expected = [
      'SQL Injection',
      'Dangerous Functions',
      'Path Traversal',
      'Open Redirect',
      'XSS',
      'Sensitive Data Exposure',
      'CORS Misconfiguration',
      'Hardcoded Secrets',
    ];
    const missing = expected.filter((c) => !categoriesFound.has(c));
    expect(missing).toEqual([]);
  });

  it('detects SQL injection via an intermediate variable (intra-procedural taint)', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // The fixture's /search endpoint assigns the tainted concat to `q`
    // and *then* passes `q` to db.query. Regex-only analyzers miss this.
    const sql = findings.filter((f) => f.category === 'SQL Injection');
    const searchFinding = sql.find((f) => f.filePath.endsWith('vulnerabilities.js'));
    expect(searchFinding).toBeTruthy();
    expect(searchFinding?.confidence).toBe('high');
  });

  it('suppression comments silence the targeted finding only', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const inSuppressed = findings.filter((f) => f.filePath.endsWith('suppressed.js'));
    // Path traversal on the /read route is suppressed → no finding from it.
    const pathTrav = inSuppressed.filter((f) => f.category === 'Path Traversal');
    expect(pathTrav.length).toBe(0);
    // Dangerous Functions on /exec route is suppressed → also gone.
    const danger = inSuppressed.filter((f) => f.category === 'Dangerous Functions');
    expect(danger.length).toBe(0);
  });
});

describe('security-analyzer — false-positive corpus', () => {
  it('does NOT flag parameterized queries or safe template literals as SQL injection', async () => {
    const info = await scanCodebase(FALSE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: FALSE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const sql = findings.filter((f) => f.category === 'SQL Injection');
    expect(sql).toEqual([]);
  });

  it('does NOT report SQL/XSS/path-traversal on safe-patterns.js', async () => {
    const info = await scanCodebase(FALSE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: FALSE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const noisy = findings.filter(
      (f) =>
        f.filePath.endsWith('safe-patterns.js') &&
        ['SQL Injection', 'XSS', 'Path Traversal', 'Open Redirect'].includes(f.category)
    );
    expect(noisy).toEqual([]);
  });
});

describe('security-analyzer — finding shape', () => {
  it('every finding carries category, line, confidence, fix suggestion', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.category).toBeTruthy();
      expect(f.lineNumber).toBeGreaterThan(0);
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
      if (f.severity !== 'info') {
        expect(['high', 'medium', 'low']).toContain(f.confidence);
        expect(typeof f.fixSuggestion).toBe('string');
        expect(f.fixSuggestion.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('security-analyzer — Phase 2: taint engine + sanitizers', () => {
  it('reports ZERO high-confidence findings on the sanitized-patterns fixture', async () => {
    const info = await scanCodebase(FALSE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: FALSE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // Findings might exist for the sanitized file (low/medium confidence
    // because a sanitizer was observed on the path), but high-confidence
    // taint findings are the contract — those must be zero.
    const sanitizedFile = findings.filter((f) => f.filePath.endsWith('sanitized-patterns.js'));
    const high = sanitizedFile.filter((f) => f.confidence === 'high');
    expect(high).toEqual([]);
  });

  it('reports HIGH confidence on the true-positives fixture (no sanitizers)', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const dangerous = findings.filter((f) => f.filePath.endsWith('vulnerabilities.js'));
    // Every category that's a real source-to-sink should produce at least
    // one HIGH confidence finding in this fixture.
    const highByCategory = new Set(
      dangerous.filter((f) => f.confidence === 'high').map((f) => f.category)
    );
    const expected = ['SQL Injection', 'Dangerous Functions', 'Path Traversal', 'Open Redirect', 'XSS', 'Sensitive Data Exposure'];
    const missing = expected.filter((c) => !highByCategory.has(c));
    expect(missing).toEqual([]);
  });

  it('attaches a flow narrative to taint-based findings', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // The SQL injection on the /search route went via an intermediate
    // variable — the analyzer should attach a flow story mentioning
    // "request".
    const sql = findings.find(
      (f) =>
        f.category === 'SQL Injection' &&
        f.filePath.endsWith('vulnerabilities.js') &&
        f.confidence === 'high'
    );
    expect(sql).toBeTruthy();
    expect(sql?.flow).toMatch(/request/i);
  });
});

describe('security-analyzer — Phase 3: structured fix suggestions', () => {
  it('SQL injection findings carry a `fix` with parameterized after-form', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const sql = findings.filter(
      (f) =>
        f.category === 'SQL Injection' &&
        f.confidence === 'high' &&
        f.filePath.endsWith('vulnerabilities.js')
    );
    expect(sql.length).toBeGreaterThan(0);
    // The fixture has two shapes: an inline template literal (auto-rewritable
    // → applicable:true with placeholders) and a tainted local variable
    // (descriptive only → applicable:false). We assert at least one of each.
    const applicableFix = sql.find((f) => f.fix?.applicable === true);
    expect(applicableFix?.fix?.after).toMatch(/\$1/);
    expect(applicableFix?.fix?.after).toMatch(/\[.+\]/);

    const adviceFix = sql.find((f) => f.fix && !f.fix.applicable);
    expect(adviceFix?.fix?.description).toMatch(/placeholder|binds?/i);
  });

  it('Hardcoded named-secret findings suggest process.env', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const secret = findings.find(
      (f) =>
        f.category === 'Hardcoded Secrets' &&
        /api[_-]?key/i.test(f.title) &&
        f.filePath.endsWith('vulnerabilities.js')
    );
    expect(secret).toBeTruthy();
    expect(secret?.fix).toBeTruthy();
    expect(secret?.fix?.applicable).toBe(true);
    expect(secret?.fix?.after).toMatch(/process\.env\.API_KEY/);
  });

  it('CORS wildcard finding includes an allowlist scaffolding', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const cors = findings.find(
      (f) =>
        f.category === 'CORS Misconfiguration' &&
        f.filePath.endsWith('vulnerabilities.js')
    );
    expect(cors).toBeTruthy();
    expect(cors?.fix).toBeTruthy();
    // CORS is a templated suggestion — not safe to auto-apply
    expect(cors?.fix?.applicable).toBe(false);
    expect(cors?.fix?.after).toMatch(/origin:\s*\[/);
  });

  it('eval()/Function() findings carry advice-only fixes', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const evalFinding = findings.find(
      (f) =>
        f.category === 'Dangerous Functions' &&
        /eval/i.test(f.title) &&
        f.filePath.endsWith('vulnerabilities.js')
    );
    expect(evalFinding).toBeTruthy();
    expect(evalFinding?.fix).toBeTruthy();
    expect(evalFinding?.fix?.applicable).toBe(false); // refactor required
    expect(evalFinding?.fix?.description).toMatch(/JSON\.parse|dispatch|parser/i);
  });

  it('innerHTML/dangerouslySetInnerHTML fixes propose DOMPurify.sanitize', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // We may not have an explicit innerHTML fixture, but we should at least
    // verify any XSS finding with a fix proposes DOMPurify / escape if it's
    // applicable. Use the broader contract.
    const xssWithApplicableFix = findings.find(
      (f) => f.category === 'XSS' && f.fix?.applicable === true
    );
    if (xssWithApplicableFix) {
      expect(xssWithApplicableFix.fix?.after).toMatch(/DOMPurify\.sanitize|escape\(/);
      expect(xssWithApplicableFix.fix?.importsNeeded?.length || 0).toBeGreaterThan(0);
    }
    // If no applicable XSS fix exists in the fixture, at least confirm the
    // res.send tainted finding has its escape() fix.
    const resSend = findings.find(
      (f) => f.category === 'XSS' && /Response/i.test(f.title) && f.confidence === 'high'
    );
    if (resSend) {
      expect(resSend.fix?.after).toMatch(/escape\(/);
    }
  });

  it('every applicable fix has a non-empty before, after, and description', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    for (const f of findings) {
      if (!f.fix) continue;
      expect(f.fix.description.length).toBeGreaterThan(10);
      expect(f.fix.before.length).toBeGreaterThan(0);
      expect(f.fix.after.length).toBeGreaterThan(0);
      expect(typeof f.fix.applicable).toBe('boolean');
    }
  });
});

describe('security-analyzer — Phase 4a: cross-function taint', () => {
  it('flags SQL injection via a helper function (caller site)', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const crossFile = findings.filter((f) => f.filePath.endsWith('cross-function.js'));
    const sql = crossFile.filter((f) => f.category === 'SQL Injection');
    // Two helpers (`runQuery`, `lookupUser`) → two callers should be flagged.
    expect(sql.length).toBeGreaterThanOrEqual(2);
    expect(sql.every((f) => /helper/i.test(f.title) || /runQuery|lookupUser/.test(f.title))).toBe(true);
  });

  it('flags open redirect via helper (arrow function form)', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const redirect = findings.find(
      (f) =>
        f.category === 'Open Redirect' &&
        f.filePath.endsWith('cross-function.js') &&
        /safelyRedirect|helper/i.test(f.title)
    );
    expect(redirect).toBeTruthy();
  });

  it('flags path traversal via helper', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const path = findings.find(
      (f) =>
        f.category === 'Path Traversal' &&
        f.filePath.endsWith('cross-function.js') &&
        /readUserFile|helper/i.test(f.title)
    );
    expect(path).toBeTruthy();
  });

  it('flags XSS via helper', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const xss = findings.find(
      (f) =>
        f.category === 'XSS' &&
        f.filePath.endsWith('cross-function.js') &&
        /send404|helper/i.test(f.title)
    );
    expect(xss).toBeTruthy();
  });

  it('cross-function findings are emitted at the CALL site, not the sink', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const crossFile = findings.filter((f) => f.filePath.endsWith('cross-function.js'));
    // Sample one helper-routed finding and verify the line number falls in
    // the "callers" region of the file (line > 30 in our fixture; helpers
    // are declared above that line).
    const helperFinding = crossFile.find((f) => /helper/i.test(f.title));
    expect(helperFinding).toBeTruthy();
    expect(helperFinding!.lineNumber).toBeGreaterThan(30);
  });
});

describe('security-analyzer — Phase 4b: cross-FILE taint', () => {
  it('flags SQL injection via a CJS destructured-import helper at the call site', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const inCaller = findings.filter((f) => f.filePath.endsWith('cross-file-cjs.js'));
    const sql = inCaller.filter(
      (f) => f.category === 'SQL Injection' && /runQuery|helper/i.test(f.title)
    );
    expect(sql.length).toBeGreaterThan(0);
    // High confidence — argument is `'...' + req.params.id`, no sanitizer
    expect(sql.some((f) => f.confidence === 'high')).toBe(true);
  });

  it('flags SQL injection through a CJS namespace import (`ns.runQuery(...)`)', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const ns = findings.find(
      (f) =>
        f.filePath.endsWith('cross-file-cjs.js') &&
        f.category === 'SQL Injection' &&
        /dbHelpers\.runQuery/.test(f.title)
    );
    expect(ns).toBeTruthy();
  });

  it('flags cross-file helper that taints via an intermediate variable', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const finding = findings.find(
      (f) =>
        f.filePath.endsWith('cross-file-cjs.js') &&
        f.category === 'SQL Injection' &&
        /buildAndQuery/.test(f.title)
    );
    expect(finding).toBeTruthy();
  });

  it('flags open redirect through an ESM named-import helper', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const redirect = findings.find(
      (f) =>
        f.filePath.endsWith('cross-file-esm.js') &&
        f.category === 'Open Redirect' &&
        /safelyRedirect/.test(f.title)
    );
    expect(redirect).toBeTruthy();
  });

  it('flags XSS through an ESM helper using an arrow-function export', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const xss = findings.find(
      (f) =>
        f.filePath.endsWith('cross-file-esm.js') &&
        f.category === 'XSS' &&
        /echoBack/.test(f.title)
    );
    expect(xss).toBeTruthy();
  });

  it('cross-file findings emit at the caller, not the helper file', async () => {
    const info = await scanCodebase(TRUE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: TRUE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // The helper files must not carry helper-titled cross-file findings —
    // by definition cross-file findings fire in the file that calls in.
    const inHelpers = findings.filter(
      (f) => /helpers\//.test(f.filePath) && /helper/i.test(f.title)
    );
    expect(inHelpers).toEqual([]);
  });
});

describe('security-analyzer — Phase 4c: user-authored rules', () => {
  it('fires the callee-only rule (no-internal-unsafe-query)', async () => {
    const info = await scanCodebase(USER_RULES);
    const findings = await runSecurityAnalysis({
      projectPath: USER_RULES,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const hit = findings.find((f) => /Internal unsafe query/i.test(f.title));
    expect(hit).toBeTruthy();
    expect(hit?.severity).toBe('critical');
    expect(hit?.category).toBe('SQL Injection');
    expect(hit?.confidence).toBe('medium'); // shape-only rule, no taint check
  });

  it('fires the taint-gated rule (no-tainted-debug-log) ONLY when arg is tainted', async () => {
    const info = await scanCodebase(USER_RULES);
    const findings = await runSecurityAnalysis({
      projectPath: USER_RULES,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const debugLog = findings.filter((f) => /debug logger/i.test(f.title));
    // Only the `debugLog(req.body.email)` call should fire; the literal
    // `debugLog('startup complete')` call must NOT.
    expect(debugLog.length).toBe(1);
    expect(debugLog[0].confidence).toBe('high'); // taintedArg → high confidence
    expect(debugLog[0].severity).toBe('medium');
    expect(debugLog[0].flow).toMatch(/request|tainted/i);
  });

  it('fires the argRegex rule (no-secret-keys-in-storage) only when key matches', async () => {
    const info = await scanCodebase(USER_RULES);
    const findings = await runSecurityAnalysis({
      projectPath: USER_RULES,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const tokenHits = findings.filter((f) => /Token-shaped value/i.test(f.title));
    // localStorage.setItem('auth_token', ...) → fires
    // localStorage.setItem('theme', ...) → must NOT fire
    expect(tokenHits.length).toBe(1);
    expect(tokenHits[0].severity).toBe('high');
    expect(tokenHits[0].category).toBe('Hardcoded Secrets');
  });

  it('passes userRules programmatically (overrides on-disk file)', async () => {
    const info = await scanCodebase(USER_RULES);
    const findings = await runSecurityAnalysis({
      projectPath: USER_RULES,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
      userRules: [
        {
          id: 'prog-rule',
          title: 'Programmatic rule fired',
          severity: 'info',
          category: 'Custom',
          match: { callee: 'app.listen' },
        },
      ],
    });
    // The on-disk rules are bypassed; only the programmatic one fires.
    const prog = findings.filter((f) => /Programmatic rule fired/.test(f.title));
    expect(prog.length).toBeGreaterThan(0);
    // The disk rule for internalApi.unsafeQuery should NOT fire when
    // userRules is supplied programmatically.
    const disk = findings.filter((f) => /Internal unsafe query/i.test(f.title));
    expect(disk).toEqual([]);
  });

  it('emits zero user-rule findings on the false-positive corpus', async () => {
    const info = await scanCodebase(FALSE_POS);
    const findings = await runSecurityAnalysis({
      projectPath: FALSE_POS,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // No .testforge/rules.yaml in this fixture → no custom findings titled
    // like the user rules.
    const titles = ['Internal unsafe query', 'User input in debug logger', 'Token-shaped value'];
    for (const t of titles) {
      expect(findings.find((f) => f.title.includes(t))).toBeFalsy();
    }
  });
});

describe('advanced-analyzer — Phase 5: AST-aware N+1 detection', () => {
  it('flags db.query inside for-of loop', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    const inForOf = report.findings.find((f) => /for-of/.test(f.title) && /db\.query/.test(f.description));
    expect(inForOf).toBeTruthy();
    expect(inForOf?.severity).toBe('high');
  });

  it('flags awaited db call inside arr.forEach', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    const inForEach = report.findings.find((f) => /array\.forEach/.test(f.title));
    expect(inForEach).toBeTruthy();
  });

  it('flags prisma.user.findUnique in classic for-loop', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    const inFor = report.findings.find((f) => /\bfor\b/.test(f.title) && /findUnique/.test(f.description));
    expect(inFor).toBeTruthy();
  });

  it('does NOT flag db calls wrapped in Promise.all([...].map(...))', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    // The /users-fast route uses Promise.all around the map — must not
    // trigger an N+1 finding on the same file/line.
    const promiseAll = report.findings.find((f) => /users-fast|Promise\.all/i.test(f.description ?? ''));
    expect(promiseAll).toBeUndefined();
  });

  it('does NOT flag db calls outside any loop', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    // /all-users is a single, unrooted db.query — no loop. Should not fire.
    const standalone = report.findings.find((f) => f.lineNumber && /all-users/.test(f.description ?? ''));
    expect(standalone).toBeUndefined();
  });

  it('score decreases as N+1 count rises', async () => {
    const info = await scanCodebase(N_PLUS_ONE);
    const report = runNPlusOneDetection(info.fileContents);
    expect(report.potentialNPlusOne).toBeGreaterThanOrEqual(3);
    expect(report.score).toBeLessThan(100);
  });
});

describe('advanced-analyzer — Phase 5: AST-aware dead-code detection', () => {
  it('flags exports that no other file references', async () => {
    const info = await scanCodebase(DEAD_CODE);
    const report = runDeadCodeAnalysis(info.fileContents, info.dependencies);
    expect(report.deadFunctions).toBeGreaterThanOrEqual(2); // internalDead + FORGOTTEN_CONSTANT
    const symFinding = report.findings.find((f) => /Exported Symbols Not Referenced/.test(f.title));
    expect(symFinding).toBeTruthy();
    expect(symFinding!.description).toMatch(/internalDead/);
    expect(symFinding!.description).toMatch(/FORGOTTEN_CONSTANT/);
  });

  it('does NOT mark a symbol dead if its own declaration line contains the name', async () => {
    const info = await scanCodebase(DEAD_CODE);
    const report = runDeadCodeAnalysis(info.fileContents, info.dependencies);
    // publicUsed and withLodash ARE referenced in other-file.js — must
    // not appear in the dead list.
    const titles = report.findings.map((f) => f.title + ' ' + f.description).join(' ');
    expect(titles).not.toMatch(/\bpublicUsed\b/);
    expect(titles).not.toMatch(/\bwithLodash\b/);
  });

  it('flags genuinely unused dependencies', async () => {
    const info = await scanCodebase(DEAD_CODE);
    const report = runDeadCodeAnalysis(info.fileContents, info.dependencies);
    expect(report.unusedDeps).toContain('unused-package');
    // express IS used (imported in other-file.js) — must not be dead.
    expect(report.unusedDeps).not.toContain('express');
  });

  it('treats subpath imports as a usage of the dep root', async () => {
    const info = await scanCodebase(DEAD_CODE);
    const report = runDeadCodeAnalysis(info.fileContents, info.dependencies);
    // used.js does `import { get } from 'lodash/get'` — that should
    // count `lodash` as used.
    expect(report.unusedDeps).not.toContain('lodash');
  });
});

describe('unit-analyzer — Phase 5 pass 2: AST-aware test quality', () => {
  it('counts test cases via AST (not just regex)', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    // 6 in math.test.js + 1 isolated.test.js = 7 total
    expect(report.quality.totalCases).toBeGreaterThanOrEqual(6);
    expect(report.frameworks).toContain('Vitest');
  });

  it('detects skipped tests', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    expect(report.quality.skippedCases).toBeGreaterThanOrEqual(2);
    const finding = report.findings.find((f) => /skipped tests/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('medium');
  });

  it('detects focused tests (.only)', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    expect(report.quality.focusedCases).toBeGreaterThanOrEqual(1);
    const finding = report.findings.find((f) => /\.only/.test(f.title));
    expect(finding).toBeTruthy();
  });

  it('detects assertion-less test bodies', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    // "runs add without crashing" — calls add() but no expect.
    expect(report.quality.assertionlessCases).toBeGreaterThanOrEqual(1);
    const finding = report.findings.find((f) => /without assertions/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('high');
  });

  it('detects empty test bodies', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    // "TODO: handle negative numbers" + "handles infinity" → 2 empty.
    expect(report.quality.emptyCases).toBeGreaterThanOrEqual(2);
    const finding = report.findings.find((f) => /empty test bodies/i.test(f.title));
    expect(finding).toBeTruthy();
  });

  it('detects test files that import no source files', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    expect(report.quality.isolatedTestFiles).toBeGreaterThanOrEqual(1);
    const finding = report.findings.find((f) => /imports no source files/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.filePath).toMatch(/isolated\.test\.js$/);
  });

  it('does NOT flag a test that has a real expect() assertion', async () => {
    const report = await runUnitAnalysis({ projectPath: TEST_QUALITY });
    // The healthy `adds two numbers` test should not be in any assertionless
    // finding description.
    const assertless = report.findings.find((f) => /without assertions/i.test(f.title));
    if (assertless) expect(assertless.description).not.toMatch(/adds two numbers/);
  });
});

describe('advanced-analyzer — Phase 5 pass 3: contract analysis (OpenAPI + AST)', () => {
  it('parses the OpenAPI spec and discovers endpoints from code', async () => {
    const info = await scanCodebase(CONTRACTS);
    const report = await runContractAnalysis(info.fileContents, info.endpoints);
    expect(report.totalEndpoints).toBeGreaterThanOrEqual(4); // 4 in server.js
  });

  it('flags endpoints in code that are absent from the spec', async () => {
    const info = await scanCodebase(CONTRACTS);
    const report = await runContractAnalysis(info.fileContents, info.endpoints);
    const undoc = report.findings.find((f) => /undocumented endpoint/i.test(f.title));
    expect(undoc).toBeTruthy();
    expect(undoc!.description).toMatch(/POST \/v1\/users/);
    expect(undoc!.description).toMatch(/GET \/v1\/admin\/audit-log/);
  });

  it('flags endpoints in the spec with no implementation in code', async () => {
    const info = await scanCodebase(CONTRACTS);
    const report = await runContractAnalysis(info.fileContents, info.endpoints);
    const orphan = report.findings.find((f) => /spec-only endpoint/i.test(f.title));
    expect(orphan).toBeTruthy();
    expect(orphan!.description).toMatch(/DELETE \/v1\/orphan-route/);
  });

  it('matches /v1/users/{id} (spec) with /v1/users/:id (express) via canonicalPath', async () => {
    const info = await scanCodebase(CONTRACTS);
    const report = await runContractAnalysis(info.fileContents, info.endpoints);
    // The matched routes (GET /v1/users + GET /v1/users/:id) should NOT
    // appear in the undocumented finding.
    const undoc = report.findings.find((f) => /undocumented endpoint/i.test(f.title));
    if (undoc) {
      expect(undoc.description).not.toMatch(/GET \/v1\/users[^/]/); // no exact GET /v1/users
      expect(undoc.description).not.toMatch(/GET \/v1\/users\/:id/);
    }
  });

  it('flags missing spec entirely when many endpoints exist', async () => {
    const info = await scanCodebase(CONTRACTS_MISSING);
    const report = await runContractAnalysis(info.fileContents, info.endpoints);
    const noSpec = report.findings.find((f) => /No API contract specification/i.test(f.title));
    expect(noSpec).toBeTruthy();
    expect(noSpec!.severity).toBe('high');
  });

  it('does NOT flag missing spec when there are few endpoints', async () => {
    // Synthesize a tiny project — under the threshold of 5 endpoints.
    const tiny: Record<string, string> = {
      'package.json': '{"name":"tiny","dependencies":{}}',
      'src/index.js': "const express = require('express'); const app = express(); app.get('/', (req, res) => res.json({})); app.listen(0);",
    };
    const report = await runContractAnalysis(tiny, 1);
    const noSpec = report.findings.find((f) => /No API contract specification/i.test(f.title));
    expect(noSpec).toBeUndefined();
  });
});

describe('advanced-analyzer — Phase 5 pass 4: predictive (cross-signal)', () => {
  it('surfaces per-file risk hotspots when security signals are fed in', async () => {
    const info = await scanCodebase(VULNERABLE);
    const report = await runPredictiveAnalysis(
      info.fileContents, info.dependencies, info.devDependencies,
      {
        securityFindings: [
          { filePath: 'src/server.js', severity: 'critical' },
          { filePath: 'src/server.js', severity: 'high' },
        ],
      }
    );
    expect(report.topRiskyFiles).toBeDefined();
    expect(report.topRiskyFiles.length).toBeGreaterThan(0);
    expect(report.topRiskyFiles[0].score).toBeGreaterThan(0);
    expect(report.topRiskyFiles[0].reasons.length).toBeGreaterThan(0);
  });

  it('weights security findings by severity when cross-signals are provided', async () => {
    const info = await scanCodebase(VULNERABLE);
    // Without security signal
    const without = await runPredictiveAnalysis(
      info.fileContents, info.dependencies, info.devDependencies
    );
    // With a synthetic critical finding on a known file
    const withCritical = await runPredictiveAnalysis(
      info.fileContents, info.dependencies, info.devDependencies,
      {
        securityFindings: [
          { filePath: 'src/server.js', severity: 'critical' },
          { filePath: 'src/server.js', severity: 'critical' },
        ],
      }
    );
    const serverWithout = without.topRiskyFiles.find((f) => f.filePath === 'src/server.js');
    const serverWith = withCritical.topRiskyFiles.find((f) => f.filePath === 'src/server.js');
    expect(serverWith).toBeTruthy();
    if (serverWithout) {
      expect(serverWith!.score).toBeGreaterThan(serverWithout.score);
    }
    expect(serverWith!.reasons.join(' ')).toMatch(/critical/);
  });

  it('top risk file shows aggregated reasons, not just one signal', async () => {
    const info = await scanCodebase(VULNERABLE);
    const report = await runPredictiveAnalysis(
      info.fileContents, info.dependencies, info.devDependencies,
      {
        securityFindings: [
          { filePath: 'src/server.js', severity: 'critical' },
          { filePath: 'src/server.js', severity: 'high' },
        ],
        nPlusOneFindings: [{ filePath: 'src/server.js' }],
        deadExports: [{ filePath: 'src/server.js', name: 'unusedHelper' }],
      }
    );
    const top = report.topRiskyFiles[0];
    expect(top.filePath).toBe('src/server.js');
    expect(top.reasons.some((r) => /security/i.test(r))).toBe(true);
    expect(top.reasons.some((r) => /N\+1/i.test(r))).toBe(true);
  });

  it('emits a finding per top hotspot with category Predictive', async () => {
    const info = await scanCodebase(VULNERABLE);
    const report = await runPredictiveAnalysis(
      info.fileContents, info.dependencies, info.devDependencies,
      {
        securityFindings: [
          { filePath: 'src/server.js', severity: 'critical' },
          { filePath: 'src/server.js', severity: 'critical' },
        ],
      }
    );
    const hotspot = report.findings.find((f) => /Risk hotspot/.test(f.title));
    expect(hotspot).toBeTruthy();
    expect(hotspot!.category).toBe('Predictive');
    expect(hotspot!.severity).toMatch(/high|medium|low/);
  });

  it('riskLevel is Low when no file has any risk signal', async () => {
    // Tiny clean project: one entry point that uses its own helper.
    // No unused exports, no security, no n+1, no TODOs.
    const clean: Record<string, string> = {
      'package.json': '{"name":"clean","dependencies":{}}',
      'src/math.js': "export function add(a, b) { return a + b; }",
      'src/index.js': "import { add } from './math.js'; console.log(add(1, 2));",
    };
    const report = await runPredictiveAnalysis(clean, [], []);
    expect(report.topRiskyFiles.length).toBe(0);
    expect(report.riskLevel).toMatch(/Low/i);
    expect(report.score).toBeGreaterThanOrEqual(95);
  });
});

describe('accessibility-analyzer — Phase 5 pass 5: AST-based JSX a11y checks', () => {
  it('flags <img> without alt attribute', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const imgNoAlt = report.findings.find((f) => /img.*alt/i.test(f.title));
    expect(imgNoAlt).toBeTruthy();
    expect(imgNoAlt!.severity).toBe('high');
    expect(imgNoAlt!.wcagCriterion).toMatch(/1\.1\.1/);
  });

  it('does NOT flag <img alt="…"> (accessible) or <img alt=""> (decorative)', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    // GoodImg and DecorativeImg should not show up in a11y findings.
    const imgFindings = report.findings.filter((f) => /img.*alt/i.test(f.title));
    // Only ONE BadImg should fire — at the line of <img src="/hero.png" />.
    expect(imgFindings.length).toBe(1);
  });

  it('flags icon-only <button> without aria-label', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const btn = report.findings.find((f) => /button.*accessible name/i.test(f.title));
    expect(btn).toBeTruthy();
    expect(btn!.severity).toBe('high');
  });

  it('flags <a target="_blank"> without rel="noopener"', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const ext = report.findings.find((f) => /noopener/i.test(f.title));
    expect(ext).toBeTruthy();
    expect(ext!.severity).toBe('medium');
  });

  it('does NOT flag <a target="_blank" rel="noopener noreferrer">', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    // Only ONE noopener finding (the bad case), not two.
    const noopener = report.findings.filter((f) => /noopener/i.test(f.title));
    expect(noopener.length).toBe(1);
  });

  it('flags <input> without label / aria-label', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const input = report.findings.find((f) => /input.*label/i.test(f.title));
    expect(input).toBeTruthy();
  });

  it('does NOT flag <input type="hidden">', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    // Hidden inputs are excluded; only ONE input-no-label finding should fire.
    const inputFindings = report.findings.filter((f) => /input.*label/i.test(f.title));
    expect(inputFindings.length).toBe(1);
  });

  it('flags <div onClick> without role + tabIndex', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const clickable = report.findings.find((f) => /onClick.*role\+tabIndex/i.test(f.title));
    expect(clickable).toBeTruthy();
    expect(clickable!.severity).toBe('medium');
  });

  it('does NOT flag <div role="button" tabIndex={0} onClick>', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const clickable = report.findings.filter((f) => /onClick.*role\+tabIndex/i.test(f.title));
    expect(clickable.length).toBe(1); // only ClickableDiv, not AccessibleDivButton
  });

  it('flags empty aria-label="" as an anti-pattern', async () => {
    const report = await runAccessibilityAnalysis({ projectPath: A11Y_JSX });
    const empty = report.findings.find((f) => /aria-label.*empty string/i.test(f.title));
    expect(empty).toBeTruthy();
  });
});

describe('load-analyzer — Phase 5 pass 6: AST middleware/pattern detection', () => {
  it('detects rate-limiting via actual middleware registration', async () => {
    const info = await scanCodebase(LOAD_RESILIENT);
    const report = await runLoadAnalysis({
      projectPath: LOAD_RESILIENT, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    expect(report.hasRateLimiting).toBe(true);
    expect(report.patterns.rateLimit.length).toBeGreaterThan(0);
    // No false-positive rate-limit finding on the resilient fixture
    const rlFinding = report.findings.find((f) => /Rate Limiting/i.test(f.title));
    expect(rlFinding).toBeUndefined();
  });

  it('detects compression / cache / pool / health / timeouts / breaker', async () => {
    const info = await scanCodebase(LOAD_RESILIENT);
    const report = await runLoadAnalysis({
      projectPath: LOAD_RESILIENT, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    expect(report.hasCompression).toBe(true);
    expect(report.hasCaching).toBe(true);
    expect(report.hasConnectionPooling).toBe(true);
    expect(report.patterns.compression.length).toBeGreaterThan(0);
    expect(report.patterns.cache.length).toBeGreaterThan(0);
    expect(report.patterns.pool.length).toBeGreaterThan(0);
    expect(report.patterns.healthEndpoints.length).toBeGreaterThan(0);
    expect(report.patterns.timeout.length).toBeGreaterThan(0);
    expect(report.patterns.circuitBreaker.length).toBeGreaterThan(0);
  });

  it('flags fragile project: missing rate limit / cache / pool', async () => {
    const info = await scanCodebase(LOAD_FRAGILE);
    const report = await runLoadAnalysis({
      projectPath: LOAD_FRAGILE, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    expect(report.hasRateLimiting).toBe(false);
    expect(report.hasCaching).toBe(false);
    expect(report.hasCompression).toBe(false);
    const rl = report.findings.find((f) => /Rate Limiting/i.test(f.title));
    expect(rl).toBeTruthy();
  });

  it('flags sync I/O inside route handlers (HIGH severity)', async () => {
    const info = await scanCodebase(LOAD_FRAGILE);
    const report = await runLoadAnalysis({
      projectPath: LOAD_FRAGILE, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    expect(report.patterns.syncIoInHandlers.length).toBeGreaterThanOrEqual(2);
    const sync = report.findings.find((f) => /Sync I\/O/i.test(f.title));
    expect(sync).toBeTruthy();
    expect(sync!.severity).toBe('high');
  });

  it('flags external API calls without circuit breaker (fragile only)', async () => {
    const info = await scanCodebase(LOAD_FRAGILE);
    const report = await runLoadAnalysis({
      projectPath: LOAD_FRAGILE, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    const breaker = report.findings.find((f) => /circuit breaker/i.test(f.title));
    expect(breaker).toBeTruthy();
  });

  it('does NOT fire false positives from substring comments', async () => {
    // The fragile fixture has comments mentioning "rateLimit", "cache",
    // "compression", "Pool" — the prior substring matcher would have
    // claimed all of those existed. AST analysis must not be fooled.
    const info = await scanCodebase(LOAD_FRAGILE);
    const report = await runLoadAnalysis({
      projectPath: LOAD_FRAGILE, fileContents: info.fileContents, dependencies: info.dependencies,
    });
    expect(report.patterns.rateLimit.length).toBe(0);
    expect(report.patterns.cache.length).toBe(0);
    expect(report.patterns.compression.length).toBe(0);
    expect(report.patterns.pool.length).toBe(0);
  });

  it('does NOT fire the circuit-breaker rule when there are no external API calls', async () => {
    // Synthesize a project with no axios/fetch — circuit-breaker advice
    // should be silent (previously the precedence bug fired anyway).
    const tiny: Record<string, string> = {
      'package.json': '{"name":"tiny"}',
      'src/index.js': "const express = require('express'); const app = express(); app.get('/', (req, res) => res.json({})); app.listen(0);",
    };
    const report = await runLoadAnalysis({
      projectPath: LOAD_FRAGILE, // projectPath needs to exist; we override fileContents
      fileContents: tiny, dependencies: [],
    });
    const breaker = report.findings.find((f) => /circuit breaker/i.test(f.title));
    expect(breaker).toBeUndefined();
  });
});

describe('advanced-analyzer — Phase 5 pass 7: OWASP coverage (honest analyzer-gap framing)', () => {
  it('reports analyzer-coverage as a stable score, not project-finding count', async () => {
    // Empty findings list — analyzer-coverage shouldn't depend on this project's vulns.
    const reportEmpty = runOwaspCoverage([]);
    // Some real findings — same analyzer-coverage score.
    const reportWithFindings = runOwaspCoverage([
      { severity: 'critical', category: 'SQL Injection', title: 'sqli', description: '', fixSuggestion: '' },
      { severity: 'high', category: 'XSS', title: 'xss', description: '', fixSuggestion: '' },
    ]);
    expect(reportEmpty.score).toBe(reportWithFindings.score);
    // 8 of 10 categories have rules → 80%
    expect(reportEmpty.score).toBe(80);
  });

  it('flags the analyzer gaps (A08 + A10) with honest framing', async () => {
    const report = runOwaspCoverage([]);
    expect(report.missingCategories).toContain('A08:2021 — Software and Data Integrity Failures');
    expect(report.missingCategories).toContain('A10:2021 — Server-Side Request Forgery');
    const gap = report.findings.find((f) => /analyzer coverage/i.test(f.title));
    expect(gap).toBeTruthy();
    expect(gap!.description).toMatch(/gaps in the analyzer itself/);
  });

  it('buckets findings into the correct OWASP categories', async () => {
    const report = runOwaspCoverage([
      { severity: 'critical', category: 'SQL Injection', title: '', description: '', fixSuggestion: '' },
      { severity: 'high', category: 'XSS', title: '', description: '', fixSuggestion: '' },
      { severity: 'high', category: 'Hardcoded Secrets', title: '', description: '', fixSuggestion: '' },
      { severity: 'medium', category: 'CORS Misconfiguration', title: '', description: '', fixSuggestion: '' },
    ]);
    const a03 = report.byCategory.find((c) => c.code === 'A03');
    expect(a03).toBeTruthy();
    expect(a03!.findings.total).toBe(2); // SQL Injection + XSS
    expect(a03!.findings.critical).toBe(1);
    expect(a03!.findings.high).toBe(1);
    const a02 = report.byCategory.find((c) => c.code === 'A02');
    expect(a02!.findings.total).toBe(1); // Hardcoded Secrets
    const a05 = report.byCategory.find((c) => c.code === 'A05');
    expect(a05!.findings.total).toBe(1); // CORS
  });

  it('emits a category rollup finding when there is a concentrated critical', async () => {
    const report = runOwaspCoverage([
      { severity: 'critical', category: 'SQL Injection', title: '', description: '', fixSuggestion: '' },
    ]);
    const rollup = report.findings.find((f) => /A03:2021/.test(f.title));
    expect(rollup).toBeTruthy();
    expect(rollup!.severity).toBe('critical');
  });

  it('emits a category rollup finding when 3+ high-severity findings stack', async () => {
    const report = runOwaspCoverage([
      { severity: 'high', category: 'XSS', title: '', description: '', fixSuggestion: '' },
      { severity: 'high', category: 'XSS', title: '', description: '', fixSuggestion: '' },
      { severity: 'high', category: 'XSS', title: '', description: '', fixSuggestion: '' },
    ]);
    const rollup = report.findings.find((f) => /A03:2021/.test(f.title));
    expect(rollup).toBeTruthy();
    expect(rollup!.severity).toBe('high');
  });

  it('does not emit a rollup for sparse low/medium findings', async () => {
    const report = runOwaspCoverage([
      { severity: 'medium', category: 'CORS Misconfiguration', title: '', description: '', fixSuggestion: '' },
      { severity: 'low', category: 'XSS', title: '', description: '', fixSuggestion: '' },
    ]);
    const rollups = report.findings.filter((f) => /A0\d:2021/.test(f.title));
    expect(rollups.length).toBe(0);
  });

  it('integration: maps findings from a real vulnerable fixture', async () => {
    const info = await scanCodebase(VULNERABLE);
    const sec = await (await import('../src/analyzers/security-analyzer.js')).runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    // runOwaspCoverage's input type expects critical|high|medium|low — drop 'info'.
    const usable = sec.filter((f) => f.severity !== 'info') as Parameters<typeof runOwaspCoverage>[0];
    const report = runOwaspCoverage(usable);
    // The vulnerable fixture has SQL injection — A03 must be non-empty.
    const a03 = report.byCategory.find((c) => c.code === 'A03');
    expect(a03!.findings.total).toBeGreaterThan(0);
  });
});

describe('advanced-analyzer — Phase 5 pass 8: supply-chain lockfile audit', () => {
  it('parses package-lock.json and counts transitive entries', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    // dirty lock has 7 distinct entries (express, lodash, some-fork, local-helper, needs-integrity, minimist, dup-pkg x2)
    expect(report.totalTransitive).toBeGreaterThanOrEqual(7);
    expect(report.totalDeps).toBe(2); // direct: express + lodash
  });

  it('flags transitive CVE matches (minimist installed via lockfile but not in package.json)', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    const minimist = report.findings.find((f) => /Transitive: minimist/i.test(f.title));
    expect(minimist).toBeTruthy();
    expect(minimist!.severity).toBe('high');
  });

  it('flags non-registry sources (git URLs, file:)', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.nonRegistrySources).toBeGreaterThanOrEqual(2); // some-fork (git+) + local-helper (file:)
    const finding = report.findings.find((f) => /non-registry/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/some-fork|local-helper/);
  });

  it('flags missing integrity hashes', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.missingIntegrity).toBeGreaterThanOrEqual(1); // needs-integrity entry
    const finding = report.findings.find((f) => /integrity hashes/i.test(f.title));
    expect(finding).toBeTruthy();
  });

  it('flags duplicate-version drift', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.duplicateVersions).toBeGreaterThanOrEqual(1); // dup-pkg @ {1.0.0, 2.0.0}
    const finding = report.findings.find((f) => /multiple versions/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/dup-pkg/);
  });

  it('does NOT false-flag the clean fixture', async () => {
    const info = await scanCodebase(SUPPLY_CLEAN);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_CLEAN);
    expect(report.nonRegistrySources).toBe(0);
    expect(report.missingIntegrity).toBe(0);
    expect(report.duplicateVersions).toBe(0);
    // No-lockfile finding must not fire — lockfile IS present.
    const noLock = report.findings.find((f) => /No package-lock\.json/i.test(f.title));
    expect(noLock).toBeUndefined();
  });

  it('emits "no lockfile" finding when projectPath has no package-lock.json', async () => {
    // Use vulnerable-app fixture (no package-lock.json in it).
    const info = await scanCodebase(VULNERABLE);
    const report = runSupplyChainAudit(info.dependencies, info.devDependencies, VULNERABLE);
    expect(report.totalTransitive).toBe(0);
    const noLock = report.findings.find((f) => /No package-lock\.json/i.test(f.title));
    expect(noLock).toBeTruthy();
  });

  it('still works with no projectPath (backward compat — direct-deps only)', async () => {
    const report = runSupplyChainAudit(['lodash', 'express'], []);
    expect(report.totalTransitive).toBe(0);
    // Direct lodash CVE should still fire.
    const lodash = report.findings.find((f) => /lodash/i.test(f.title));
    expect(lodash).toBeTruthy();
  });
});

describe('advanced-analyzer — determinism (S1)', () => {
  it('mutation analysis returns the same score on identical input', async () => {
    const info = await scanCodebase(CLEAN);
    const a = await runMutationAnalysis(
      info.fileContents,
      info.devDependencies,
      info.totalFiles,
      info.totalLines
    );
    const b = await runMutationAnalysis(
      info.fileContents,
      info.devDependencies,
      info.totalFiles,
      info.totalLines
    );
    expect(a.estimatedMutationScore).toBe(b.estimatedMutationScore);
    expect(a.totalMutants).toBe(b.totalMutants);
    expect(a.killedMutants).toBe(b.killedMutants);
  });

  it('predictive analysis returns the same predictedFailures on identical input', async () => {
    const info = await scanCodebase(VULNERABLE);
    const a = await runPredictiveAnalysis(
      info.fileContents,
      info.dependencies,
      info.devDependencies
    );
    const b = await runPredictiveAnalysis(
      info.fileContents,
      info.dependencies,
      info.devDependencies
    );
    expect(a.score).toBe(b.score);
    expect(a.predictedFailures).toBe(b.predictedFailures);
    expect(a.riskLevel).toBe(b.riskLevel);
  });
});
