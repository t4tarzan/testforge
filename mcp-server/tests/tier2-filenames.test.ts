// Regression tests for the Tier-2 filename-collision bug surfaced by the
// dkubex deep test: same-rule findings (e.g. eight `new-date-on-string`) all got
// the same model-chosen filename and overwrote each other in the run dir, so
// only a fraction of generated tests actually executed. Two layers now prevent
// it: deterministic per-finding names (uniqueTestFilename) and a write-time
// dedup guard in the runner (dedupeName).
import { describe, it, expect } from 'vitest';
import { uniqueTestFilename, detectLanguage, type InputFinding } from '../src/generator/generate-tests.js';
import { dedupeName } from '../src/runner/docker-runner.js';

const finding = (over: Partial<InputFinding>): InputFinding => ({
  rule: 'new-date-on-string', title: 'new Date on string', description: '', filePath: 'src/utils/date.ts',
  lineNumber: 142, fixSuggestion: '', severity: 'low', ...over,
});

// A finding with NO filePath (supply-chain, license, project-level k8s like
// "No NetworkPolicy") used to crash generation with
// `Cannot read properties of undefined (reading 'toLowerCase')` → 500.
describe('findings without a filePath do not crash', () => {
  it('detectLanguage handles undefined/null/empty → defaults to js', () => {
    expect(detectLanguage(undefined)).toBe('js');
    expect(detectLanguage(null)).toBe('js');
    expect(detectLanguage('')).toBe('js');
    expect(detectLanguage('app/db.py')).toBe('python');
  });
  it('uniqueTestFilename handles a finding with no filePath', () => {
    const name = uniqueTestFilename(
      finding({ rule: 'vulnerable-dep', title: 'axios CVE', filePath: undefined as unknown as string, lineNumber: undefined as unknown as number }),
      { language: 'js', ext: '.test.ts' },
    );
    expect(name).toMatch(/\.test\.ts$/);
    expect(name).not.toContain('undefined');
  });
});

describe('uniqueTestFilename', () => {
  it('disambiguates same-rule findings by source file + line', () => {
    const a = uniqueTestFilename(finding({ filePath: 'src/utils/date.ts', lineNumber: 142 }), { language: 'js', ext: '.test.ts' });
    const b = uniqueTestFilename(finding({ filePath: 'src/utils/date.ts', lineNumber: 99 }), { language: 'js', ext: '.test.ts' });
    const c = uniqueTestFilename(finding({ filePath: 'src/api/clock.ts', lineNumber: 142 }), { language: 'js', ext: '.test.ts' });
    expect(new Set([a, b, c]).size).toBe(3); // all distinct
    expect(a).toBe('new-date-on-string-date-l142.test.ts');
  });

  it('uses the model name only as a fallback when the rule is empty', () => {
    const n = uniqueTestFilename(finding({ rule: '', lineNumber: 5 }), { language: 'js', ext: '.test.ts' }, 'switch-no-default.test.ts');
    expect(n).toMatch(/^switch-no-default-date-l5\.test\.ts$/);
  });

  it('honors language conventions (snake_case + _test.py / _test.go)', () => {
    expect(uniqueTestFilename(finding({ rule: 'sql_injection', filePath: 'app/db.py', lineNumber: 52 }), { language: 'python', ext: '_test.py' }))
      .toBe('sql_injection_db_l52_test.py');
    expect(uniqueTestFilename(finding({ rule: 'path-traversal', filePath: 'main.go', lineNumber: 31 }), { language: 'go', ext: '_test.go' }))
      .toBe('path_traversal_main_l31_test.go');
  });

  it('never produces an empty slug', () => {
    const n = uniqueTestFilename(finding({ rule: '!!!', title: '', filePath: '???', lineNumber: 0 }), { language: 'js', ext: '.test.ts' }, '');
    expect(n.endsWith('.test.ts')).toBe(true);
    expect(n.length).toBeGreaterThan('.test.ts'.length);
  });
});

describe('dedupeName (runner write-time guard)', () => {
  it('passes through a free name', () => {
    expect(dedupeName('a.test.ts', new Set(), 'js')).toBe('a.test.ts');
  });
  it('appends a hyphen suffix for js collisions', () => {
    const used = new Set(['a.test.ts']);
    expect(dedupeName('a.test.ts', used, 'js')).toBe('a-2.test.ts');
  });
  it('keeps climbing past multiple collisions', () => {
    const used = new Set(['a.test.ts', 'a-2.test.ts', 'a-3.test.ts']);
    expect(dedupeName('a.test.ts', used, 'js')).toBe('a-4.test.ts');
  });
  it('uses underscore suffixes for python/go so module names stay valid', () => {
    expect(dedupeName('x_test.py', new Set(['x_test.py']), 'python')).toBe('x_2_test.py');
    expect(dedupeName('x_test.go', new Set(['x_test.go']), 'go')).toBe('x_2_test.go');
  });
});
