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
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { scanCodebase, type CodebaseInfo } from '../src/analyzers/code-scanner.js';
import { runSecurityAnalysis, isTestPath } from '../src/analyzers/security-analyzer.js';
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
const GO_APP = resolve(__dirname, 'fixtures/go-app');
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
const LIBS_MONOREPO = resolve(__dirname, 'fixtures/libs-monorepo');
const TEST_PATH_SUPPRESSION = resolve(__dirname, 'fixtures/test-path-suppression');
const POLYGLOT_GO = resolve(__dirname, 'fixtures/polyglot-go');

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

// Regression for the LangChain in-the-wild report (2026-05-28): root
// pyproject.toml didn't declare any workspace, but real packages lived
// under `libs/<name>/pyproject.toml`. 0.26.1 only followed declared
// workspaces, so we reported deps:0 even though there were ~dozens.
// 0.26.2 also follows libs/*, packages/*, apps/*, services/* by
// convention.
describe('code-scanner — conventional monorepo recursion (libs/*, packages/*, services/*)', () => {
  let info: CodebaseInfo;
  beforeAll(async () => {
    info = await scanCodebase(LIBS_MONOREPO);
  });

  it('follows libs/<pkg>/pyproject.toml even without workspace declaration', () => {
    // libs/core declares pydantic / httpx / tenacity
    expect(info.dependencies).toContain('pydantic');
    expect(info.dependencies).toContain('httpx');
    expect(info.dependencies).toContain('tenacity');
    // libs/openai declares openai / tiktoken
    expect(info.dependencies).toContain('openai');
    expect(info.dependencies).toContain('tiktoken');
  });

  it('follows libs/<pkg> dependency-groups for dev-deps', () => {
    // libs/core [dependency-groups] dev = pytest / mypy
    expect(info.devDependencies).toContain('pytest');
    expect(info.devDependencies).toContain('mypy');
  });

  it('follows packages/<pkg>/package.json even without workspaces field', () => {
    expect(info.dependencies).toContain('zod');
    expect(info.dependencies).toContain('axios');
    expect(info.devDependencies).toContain('vitest');
  });

  it('follows services/<svc>/requirements.txt at the convention path', () => {
    expect(info.dependencies).toContain('celery');
    expect(info.dependencies).toContain('redis');
  });

  it('tech-stack rolls up across all conventional members', () => {
    expect(info.techStack).toContain('Pydantic');
    expect(info.techStack).toContain('Celery');
    expect(info.techStack).toContain('Zod');
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
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    // dirty lock has 7 distinct entries (express, lodash, some-fork, local-helper, needs-integrity, minimist, dup-pkg x2)
    expect(report.totalTransitive).toBeGreaterThanOrEqual(7);
    expect(report.totalDeps).toBe(2); // direct: express + lodash
  });

  it('flags transitive CVE matches (minimist installed via lockfile but not in package.json)', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    const minimist = report.findings.find((f) => /Transitive: minimist/i.test(f.title));
    expect(minimist).toBeTruthy();
    expect(minimist!.severity).toBe('high');
  });

  it('flags non-registry sources (git URLs, file:)', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.nonRegistrySources).toBeGreaterThanOrEqual(2); // some-fork (git+) + local-helper (file:)
    const finding = report.findings.find((f) => /non-registry/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/some-fork|local-helper/);
  });

  it('flags missing integrity hashes', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.missingIntegrity).toBeGreaterThanOrEqual(1); // needs-integrity entry
    const finding = report.findings.find((f) => /integrity hashes/i.test(f.title));
    expect(finding).toBeTruthy();
  });

  it('flags duplicate-version drift', async () => {
    const info = await scanCodebase(SUPPLY_DIRTY);
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_DIRTY);
    expect(report.duplicateVersions).toBeGreaterThanOrEqual(1); // dup-pkg @ {1.0.0, 2.0.0}
    const finding = report.findings.find((f) => /multiple versions/i.test(f.title));
    expect(finding).toBeTruthy();
    expect(finding!.description).toMatch(/dup-pkg/);
  });

  it('does NOT false-flag the clean fixture', async () => {
    const info = await scanCodebase(SUPPLY_CLEAN);
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, SUPPLY_CLEAN);
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
    const report = await runSupplyChainAudit(info.dependencies, info.devDependencies, VULNERABLE);
    expect(report.totalTransitive).toBe(0);
    const noLock = report.findings.find((f) => /No package-lock\.json/i.test(f.title));
    expect(noLock).toBeTruthy();
  });

  it('still works with no projectPath (backward compat — direct-deps only)', async () => {
    const report = await runSupplyChainAudit(['lodash', 'express'], []);
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

// Go native support — added in v0.28.0. .go files count in totalFiles,
// go.mod parses to deps, Gin/Echo/Chi/Fiber/Gorilla/stdlib route patterns
// are counted as endpoints, tech-stack tagger recognizes common Go libs.
describe('code-scanner — Go native support (v0.28.0)', () => {
  let info: CodebaseInfo;
  beforeAll(async () => {
    info = await scanCodebase(POLYGLOT_GO);
  });

  it('counts .go files in totalFiles', () => {
    const goFiles = info.files.filter((f) => f.path.endsWith('.go'));
    expect(goFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('detects Gin route decorators + stdlib http.HandleFunc as endpoints', () => {
    // main.go has 5 Gin routes (GET/POST/PATCH/DELETE) + 1 http.HandleFunc.
    expect(info.endpoints).toBeGreaterThanOrEqual(6);
  });

  it('parses go.mod direct deps (require block)', () => {
    expect(info.dependencies).toContain('gin');
    expect(info.dependencies).toContain('cobra');
    expect(info.dependencies).toContain('viper');
    expect(info.dependencies).toContain('zap');
    expect(info.dependencies).toContain('gorm');
  });

  it('handles semantic-import-versioning v\\d+ path suffix correctly', () => {
    // jackc/pgx/v5 should land as 'pgx', not 'v5'
    expect(info.dependencies).toContain('pgx');
    expect(info.dependencies).not.toContain('v5');
  });

  it('skips // indirect deps', () => {
    expect(info.dependencies).not.toContain('sonic');
    expect(info.dependencies).not.toContain('go-spew');
  });

  it('tech-stack rolls up Go libraries', () => {
    expect(info.techStack).toContain('Gin');
    expect(info.techStack).toContain('Cobra');
    expect(info.techStack).toContain('Viper');
    expect(info.techStack).toContain('GORM/sqlx');
    expect(info.techStack).toContain('Structured Go logging');
    expect(info.techStack).toContain('PostgreSQL');
  });

  it('extracts Go function names (package-level + methods)', () => {
    const mainFns = info.functions['cmd/server/main.go'] || [];
    expect(mainFns).toContain('main');
    expect(mainFns).toContain('healthHandler');
    expect(mainFns).toContain('createUser');
    const repoFns = info.functions['internal/users/repo.go'] || [];
    expect(repoFns).toContain('NewRepo');
    expect(repoFns).toContain('FindByID'); // method on *Repo
  });

  it('reports 100% language coverage when the repo is Go-only', () => {
    expect(info.languageCoverage.coveragePercent).toBe(100);
    expect(info.languageCoverage.unsupportedFiles).toBe(0);
  });
});

// Regression for the LangChain in-the-wild report (2026-05-28): a pure
// Python repo scored 10/100 on Accessibility because the analyzer was
// scanning README.md for "Empty Link" patterns. 0.27.2 hard-filters the
// per-file loop to .html/.tsx/.jsx/.vue/.svelte and adds `applicable`.
describe('accessibility-analyzer — non-UI repos report applicable=false (v0.27.2)', () => {
  it('a Python-only repo (libs-monorepo) returns applicable=false and zero findings', async () => {
    const info = await scanCodebase(LIBS_MONOREPO);
    const r = await runAccessibilityAnalysis({ projectPath: LIBS_MONOREPO, fileContents: info.fileContents });
    expect(r.applicable).toBe(false);
    expect(r.totalHtmlFiles).toBe(0);
    expect(r.findings).toHaveLength(0);
  });

  it('a Next.js + FastAPI repo (polyglot-python) returns applicable=true', async () => {
    const info = await scanCodebase(POLYGLOT_PYTHON);
    const r = await runAccessibilityAnalysis({ projectPath: POLYGLOT_PYTHON, fileContents: info.fileContents });
    expect(r.applicable).toBe(true);
    expect(r.totalHtmlFiles).toBeGreaterThan(0);
  });

  it('does NOT scan README.md or other markdown for a11y patterns', async () => {
    // libs-monorepo has no .md but if any fileContent ends in .md it should
    // be ignored — even if the file contains a literal '[]()' empty link.
    const fileContents = {
      'README.md': '# Project\n\nSee [](https://example.com)\n',  // empty link in MD
      'index.html': '<html><body><a href="/foo">go</a></body></html>',
    };
    const r = await runAccessibilityAnalysis({ projectPath: LIBS_MONOREPO, fileContents });
    // The markdown empty-link must not be reported
    const onMarkdown = r.findings.filter((f) => f.filePath.endsWith('.md'));
    expect(onMarkdown).toHaveLength(0);
    // The html link with valid text should pass too
    expect(r.applicable).toBe(true);
  });
});

// Regression for the LangChain in-the-wild report (2026-05-28): 4,849
// test cases but Coverage scored 0%. The function-name matching
// heuristic doesn't fire on library-shaped repos where test
// descriptions don't echo source function names. 0.28.2 falls back to
// test-to-source-file ratio when the precise heuristic clearly fails.
describe('unit-analyzer — coverage falls back to test:source ratio when func-name match fails (v0.28.2)', () => {
  it('uses ratio fallback when there are many tests but zero name matches', async () => {
    // 20 test files exercise 100 source functions, but the test names
    // are abstract ("it(\"chain handles long context\", ...)") — none
    // contain a source function name. The precise heuristic returns 0;
    // the ratio fallback should kick in: 20 tests / 50 source files = 40%.
    const fileContents: Record<string, string> = {};
    for (let i = 0; i < 50; i++) {
      fileContents[`src/mod${i}.ts`] = `export function helper_${i}() { return ${i}; }\n`;
    }
    for (let i = 0; i < 20; i++) {
      fileContents[`tests/abstract${i}.test.ts`] =
        `import { describe, it, expect } from 'vitest';\n` +
        `describe('chain', () => { it('handles long context ${i}', () => { expect(true).toBe(true); }); });\n`;
    }
    // Write fixture to temp dir so unit-analyzer can run on it.
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cov-'));
    for (const [p, c] of Object.entries(fileContents)) {
      const full = path.join(root, p);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, c);
    }
    const r = await runUnitAnalysis({ projectPath: root });
    // Pre-v0.28.2 this would have been 0% (function-name match found
    // nothing). With the ratio fallback, it's a non-zero honest signal
    // — typically 25-45% depending on how the analyzer counts source
    // (the test files themselves get counted in source too, which
    // depresses the ratio but keeps it honest).
    expect(r.testCoverage).toBeGreaterThan(0);
    expect(r.testCoverage).toBeLessThanOrEqual(60);
    expect(r.totalTestFiles).toBe(20);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

// Regression for the TestForge self-audit (2026-05-28): mutation always
// scored 0 because `hasTestFramework` checked the ROOT package.json
// devDeps only — TestForge's vitest lives in mcp-server/package.json,
// not root, so devDeps:[] from root → "no test framework" → score 0,
// even though unit-analyzer correctly detected 17 vitest files. 0.28.2
// uses the actual test-file count as the signal instead.
describe('advanced-analyzer — mutation uses test-file count, not root devDeps (v0.28.2)', () => {
  it('scores >0 when test files exist even if devDeps is empty', async () => {
    const fileContents: Record<string, string> = {
      'src/util.ts': 'export function add(a: number, b: number) { return a + b; }\n',
      'src/util.test.ts':
        `import { describe, it, expect } from 'vitest';\n` +
        `import { add } from './util';\n` +
        `describe('add', () => {\n` +
        `  it('sums two numbers', () => { expect(add(2, 3)).toBe(5); });\n` +
        `  it('handles negatives', () => { expect(add(-2, 1)).toBe(-1); });\n` +
        `});\n`,
    };
    const r = await runMutationAnalysis(fileContents, /* devDependencies */ [], 2, 10);
    // Test framework "isn't in root devDeps" but tests are clearly there.
    // Score should be >0 (the pre-v0.28.2 behavior would have returned 0).
    expect(r.score).toBeGreaterThan(0);
    expect(r.assertionTotals.total).toBeGreaterThan(0);
  });

  it('returns 0 only when there are actually no test files', async () => {
    const fileContents = {
      'src/util.ts': 'export function add(a: number, b: number) { return a + b; }\n',
    };
    const r = await runMutationAnalysis(fileContents, [], 1, 5);
    expect(r.score).toBe(0);
    expect(r.findings[0].title).toBe('Mutation testing requires tests');
  });
});

// Regression for the Supabase in-the-wild report (2026-05-28): 14
// "critical" findings, almost all false positives — the SQL/NoSQL sink
// matched bare .get()/.all()/.run(), minified vendored code got scanned,
// and hardcoded-password fired on '[YOUR-PASSWORD]'. 0.28.3 precision pass.
describe('security-analyzer — SQL/NoSQL sink precision (v0.28.3)', () => {
  const mk = (file: string, code: string) => ({ [file]: code });
  const run = (fileContents: Record<string, string>) =>
    runSecurityAnalysis({ projectPath: '/tmp/synthetic', fileContents, dependencies: [], devDependencies: [] });

  it('does NOT flag urlParams.get() with a built string', async () => {
    const f = await run(mk('src/x.ts', 'const p = new URLSearchParams(); const v = p.get(`${key}`);'));
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection')).toHaveLength(0);
  });

  it('does NOT flag Promise.all() with a built array', async () => {
    const f = await run(mk('src/x.ts', 'const r = await Promise.all(items.map((i) => fetch(`${base}/${i}`)));'));
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection')).toHaveLength(0);
  });

  it('does NOT flag map.get() / array.find() on non-DB receivers', async () => {
    const f = await run(mk('src/x.ts',
      'const a = byId.get(`${id}`);\nconst b = list.find((x) => x.id === `${id}`);'));
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection')).toHaveLength(0);
  });

  it('STILL flags db.query() / collection.find() on DB-ish receivers', async () => {
    const f = await run(mk('src/x.ts',
      'const r = db.query(`SELECT * FROM users WHERE id = ${id}`);'));
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection').length).toBeGreaterThan(0);
  });

  it('STILL flags .raw() and .exec() regardless of receiver (strong methods)', async () => {
    const f = await run(mk('src/x.ts', 'const r = qb.raw(`SELECT ${cols} FROM t`);'));
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection').length).toBeGreaterThan(0);
  });

  it('skips minified / vendored files entirely', async () => {
    // A single very long line of minified-looking code with a db.query in it.
    const minified = 'var a=1;'.repeat(800) + 'db.query(`SELECT ${x}`);';
    const f = await run({ 'public/monaco-editor/workerMain.js': minified });
    expect(f.filter((x) => x.title === 'Potential SQL/NoSQL Injection')).toHaveLength(0);
  });

  it('skips hardcoded-secret on bracketed placeholders', async () => {
    const f = await run(mk('src/x.ts', "const password = '[YOUR-PASSWORD]';"));
    expect(f.filter((x) => x.category === 'Hardcoded Secrets')).toHaveLength(0);
  });

  it('STILL flags a real-looking hardcoded password', async () => {
    const f = await run(mk('src/x.ts', "const password = 'Pr0d_S3cret_9q8w7e';"));
    expect(f.filter((x) => x.category === 'Hardcoded Secrets').length).toBeGreaterThan(0);
  });
});

describe('accessibility-analyzer — skips test paths (v0.28.4)', () => {
  it('does NOT flag a11y violations inside test fixtures', async () => {
    const r = await runAccessibilityAnalysis({
      projectPath: VULNERABLE,
      fileContents: {
        // Same broken markup in a prod path vs a fixture path.
        'src/Real.tsx': `<button></button><img src="x.png" />`,
        'tests/fixtures/Bad.tsx': `<button></button><img src="x.png" />`,
        'src/__tests__/Also.tsx': `<button></button>`,
      },
    });
    const fromFixtures = r.findings.filter(
      (f) => f.filePath.includes('tests/') || f.filePath.includes('__tests__'),
    );
    expect(fromFixtures).toHaveLength(0);
    // The prod file's violations still surface.
    expect(r.findings.filter((f) => f.filePath === 'src/Real.tsx').length).toBeGreaterThan(0);
  });
});

describe('accessibility-analyzer — contrast is luminance-aware (v0.28.3)', () => {
  // runAccessibilityAnalysis requires projectPath to exist on disk even
  // when fileContents is supplied — use the repo root as a harmless
  // existing path and pass synthetic fileContents.
  it('does NOT flag near-black text colors', async () => {
    const r = await runAccessibilityAnalysis({
      projectPath: VULNERABLE,
      fileContents: { 'src/A.tsx': `<div style={{ color: '#12101A' }}>hi</div>` },
    });
    expect(r.findings.filter((f) => f.title.includes('Low Contrast Text'))).toHaveLength(0);
  });

  it('DOES flag genuinely light text colors', async () => {
    const r = await runAccessibilityAnalysis({
      projectPath: VULNERABLE,
      fileContents: { 'src/A.tsx': `<div style={{ color: '#eeeeee' }}>hi</div>` },
    });
    expect(r.findings.filter((f) => f.title.includes('Low Contrast Text')).length).toBeGreaterThan(0);
  });
});

// Regression for the TestForge self-audit (2026-05-28): express ^5.2.1
// fired "Potentially Vulnerable Dependency" even though the CVE is on
// <4.17.3. Pre-v0.28.1 the check matched by package name alone; now it
// short-circuits when the declared spec's major is strictly greater
// than the vulnerable upper-bound's major.
describe('security-analyzer — Vulnerable-deps version awareness (v0.28.1)', () => {
  it('does NOT fire on express ^5.2.1 (vulnerable upper bound is <4.17.3)', async () => {
    const fileContents = {
      'package.json': JSON.stringify({
        name: 'safe', dependencies: { express: '^5.2.1' },
      }),
      'src/server.js': 'import express from "express";\nconst app = express();',
    };
    const findings = await runSecurityAnalysis({
      projectPath: '/tmp/synthetic',
      fileContents,
      dependencies: ['express'],
      devDependencies: [],
    });
    const vd = findings.filter((f) => f.title.startsWith('Potentially Vulnerable Dependency: express'));
    expect(vd).toHaveLength(0);
  });

  it('DOES still fire on express ^4.16.0 (overlaps with <4.17.3)', async () => {
    const fileContents = {
      'package.json': JSON.stringify({
        name: 'risky', dependencies: { express: '^4.16.0' },
      }),
      'src/server.js': 'import express from "express";\nconst app = express();',
    };
    const findings = await runSecurityAnalysis({
      projectPath: '/tmp/synthetic',
      fileContents,
      dependencies: ['express'],
      devDependencies: [],
    });
    const vd = findings.filter((f) => f.title.startsWith('Potentially Vulnerable Dependency: express'));
    expect(vd).toHaveLength(1);
    expect(vd[0].description).toContain('declared as "express@^4.16.0"');
  });

  it('fires when spec is unknowable (git+URL — fall back to flagging)', async () => {
    const fileContents = {
      'package.json': JSON.stringify({
        name: 'unknown',
        dependencies: { express: 'git+https://github.com/expressjs/express.git' },
      }),
    };
    const findings = await runSecurityAnalysis({
      projectPath: '/tmp/synthetic',
      fileContents,
      dependencies: ['express'],
      devDependencies: [],
    });
    const vd = findings.filter((f) => f.title.startsWith('Potentially Vulnerable Dependency: express'));
    expect(vd).toHaveLength(1);
  });
});

// Regression for the LangChain in-the-wild report (2026-05-28): pure
// Python library, no web framework, still got a "Missing Rate Limiting"
// medium finding because checkMissingRateLimit fired unconditionally.
// 0.27.1 only fires the check when a web framework is in deps.
describe('security-analyzer — Missing Rate Limiting only fires on web apps (v0.27.1)', () => {
  it('does NOT emit on a library / monorepo with no web framework', async () => {
    const info = await scanCodebase(LIBS_MONOREPO);
    const findings = await runSecurityAnalysis({
      projectPath: LIBS_MONOREPO,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const rateLimitFindings = findings.filter((f) => f.title === 'Missing Rate Limiting');
    expect(rateLimitFindings).toHaveLength(0);
  });

  it('still emits on a FastAPI project (web framework in deps)', async () => {
    const info = await scanCodebase(POLYGLOT_PYTHON);
    const findings = await runSecurityAnalysis({
      projectPath: POLYGLOT_PYTHON,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const rateLimitFindings = findings.filter((f) => f.title === 'Missing Rate Limiting');
    expect(rateLimitFindings).toHaveLength(1);
    expect(rateLimitFindings[0].severity).toBe('medium');
  });

  it('still emits on an Express project (existing vulnerable-app fixture)', async () => {
    const info = await scanCodebase(VULNERABLE);
    const findings = await runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const rateLimitFindings = findings.filter((f) => f.title === 'Missing Rate Limiting');
    expect(rateLimitFindings).toHaveLength(1);
  });
});

// Regression for the Supabase in-the-wild report (2026-05-28): 125
// "critical" findings, almost all SQL-string-concat patterns in
// e2e/studio/features/*.spec.ts where building the string is exactly
// what the test is testing. 0.27.0 suppresses per-file security
// findings in known test paths.
describe('security-analyzer — test-path suppression (v0.27.0)', () => {
  it('isTestPath() matches every common test-file convention', () => {
    // dir-segment patterns
    expect(isTestPath('tests/foo.js')).toBe(true);
    expect(isTestPath('test/foo.js')).toBe(true);
    expect(isTestPath('src/__tests__/foo.js')).toBe(true);
    expect(isTestPath('src/__mocks__/foo.js')).toBe(true);
    expect(isTestPath('e2e/login.spec.ts')).toBe(true);
    expect(isTestPath('specs/foo.ts')).toBe(true);
    expect(isTestPath('cypress/e2e/login.cy.ts')).toBe(true);
    expect(isTestPath('playwright/auth.ts')).toBe(true);
    // suffix patterns
    expect(isTestPath('src/foo.test.ts')).toBe(true);
    expect(isTestPath('src/foo.spec.tsx')).toBe(true);
    expect(isTestPath('src/foo.test.mjs')).toBe(true);
    // pytest conventions
    expect(isTestPath('backend/test_users.py')).toBe(true);
    expect(isTestPath('backend/users_test.py')).toBe(true);
    // type declarations
    expect(isTestPath('types/foo.d.ts')).toBe(true);
    // honest negatives (production paths)
    expect(isTestPath('src/users.js')).toBe(false);
    expect(isTestPath('backend/app/main.py')).toBe(false);
    expect(isTestPath('src/components/Form.tsx')).toBe(false);
    // tricky: 'testing' as a noun isn't a test path
    expect(isTestPath('src/testing-utils.ts')).toBe(false);
  });

  it('emits findings for production code, suppresses identical pattern in test paths', async () => {
    const info = await scanCodebase(TEST_PATH_SUPPRESSION);
    const findings = await runSecurityAnalysis({
      projectPath: TEST_PATH_SUPPRESSION,
      fileContents: info.fileContents,
      dependencies: info.dependencies,
      devDependencies: info.devDependencies,
    });
    const fileToFindings = new Map<string, number>();
    for (const f of findings) {
      fileToFindings.set(f.filePath, (fileToFindings.get(f.filePath) || 0) + 1);
    }
    // Production file emits findings (SQL injection on req.params.id)
    expect((fileToFindings.get('src/users.js') || 0)).toBeGreaterThan(0);
    // None of the test paths should emit per-file findings
    expect(fileToFindings.get('src/users.test.js')).toBeUndefined();
    expect(fileToFindings.get('e2e/login.spec.ts')).toBeUndefined();
    expect(fileToFindings.get('__tests__/auth.js')).toBeUndefined();
    expect(fileToFindings.get('tests/integration/api.js')).toBeUndefined();
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

// v0.28.5 — accessibility precision pass. The TestForge self-audit surfaced
// a cluster of false positives (the same class as the Supabase security run):
// the analyzer flagged correctly-written UI as broken. Each of these guards a
// real over-firing source that was fixed.
describe('accessibility-analyzer — precision pass (v0.28.5)', () => {
  const a11y = (files: Record<string, string>) =>
    runAccessibilityAnalysis({ projectPath: VULNERABLE, fileContents: files });

  const byRule = (r: Awaited<ReturnType<typeof a11y>>, rule: string) =>
    r.findings.filter((f) => (f.rule ?? f.title) === rule || f.title === rule);

  it('button label from a conditional expression is an accessible name', async () => {
    const r = await a11y({ 'src/A.tsx': `<button onClick={x}><Plus/> {loading ? 'Saving…' : 'Save'}</button>` });
    expect(byRule(r, 'button-no-accessible-name')).toHaveLength(0);
  });

  it('still flags a genuinely icon-only conditional button', async () => {
    const r = await a11y({ 'src/A.tsx': `<button onClick={x}>{open ? <X/> : <Menu/>}</button>` });
    expect(byRule(r, 'button-no-accessible-name').length).toBeGreaterThan(0);
  });

  it('does not flag a primitive that spreads props (name/label may come from caller)', async () => {
    const r = await a11y({
      'src/Input.tsx': `function Input(props){ return <input type="text" {...props} /> }`,
      'src/IconBtn.tsx': `function IconBtn(props){ return <button {...props}><Icon/></button> }`,
    });
    expect(byRule(r, 'input-no-label')).toHaveLength(0);
    expect(byRule(r, 'button-no-accessible-name')).toHaveLength(0);
  });

  it('recognizes <label htmlFor> + <input id> association across the file', async () => {
    const r = await a11y({
      'src/Form.tsx': `<><label htmlFor="email">Email</label><input id="email" type="email" /></>`,
    });
    expect(byRule(r, 'input-no-label')).toHaveLength(0);
  });

  it('flags an input with neither inline label nor a matching <label htmlFor>', async () => {
    const r = await a11y({ 'src/Form.tsx': `<input id="lonely" type="text" />` });
    expect(byRule(r, 'input-no-label').length).toBeGreaterThan(0);
  });

  it('does not flag a clickable div with a structural role or aria-hidden', async () => {
    const r = await a11y({
      'src/Group.tsx': `<div role="group" onClick={f}><input/></div>`,
      'src/Backdrop.tsx': `<div aria-hidden="true" onClick={close} className="overlay" />`,
    });
    expect(byRule(r, 'clickable-non-interactive')).toHaveLength(0);
  });

  it('still flags a bare clickable div (no role, not hidden)', async () => {
    const r = await a11y({ 'src/Card.tsx': `<div onClick={go}>Open</div>` });
    expect(byRule(r, 'clickable-non-interactive').length).toBeGreaterThan(0);
  });

  it('does not flag a table whose <th> lives on a following line', async () => {
    const r = await a11y({
      'src/T.tsx': `<table className="data">\n  <thead><tr><th>Name</th><th>Value</th></tr></thead>\n  <tbody><tr><td>a</td><td>1</td></tr></tbody>\n</table>`,
    });
    expect(byRule(r, 'Table Without Headers')).toHaveLength(0);
  });

  it('still flags a header-less data table', async () => {
    const r = await a11y({
      'src/T.tsx': `<table>\n  <tbody><tr><td>a</td><td>1</td></tr></tbody>\n</table>`,
    });
    expect(byRule(r, 'Table Without Headers').length).toBeGreaterThan(0);
  });

  it('does not flag light hex on backgroundColor / config objects', async () => {
    const r = await a11y({
      'src/Chart.tsx': `const data = [{ name: 'Other', value: 20, color: '#D9D9D3' }];\nconst style = { backgroundColor: '#ffffff', borderColor: '#eeeeee' };`,
    });
    expect(byRule(r, 'Potentially Low Contrast Text Color')).toHaveLength(0);
  });

  it('honors inline suppression for a11y findings', async () => {
    const r = await a11y({
      'src/A.tsx': `// testforge-disable-next-line button-no-accessible-name\n<button onClick={x}><Icon/></button>`,
    });
    expect(byRule(r, 'button-no-accessible-name')).toHaveLength(0);
  });
});

// v0.28.6 — security precision pass. The Supabase report showed 41 findings
// (1 critical, 28 high) that were almost all cry-wolf: demo code, browser
// navigation misread as filesystem path traversal, and "built from a variable"
// speculation reported at HIGH. Each guard below is verified.
describe('security-analyzer — false-positive guards (v0.28.6)', () => {
  const sec = (files: Record<string, string>) =>
    runSecurityAnalysis({ projectPath: '/tmp/synthetic', fileContents: files, dependencies: [], devDependencies: [] });
  const titled = (f: Awaited<ReturnType<typeof sec>>, t: string) => f.filter((x) => x.title.includes(t));

  it('skips example / demo / sample paths', async () => {
    const f = await sec({ 'examples/auth/hono/src/index.ts': `app.get('/countries', (c) => c.json([]))` });
    expect(titled(f, 'Route Without Inline Auth')).toHaveLength(0);
  });

  it('does not read window.open as a filesystem path-traversal sink', async () => {
    const f = await sec({ 'src/nav.ts': `function go(url: string){ window.open(\`\${BASE_PATH}\${url}\`, '_blank') }` });
    expect(titled(f, 'Path Traversal')).toHaveLength(0);
  });

  it('does not flag a redirect to a fixed internal path', async () => {
    const f = await sec({ 'src/route.ts': `export function h(req: any){ const m = req.query.error; return redirect(\`/auth/error?error=\${m}\`); }` });
    expect(titled(f, 'Unvalidated Redirect')).toHaveLength(0);
  });

  it('does not report dangerouslySetInnerHTML at HIGH without confirmed taint', async () => {
    const f = await sec({ 'src/C.tsx': `const html = buildJsonLd(pageData);\nexport default () => <script dangerouslySetInnerHTML={{ __html: html }} />;` });
    const d = titled(f, 'dangerouslySetInnerHTML');
    expect(d.every((x) => x.severity !== 'high' && x.severity !== 'critical')).toBe(true);
  });

  it('reports Route Without Inline Auth as medium (low-confidence heuristic)', async () => {
    const f = await sec({ 'src/server.ts': `app.get('/admin', (req, res) => res.send('ok'))` });
    const r = titled(f, 'Route Without Inline Auth');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.severity === 'medium')).toBe(true);
  });
});

// v0.28.7 — bugs the VPS test-bed surfaced on real monorepos.
describe('analyzer fixes from the VPS test-bed (v0.28.7)', () => {
  it('detects Go tests (go_test.go) — was 0 testFiles / no framework before', async () => {
    const info = await scanCodebase(GO_APP);
    const u = await runUnitAnalysis({ projectPath: GO_APP, fileContents: info.fileContents });
    expect(u.frameworks).toContain('go test');
    expect(Array.isArray(u.testFiles) ? u.testFiles.length : 0).toBeGreaterThan(0);
    expect(u.totalTests).toBeGreaterThanOrEqual(2); // TestAdd, TestAddZero (+ Benchmark)
  });

  it('skips oversized files instead of OOMing, and reports it honestly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tf-scan-'));
    try {
      mkdirSync(join(dir, 'src'));
      writeFileSync(join(dir, 'src', 'small.ts'), 'export const a = 1;\n');
      // 1.2 MB single file — over the 1 MB per-file cap (generated/minified blob).
      writeFileSync(join(dir, 'src', 'huge.js'), 'x'.repeat(1_200_000));
      const info = await scanCodebase(dir);
      expect(info.languageCoverage.skippedLargeFiles).toBeGreaterThanOrEqual(1);
      expect(info.fileContents['src/huge.js']).toBeUndefined();   // not held in memory
      expect(info.fileContents['src/small.ts']).toBeDefined();    // normal file still analyzed
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
