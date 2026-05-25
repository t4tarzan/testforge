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

  it('flags eval(req.query.code) as XSS / code injection', async () => {
    const findings = await runSecurityAnalysis({
      projectPath: VULNERABLE,
      fileContents: vulnInfo.fileContents,
      dependencies: vulnInfo.dependencies,
      devDependencies: vulnInfo.devDependencies,
    });
    const xss = findings.filter((f) => f.category === 'XSS');
    expect(xss.some((f) => /eval/i.test(f.title))).toBe(true);
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
