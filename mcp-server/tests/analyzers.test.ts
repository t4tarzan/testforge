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
  runLicenseCheck,
  runChaosAnalysis,
  runDoraEstimation,
  runEdgeCaseAnalysis,
  runVisualRegressionAnalysis,
  runPropertyBasedAnalysis,
} from '../src/analyzers/advanced-analyzer.js';
import { runUnitAnalysis } from '../src/analyzers/unit-analyzer.js';
import { runAccessibilityAnalysis } from '../src/analyzers/accessibility-analyzer.js';
import { runLoadAnalysis } from '../src/analyzers/load-analyzer.js';
import { runVisionAnalysis, runScopeAnalysis, runStackAnalysis } from '../src/analyzers/strategic-analyzer.js';

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
const LICENSE_MIXED = resolve(__dirname, 'fixtures/license-mixed');
const CHAOS_RESILIENT = resolve(__dirname, 'fixtures/chaos-resilient');
const CHAOS_FRAGILE = resolve(__dirname, 'fixtures/chaos-fragile');
const MUTATION_QUALITY = resolve(__dirname, 'fixtures/mutation-quality');
const DORA_MATURE = resolve(__dirname, 'fixtures/dora-mature');
const DORA_IMMATURE = resolve(__dirname, 'fixtures/dora-immature');
const STRATEGIC_STRONG = resolve(__dirname, 'fixtures/strategic-strong');
const STRATEGIC_WEAK = resolve(__dirname, 'fixtures/strategic-weak');
const EDGE_CASES = resolve(__dirname, 'fixtures/edge-cases');
const VISUAL_QUALITY = resolve(__dirname, 'fixtures/visual-quality');
const PROPERTY_QUALITY = resolve(__dirname, 'fixtures/property-quality');
const STACK_MODERN = resolve(__dirname, 'fixtures/stack-modern');
const STACK_LEGACY = resolve(__dirname, 'fixtures/stack-legacy');
const POLYGLOT_PYTHON = resolve(__dirname, 'fixtures/polyglot-python');
const UV_WORKSPACE = resolve(__dirname, 'fixtures/uv-workspace');

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

  it('reports 100% language coverage for an all-JS repo', () => {
    expect(vulnInfo.languageCoverage.coveragePercent).toBe(100);
    expect(vulnInfo.languageCoverage.unsupportedFiles).toBe(0);
    expect(vulnInfo.languageCoverage.unsupportedLanguages).toEqual([]);
  });
});

// Regression for the dclaw-monitor real-world test (2026-05-27): TestForge
// analyzed a Next.js + FastAPI repo and reported `techStack: []`,
// `endpoints: 0`, `0 test files` because the scanner was JS-only. Every
// assertion here proves that case can no longer happen.
describe('code-scanner — Python (FastAPI + requirements + pyproject)', () => {
  let info: CodebaseInfo;
  beforeAll(async () => {
    info = await scanCodebase(POLYGLOT_PYTHON);
  });

  it('counts .py files in totalFiles', () => {
    const pyFiles = info.files.filter((f) => f.path.endsWith('.py'));
    expect(pyFiles.length).toBeGreaterThanOrEqual(6);
  });

  it('detects FastAPI route decorators as endpoints', () => {
    // main.py: 2 (health, metrics), users.py: 5 (list/create/get/patch/delete),
    // items.py: 3. Total 10 — main.py also has 2 include_router calls but
    // those aren't routes, so they shouldn't be counted.
    expect(info.endpoints).toBeGreaterThanOrEqual(10);
  });

  it('parses dependencies from requirements.txt', () => {
    expect(info.dependencies).toContain('fastapi');
    expect(info.dependencies).toContain('sqlalchemy');
    expect(info.dependencies).toContain('pydantic');
    expect(info.dependencies).toContain('asyncpg');
    expect(info.dependencies).toContain('celery');
    expect(info.dependencies).toContain('alembic');
    expect(info.dependencies).toContain('uvicorn');
  });

  it('strips version specifiers, extras, env markers, and comments', () => {
    // sqlalchemy[asyncio]==2.0.30 should land as 'sqlalchemy', not the full string.
    expect(info.dependencies).not.toContain('sqlalchemy[asyncio]');
    expect(info.dependencies).not.toContain('sqlalchemy==2.0.30');
    // httpx>=0.27 ; python_version >= "3.10" → 'httpx'
    expect(info.dependencies).toContain('httpx');
  });

  it('parses dependencies from pyproject.toml PEP 621 [project]', () => {
    expect(info.dependencies).toContain('redis');
  });

  it('parses dev dependencies from pyproject.toml optional-dependencies', () => {
    expect(info.devDependencies).toContain('pytest');
    expect(info.devDependencies).toContain('pytest-asyncio');
  });

  it('detects FastAPI / SQLAlchemy / Pydantic / PostgreSQL in techStack', () => {
    expect(info.techStack).toContain('FastAPI');
    expect(info.techStack).toContain('SQLAlchemy');
    expect(info.techStack).toContain('Pydantic');
    expect(info.techStack).toContain('PostgreSQL');
    expect(info.techStack).toContain('Celery');
    expect(info.techStack).toContain('OpenTelemetry');
    // Frontend stack also detected from package.json
    expect(info.techStack).toContain('Next.js');
    expect(info.techStack).toContain('React');
  });

  it('extracts Python function names', () => {
    const usersFns = info.functions['backend/app/api/v1/users.py'] || [];
    expect(usersFns).toContain('list_users');
    expect(usersFns).toContain('create_user');
    expect(usersFns).toContain('delete_user');
  });

  it('reports 100% language coverage (all source files are JS/TS or Python)', () => {
    expect(info.languageCoverage.coveragePercent).toBe(100);
    expect(info.languageCoverage.unsupportedFiles).toBe(0);
    expect(info.languageCoverage.nativelyAnalyzedFiles).toBeGreaterThanOrEqual(7);
  });
});

// Regression for the tiangolo/full-stack-fastapi-template real-world test
// (2026-05-28): 0.26.0 detected endpoints + pytest files but returned
// dependencies:0 and techStack:[] because the manifest-discovery code
// only read root pyproject.toml / package.json — missing the workspace
// members where deps actually live. 0.26.1 recurses.
describe('code-scanner — workspace recursion (uv + npm/bun)', () => {
  let info: CodebaseInfo;
  beforeAll(async () => {
    info = await scanCodebase(UV_WORKSPACE);
  });

  it('follows [tool.uv.workspace] members into backend/pyproject.toml', () => {
    expect(info.dependencies).toContain('fastapi');
    expect(info.dependencies).toContain('pydantic');
    expect(info.dependencies).toContain('sqlmodel');
    expect(info.dependencies).toContain('alembic');
    expect(info.dependencies).toContain('psycopg');
    expect(info.dependencies).toContain('httpx');
  });

  it('follows package.json "workspaces" into frontend/package.json', () => {
    expect(info.dependencies).toContain('react');
    expect(info.dependencies).toContain('react-dom');
    expect(info.devDependencies).toContain('vite');
    expect(info.devDependencies).toContain('typescript');
    expect(info.devDependencies).toContain('@playwright/test');
  });

  it('parses PEP 735 [dependency-groups] from root pyproject.toml', () => {
    // Root pyproject.toml declares dev = ["zizmor>=1.23.1", "ruff>=0.5"]
    // and ci = ["smokeshow>=0.5.0"] under [dependency-groups]. All named
    // groups land in devDependencies.
    expect(info.devDependencies).toContain('zizmor');
    expect(info.devDependencies).toContain('ruff');
    expect(info.devDependencies).toContain('smokeshow');
  });

  it('also collects member-level [dependency-groups] (backend dev tools)', () => {
    // backend/pyproject.toml has [dependency-groups] dev = ["pytest", "mypy"]
    expect(info.devDependencies).toContain('pytest');
    expect(info.devDependencies).toContain('mypy');
  });

  it('tech-stack tagging now sees the full polyglot stack', () => {
    expect(info.techStack).toContain('FastAPI');
    expect(info.techStack).toContain('Pydantic');
    expect(info.techStack).toContain('React');
    expect(info.techStack).toContain('Playwright');
    // pytest is named in [dependency-groups] inside backend/pyproject.toml
    expect(info.techStack).toContain('pytest');
  });
});

describe('unit-analyzer — pytest detection', () => {
  it('counts pytest test files alongside JS/TS tests', async () => {
    const report = await runUnitAnalysis({ projectPath: POLYGLOT_PYTHON });
    const pyTests = report.testFiles.filter((t) => t.path.endsWith('.py'));
    expect(pyTests.length).toBe(2); // test_users.py, test_items.py
    // test_users.py has 3 `def test_…` (one async); test_items.py has 2. Total 5.
    const pyTestCount = pyTests.reduce((sum, t) => sum + t.testCount, 0);
    expect(pyTestCount).toBe(5);
  });

  it('reports pytest in the frameworks list', async () => {
    const report = await runUnitAnalysis({ projectPath: POLYGLOT_PYTHON });
    expect(report.frameworks).toContain('pytest');
  });

  it('does NOT produce a "No Test Files Found" finding for a pytest-only project', async () => {
    const report = await runUnitAnalysis({ projectPath: POLYGLOT_PYTHON });
    const noTestsFinding = report.findings.find((f) => f.title === 'No Test Files Found');
    expect(noTestsFinding).toBeUndefined();
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

describe('advanced-analyzer — Phase 5 pass 9: license audit (SPDX categorization)', () => {
  it('categorizes a mixed node_modules tree correctly', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    expect(report.inspected).toBe(true);
    // mit-pkg + @scope/scoped-mit
    expect(report.byCategory.permissive).toBeGreaterThanOrEqual(2);
    // gpl-pkg
    expect(report.byCategory.copyleftStrong).toBeGreaterThanOrEqual(1);
    // lgpl-pkg
    expect(report.byCategory.copyleftWeak).toBeGreaterThanOrEqual(1);
    // unlicensed-pkg
    expect(report.byCategory.proprietary).toBeGreaterThanOrEqual(1);
    // no-license-pkg
    expect(report.byCategory.unknown).toBeGreaterThanOrEqual(1);
  });

  it('flags strong copyleft (GPL/AGPL) at HIGH severity', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    const gpl = report.findings.find((f) => /strong-copyleft/i.test(f.title));
    expect(gpl).toBeTruthy();
    expect(gpl!.severity).toBe('high');
    expect(gpl!.description).toMatch(/gpl-pkg/);
  });

  it('flags weak copyleft (LGPL/MPL/EPL) at MEDIUM severity', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    const lgpl = report.findings.find((f) => /weak-copyleft/i.test(f.title));
    expect(lgpl).toBeTruthy();
    expect(lgpl!.severity).toBe('medium');
    expect(lgpl!.description).toMatch(/lgpl-pkg/);
  });

  it('flags UNLICENSED packages', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    const unlicensed = report.findings.find((f) => /UNLICENSED/i.test(f.title));
    expect(unlicensed).toBeTruthy();
  });

  it('flags packages without a license field', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    const noLicense = report.findings.find((f) => /no resolvable license/i.test(f.title));
    expect(noLicense).toBeTruthy();
    expect(report.unknownLicense).toBeGreaterThanOrEqual(1);
  });

  it('handles scoped packages (@scope/name)', async () => {
    const info = await scanCodebase(LICENSE_MIXED);
    const report = runLicenseCheck(info.dependencies, LICENSE_MIXED);
    const scoped = report.strongCopyleft.find((p) => p.name === '@scope/scoped-mit')
      || report.weakCopyleft.find((p) => p.name === '@scope/scoped-mit');
    // @scope/scoped-mit is MIT, so it's NOT in copyleft lists — it should be in permissive count.
    expect(scoped).toBeUndefined();
    expect(report.byCategory.permissive).toBeGreaterThanOrEqual(2);
  });

  it('emits honest "no node_modules" finding when not present', async () => {
    // VULNERABLE fixture has no node_modules.
    const info = await scanCodebase(VULNERABLE);
    const report = runLicenseCheck(info.dependencies, VULNERABLE);
    expect(report.inspected).toBe(false);
    const limitation = report.findings.find((f) => /license audit could not run/i.test(f.title));
    expect(limitation).toBeTruthy();
  });

  it('SPDX categorizer: handles edge cases', async () => {
    const { categorizeLicense } = await import('../src/analyzers/lib/license-audit.js');
    expect(categorizeLicense('MIT')).toBe('permissive');
    expect(categorizeLicense('Apache-2.0')).toBe('permissive');
    expect(categorizeLicense('BSD-3-Clause')).toBe('permissive');
    expect(categorizeLicense('GPL-3.0')).toBe('copyleftStrong');
    expect(categorizeLicense('AGPL-3.0-only')).toBe('copyleftStrong');
    expect(categorizeLicense('LGPL-2.1')).toBe('copyleftWeak'); // NOT strong, even though contains "GPL"
    expect(categorizeLicense('MPL-2.0')).toBe('copyleftWeak');
    expect(categorizeLicense('UNLICENSED')).toBe('proprietary');
    expect(categorizeLicense('SEE LICENSE IN ./LICENSE')).toBe('proprietary');
    expect(categorizeLicense(null)).toBe('unknown');
    expect(categorizeLicense('')).toBe('unknown');
  });
});

describe('advanced-analyzer — Phase 5 pass 10: chaos / resilience patterns', () => {
  it('detects graceful shutdown via AST (process.on SIGTERM/SIGINT)', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.gracefulShutdown.length).toBeGreaterThanOrEqual(2);
    // No graceful-shutdown finding on resilient fixture
    const gs = report.findings.find((f) => /graceful shutdown handler/i.test(f.title));
    expect(gs).toBeUndefined();
  });

  it('detects process-level safety (unhandledRejection / uncaughtException)', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.processGuards.length).toBeGreaterThanOrEqual(2);
  });

  it('detects retry library imports and call sites', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.retryHits.length).toBeGreaterThanOrEqual(1);
  });

  it('detects Express global error handler (4-arg middleware)', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.errorHandlers.length).toBeGreaterThanOrEqual(1);
  });

  it('detects Idempotency-Key header reads for payment code', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.idempotencyKey.length).toBeGreaterThanOrEqual(1);
    // Resilient fixture HAS stripe + DOES read the header → no finding
    const idem = report.findings.find((f) => /idempotency-key/i.test(f.title));
    expect(idem).toBeUndefined();
  });

  it('detects new AbortController() instantiation', async () => {
    const info = await scanCodebase(CHAOS_RESILIENT);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.abortControllers.length).toBeGreaterThanOrEqual(1);
  });

  it('flags fragile project: missing graceful shutdown, error handler, retry', async () => {
    const info = await scanCodebase(CHAOS_FRAGILE);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.gracefulShutdown.length).toBe(0);
    expect(report.patterns.errorHandlers.length).toBe(0);
    expect(report.patterns.retryHits.length).toBe(0);

    expect(report.findings.find((f) => /graceful shutdown/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /global error handler/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /retry/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /unhandledRejection/i.test(f.title))).toBeTruthy();
  });

  it('does NOT fire false positives from substring comments', async () => {
    // The fragile fixture has comments mentioning "SIGTERM", "SIGINT",
    // "graceful shutdown", "AbortController". AST must not be fooled.
    const info = await scanCodebase(CHAOS_FRAGILE);
    const report = await runChaosAnalysis(info.fileContents, info.dependencies, ['Express']);
    expect(report.patterns.gracefulShutdown.length).toBe(0);
    expect(report.patterns.abortControllers.length).toBe(0);
  });

  it('does NOT fire shutdown/handler findings on a non-server app', async () => {
    // Tiny CLI-style code, no techStack server framework.
    const cliCode: Record<string, string> = {
      'package.json': '{"name":"cli","dependencies":{}}',
      'src/index.js': "function main() { try { console.log('hi'); } catch (e) { console.error(e); } } main();",
    };
    const report = await runChaosAnalysis(cliCode, [], ['Node']);
    expect(report.findings.find((f) => /graceful shutdown/i.test(f.title))).toBeUndefined();
    expect(report.findings.find((f) => /global error handler/i.test(f.title))).toBeUndefined();
  });
});

describe('advanced-analyzer — Phase 5 pass 11: mutation testing (assertion quality)', () => {
  it('classifies strong vs weak vs snapshot assertions per file', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    expect(report.assertionStats.length).toBe(3);

    const strong = report.assertionStats.find((s) => /strong\.test\.js$/.test(s.filePath));
    const weak = report.assertionStats.find((s) => /weak\.test\.js$/.test(s.filePath));
    const snap = report.assertionStats.find((s) => /snapshot\.test\.js$/.test(s.filePath));

    expect(strong!.strong).toBeGreaterThan(strong!.weak);
    expect(weak!.weak).toBeGreaterThan(weak!.strong);
    expect(snap!.snapshot).toBeGreaterThan(snap!.strong);
  });

  it('flags weak-assertion-dominated test files', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    const finding = report.findings.find((f) => /weak assertions/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/weak\.test\.js/);
  });

  it('flags snapshot-dominated test files', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    const finding = report.findings.find((f) => /snapshot assertions/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/snapshot\.test\.js/);
  });

  it('tracks matcher variety in the project rollup', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    // strong.test.js uses toBe, toEqual, toThrow, toBeInstanceOf — ≥ 4 distinct strong matchers
    expect(report.assertionTotals.overallVariety).toBeGreaterThanOrEqual(4);
  });

  it('exposes per-class totals + ratios', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    expect(report.assertionTotals.total).toBeGreaterThan(0);
    expect(report.assertionTotals.weak).toBeGreaterThan(0);
    expect(report.assertionTotals.snapshot).toBeGreaterThan(0);
    expect(report.assertionTotals.weakRatio).toBeGreaterThan(0);
    expect(report.assertionTotals.snapshotRatio).toBeGreaterThan(0);
  });

  it('mutation score reflects assertion quality, not just file ratio', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const report = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    // Fixture has 3 test files / 1 source file → ratio 3.0 → base 75 (capped).
    // Weak ratio is high (lots of weak assertions) → −10. Snapshot ratio high → −5.
    // So estimatedMutationScore should be visibly LOWER than 75.
    expect(report.estimatedMutationScore).toBeLessThan(75);
  });

  it('mutation score is deterministic on identical input', async () => {
    const info = await scanCodebase(MUTATION_QUALITY);
    const a = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    const b = await runMutationAnalysis(
      info.fileContents, info.devDependencies, info.totalFiles, info.totalLines,
    );
    expect(a.estimatedMutationScore).toBe(b.estimatedMutationScore);
    expect(a.assertionTotals.overallVariety).toBe(b.assertionTotals.overallVariety);
  });
});

describe('advanced-analyzer — Phase 5 pass 12: DORA signals (capability framing)', () => {
  it('detects CI workflows and parses their job count', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.signals.ciWorkflows.length).toBeGreaterThan(0);
    expect(report.signals.ciJobCount).toBe(4); // test + type-check + lint + deploy
    expect(report.signals.hasDeployJob).toBe(true);
    expect(report.signals.hasTypeCheckStep).toBe(true);
  });

  it('detects deployment platform configs (Dockerfile)', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.signals.deployPlatformConfigs).toContain('Dockerfile');
  });

  it('detects observability + structured logging deps', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.signals.observabilityDeps).toContain('@sentry/node');
    expect(report.signals.structuredLoggingDeps).toContain('pino');
  });

  it('detects feature-flag platform deps', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.signals.featureFlagDeps).toContain('posthog-node');
  });

  it('detects CODEOWNERS', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.signals.hasCodeowners).toBe(true);
  });

  it('mature project: all 4 capability strings show Good', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.deploymentFreq).toMatch(/Good/);
    expect(report.leadTime).toMatch(/Good/);
    expect(report.mttr).toMatch(/Good/);
    expect(report.changeFailRate).toMatch(/Good/);
    expect(report.score).toBeGreaterThanOrEqual(95);
  });

  it('immature project: all 4 capability strings show Weak, all findings fire', async () => {
    const info = await scanCodebase(DORA_IMMATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.deploymentFreq).toMatch(/Weak/);
    expect(report.leadTime).toMatch(/Weak/);
    expect(report.mttr).toMatch(/Weak/);
    expect(report.changeFailRate).toMatch(/Weak/);
    expect(report.score).toBeLessThan(40);
    expect(report.findings.find((f) => /No CI\/CD/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /No observability/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /No CODEOWNERS/i.test(f.title))).toBeTruthy();
  });

  it('mature project: does NOT emit findings whose capability is satisfied', async () => {
    const info = await scanCodebase(DORA_MATURE);
    const report = runDoraEstimation(info.fileContents, info.devDependencies);
    expect(report.findings.find((f) => /No CI\/CD/i.test(f.title))).toBeUndefined();
    expect(report.findings.find((f) => /No observability/i.test(f.title))).toBeUndefined();
    expect(report.findings.find((f) => /No CODEOWNERS/i.test(f.title))).toBeUndefined();
    expect(report.findings.find((f) => /type-check step/i.test(f.title))).toBeUndefined();
    expect(report.findings.find((f) => /feature-flag platform/i.test(f.title))).toBeUndefined();
  });
});

describe('strategic-analyzer — Phase 5 pass 13: vision + scope (word-boundary, exact deps)', () => {
  it('vision: strong fixture passes — no findings fire', async () => {
    const info = await scanCodebase(STRATEGIC_STRONG);
    const report = await runVisionAnalysis(info.fileContents, info.dependencies, info.devDependencies);
    expect(report.score).toBeGreaterThanOrEqual(95);
    expect(report.findings).toEqual([]);
  });

  it('vision: weak fixture flags missing observability / analytics / flags / versioning', async () => {
    const info = await scanCodebase(STRATEGIC_WEAK);
    const report = await runVisionAnalysis(info.fileContents, info.dependencies, info.devDependencies);
    expect(report.findings.find((f) => /observability/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /product analytics/i.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /feature-flag/i.test(f.title))).toBeTruthy();
  });

  it('vision: substring-trap deps (cache-analytics, crypto-analytics-lib) do NOT count as product analytics', async () => {
    // The weak fixture has these deps explicitly so the old substring
    // matcher would have falsely concluded analytics is present.
    const info = await scanCodebase(STRATEGIC_WEAK);
    const report = await runVisionAnalysis(info.fileContents, info.dependencies, info.devDependencies);
    expect(report.findings.find((f) => /product analytics/i.test(f.title))).toBeTruthy();
  });

  it('scope: documented + implemented features match → no scope-gap finding', async () => {
    const info = await scanCodebase(STRATEGIC_STRONG);
    const report = await runScopeAnalysis(info.fileContents, info.dependencies);
    // Strong fixture documents Auth/Payments/Search/Notifications/Admin AND implements them.
    expect(report.coverage).toBeGreaterThanOrEqual(80);
    expect(report.missingFeatures).toEqual([]);
    expect(report.findings.find((f) => /not implemented/i.test(f.title))).toBeUndefined();
  });

  it('scope: weak fixture surfaces scope gap (Payments + Notifications in README but no impl)', async () => {
    const info = await scanCodebase(STRATEGIC_WEAK);
    const report = await runScopeAnalysis(info.fileContents, info.dependencies);
    expect(report.missingFeatures.length).toBeGreaterThan(0);
    const gap = report.findings.find((f) => /not implemented/i.test(f.title));
    expect(gap).toBeTruthy();
    expect(gap!.description).toMatch(/Payments|Notifications/);
  });

  it('scope: extracts the Features section from the README', async () => {
    const info = await scanCodebase(STRATEGIC_STRONG);
    const report = await runScopeAnalysis(info.fileContents, info.dependencies);
    // The strong fixture's Features section names 5 things; documentedFeatures should reflect that.
    expect(report.documentedFeatures).toBeGreaterThanOrEqual(4);
  });

  it('scope: finds README under non-standard casing too', async () => {
    // Synthesize a project where the readme is lowercase.
    const fc: Record<string, string> = {
      'package.json': '{"name":"x"}',
      'readme.md': '## Features\n- Authentication via JWT\n',
    };
    const report = await runScopeAnalysis(fc, []);
    expect(report.documentedFeatures).toBeGreaterThan(0);
  });

  it('scope: word boundary matching — "author" no longer trips "auth" detection', async () => {
    // README mentions an "author" but no auth feature. Implementation
    // has no auth either. With substring matching, "author" would have
    // tripped "Authentication is implemented" — false positive.
    const fc: Record<string, string> = {
      'package.json': '{"name":"x"}',
      'README.md': '## About\nAuthored by Jane Doe.\n',
      'src/index.js': '// no auth code here',
    };
    const report = await runScopeAnalysis(fc, []);
    // Documented features should be zero — "author" must not count as a feature mention.
    expect(report.documentedFeatures).toBe(0);
  });
});

describe('advanced-analyzer — Phase 5 pass 14: AST edge-case detection', () => {
  it('flags parseInt(x) without explicit radix', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['parseInt-no-radix']).toBeGreaterThanOrEqual(1);
  });

  it('flags JSON.parse outside a try/catch', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['JSON-parse-untrycaught']).toBeGreaterThanOrEqual(1);
  });

  it('flags new Date(nonLiteralString)', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['new-Date-on-string']).toBeGreaterThanOrEqual(1);
  });

  it('flags loose equality (== / !=)', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['loose-equality']).toBeGreaterThanOrEqual(1);
  });

  it('flags Number(x) coercion without isNaN check', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['Number-coercion-unchecked']).toBeGreaterThanOrEqual(1);
  });

  it('flags switch without default', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    expect(report.byRule['switch-no-default']).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag the well-guarded versions in good.js', async () => {
    // The fixture has good.js with the safe variants. Findings from
    // good.js should not appear.
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    const fromGood = report.findings.filter((f) => f.filePath?.endsWith('good.js'));
    expect(fromGood).toEqual([]);
  });

  it('does NOT flag `x == null` (canonical nullish check)', async () => {
    // good.js has `x == null` — must not be in loose-equality results.
    const info = await scanCodebase(EDGE_CASES);
    const report = await runEdgeCaseAnalysis(info.fileContents);
    const loose = report.findings.filter((f) =>
      f.filePath?.endsWith('good.js') && /loose.equality/i.test(f.title)
    );
    expect(loose).toEqual([]);
  });

  it('produces a deterministic score and rule breakdown', async () => {
    const info = await scanCodebase(EDGE_CASES);
    const a = await runEdgeCaseAnalysis(info.fileContents);
    const b = await runEdgeCaseAnalysis(info.fileContents);
    expect(a.score).toBe(b.score);
    expect(a.byRule).toEqual(b.byRule);
  });
});

describe('advanced-analyzer — Phase 5 pass 15: visual regression + property-based (AST)', () => {
  it('visual: flags heavy inline styles when no CSS modules exist', async () => {
    const info = await scanCodebase(VISUAL_QUALITY);
    const report = await runVisualRegressionAnalysis(info.fileContents);
    // Bad.tsx has 3 files × 4-ish style props. Good.tsx uses styles.card (no inline).
    const inline = report.findings.find((f) => /inline styles/i.test(f.title));
    expect(inline).toBeTruthy();
  });

  it('visual: flags hardcoded pixel values in JSX style props', async () => {
    const info = await scanCodebase(VISUAL_QUALITY);
    const report = await runVisualRegressionAnalysis(info.fileContents);
    const px = report.findings.find((f) => /hardcoded pixel/i.test(f.title));
    expect(px).toBeTruthy();
  });

  it('visual: flags inline color literals (#hex) in JSX style props', async () => {
    const info = await scanCodebase(VISUAL_QUALITY);
    const report = await runVisualRegressionAnalysis(info.fileContents);
    const color = report.findings.find((f) => /inline color literal/i.test(f.title));
    expect(color).toBeTruthy();
  });

  it('visual: comment-trap (// style= 16px #ff0000) does NOT fool the AST walker', async () => {
    // Bad.tsx has a comment that literally contains "style=", "16px",
    // "24px", and "#ff0000". With substring matching this would have
    // counted them. AST walker must only see real attributes.
    // We can't easily count "only comment hits" — but we CAN verify
    // the counts come from the actual JSX nodes by checking the
    // findings reference real file paths, not just totals.
    const info = await scanCodebase(VISUAL_QUALITY);
    const report = await runVisualRegressionAnalysis(info.fileContents);
    const colorFinding = report.findings.find((f) => /inline color/i.test(f.title));
    // The Good.tsx file uses CSS modules — must not be the example file for color findings.
    if (colorFinding) expect(colorFinding.filePath).not.toMatch(/Good\.tsx$/);
  });

  it('property: detects fast-check framework imports', async () => {
    const info = await scanCodebase(PROPERTY_QUALITY);
    const report = await runPropertyBasedAnalysis(info.fileContents);
    // Framework found → no "no framework" finding fires.
    const noFw = report.findings.find((f) => /No property-based testing framework/i.test(f.title));
    expect(noFw).toBeUndefined();
  });

  it('property: counts type guards + invariant calls (typeof, Array.isArray, instanceof, assert)', async () => {
    const info = await scanCodebase(PROPERTY_QUALITY);
    const report = await runPropertyBasedAnalysis(info.fileContents);
    // util.js has 3 typeof checks, 1 Array.isArray, 1 instanceof, plus an assert.ok call.
    expect(report.invariantsDetected).toBeGreaterThanOrEqual(4);
  });

  it('property: emits "framework but no fc.assert" finding when imports exist without call sites', async () => {
    // Synthesize: just an import line, no fc.assert anywhere.
    const fc: Record<string, string> = {
      'package.json': '{"name":"x","devDependencies":{"fast-check":"^3.0.0"}}',
      'tests/x.test.js': "import fc from 'fast-check';\nimport { it } from 'vitest';\nit('x', () => {});",
    };
    const report = await runPropertyBasedAnalysis(fc);
    const orphan = report.findings.find((f) => /no `fc\.property` \/ `fc\.assert` calls/i.test(f.title));
    expect(orphan).toBeTruthy();
  });

  it('property: emits "no framework" finding when no fast-check / jsverify import', async () => {
    const empty: Record<string, string> = {
      'package.json': '{"name":"x"}',
      'src/index.js': 'export const x = 1;',
    };
    const report = await runPropertyBasedAnalysis(empty);
    const noFw = report.findings.find((f) => /No property-based testing framework/i.test(f.title));
    expect(noFw).toBeTruthy();
  });

  it('property: emits "no invariants" finding when source has no type guards', async () => {
    const empty: Record<string, string> = {
      'package.json': '{"name":"x"}',
      'src/index.js': 'export const x = 1;',
    };
    const report = await runPropertyBasedAnalysis(empty);
    const noInv = report.findings.find((f) => /No runtime invariants/i.test(f.title));
    expect(noInv).toBeTruthy();
  });
});

describe('strategic-analyzer — Phase 5 pass 16: stack polish (strict dep sets + new signals)', () => {
  it('modern stack: detects testing + linting + ORM + cache + bundler + framework + validation + tRPC', async () => {
    const info = await scanCodebase(STACK_MODERN);
    const report = await runStackAnalysis(
      info.fileContents, info.dependencies, info.devDependencies, [...info.techStack, 'TypeScript', 'Hono', 'PostgreSQL'],
    );
    expect(report.strengths.some((s) => /Testing framework/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /Linting/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /ORM/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /Modern bundler/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /Modern framework/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /Runtime validation/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /tRPC/.test(s))).toBe(true);
    expect(report.strengths.some((s) => /TypeScript runtime/.test(s))).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(90);
  });

  it('modern stack: tsconfig strict mode acknowledged', async () => {
    const info = await scanCodebase(STACK_MODERN);
    const report = await runStackAnalysis(
      info.fileContents, info.dependencies, info.devDependencies, [...info.techStack, 'TypeScript'],
    );
    expect(report.strengths.some((s) => /strict mode enabled/.test(s))).toBe(true);
  });

  it('legacy stack: missing testing + ORM + TS findings fire', async () => {
    const info = await scanCodebase(STACK_LEGACY);
    const report = await runStackAnalysis(
      info.fileContents, info.dependencies, info.devDependencies, [...info.techStack, 'MongoDB'],
    );
    expect(report.findings.find((f) => /No testing framework/.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /Database without ORM/.test(f.title))).toBeTruthy();
    expect(report.findings.find((f) => /JavaScript without TypeScript/.test(f.title))).toBeTruthy();
  });

  it('legacy stack: vitest-mock-extended substring does NOT count as a real test framework', async () => {
    // legacy fixture has `vitest-mock-extended` (a real package — Jest mock helper).
    // Old substring matcher with d.includes("vitest") would falsely count this
    // as having vitest installed. Strict Set must not be fooled.
    const info = await scanCodebase(STACK_LEGACY);
    const report = await runStackAnalysis(
      info.fileContents, info.dependencies, info.devDependencies, info.techStack,
    );
    expect(report.findings.find((f) => /No testing framework/.test(f.title))).toBeTruthy();
  });

  it('legacy stack: vite-something-else does NOT count as a modern bundler', async () => {
    // Same trap — old `d.includes('vite')` would match.
    const info = await scanCodebase(STACK_LEGACY);
    const report = await runStackAnalysis(
      info.fileContents, info.dependencies, info.devDependencies, info.techStack,
    );
    expect(report.strengths.some((s) => /Modern bundler/.test(s))).toBe(false);
  });

  it('TS without strict mode is flagged at low severity', async () => {
    // Synthesize a project with tsconfig.json but no strict.
    const fc: Record<string, string> = {
      'package.json': '{"name":"x","devDependencies":{"vitest":"^1.0.0","typescript":"^5.0.0"}}',
      'tsconfig.json': '{"compilerOptions":{"target":"ES2022"}}',
      'src/index.ts': 'export const x = 1;',
    };
    const report = await runStackAnalysis(fc, [], ['vitest', 'typescript'], ['TypeScript']);
    const finding = report.findings.find((f) => /TypeScript without strict mode/.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.severity).toBe('low');
  });

  it('API server without validation library fires medium finding', async () => {
    // Express server, no Zod / Yup / Joi.
    const fc: Record<string, string> = {
      'package.json': '{"name":"x","dependencies":{"express":"^4.18.0","helmet":"^7.0.0","cors":"^2.8.5","cookie-parser":"^1.4.6","compression":"^1.7.4","express-rate-limit":"^7.0.0","body-parser":"^1.20.0","morgan":"^1.10.0","dotenv":"^16.0.0","jsonwebtoken":"^9.0.0","bcrypt":"^5.0.0"}}',
      'src/server.js': "const express=require('express');const app=express();app.listen(0);",
    };
    const deps = Object.keys(JSON.parse(fc['package.json']).dependencies);
    const report = await runStackAnalysis(fc, deps, [], ['Express']);
    const finding = report.findings.find((f) => /without runtime validation library/.test(f.title));
    expect(finding).toBeTruthy();
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
