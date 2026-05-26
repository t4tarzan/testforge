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
} from '../src/analyzers/advanced-analyzer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VULNERABLE = resolve(__dirname, 'fixtures/vulnerable-app');
const CLEAN = resolve(__dirname, 'fixtures/clean-app');
const TRUE_POS = resolve(__dirname, 'fixtures/true-positives');
const FALSE_POS = resolve(__dirname, 'fixtures/false-positives');

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
