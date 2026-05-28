// Tests for the Python per-line edge-case detector (lib/py-edge-cases.ts).
//
// This closes the "biggest gap" from the dkubex deep test: per-line analysis
// was Babel-only, so Python/FastAPI backends got no edge-case detection. The
// detector runs the stdlib `ast` module via a python3 subprocess.
//
// The suite is skipped (it.skipIf) when python3 is unavailable so CI without
// python doesn't fail — but python3 IS present in the MCP runtime and on dev
// boxes, so it must actually run there.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { findPythonEdgeCases, type PyEdgeRule } from '../src/analyzers/lib/py-edge-cases.js';

function hasPython(): boolean {
  try {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf8', timeout: 5000 });
    return r.status === 0 && !r.error;
  } catch {
    return false;
  }
}
const PY = hasPython();

/** Collect the set of rules hit, and a rule→lines map for precise assertions. */
function rulesOf(filePath: string, src: string): { rules: Set<PyEdgeRule>; lines: Record<string, number[]> } {
  const hits = findPythonEdgeCases(filePath, src);
  const rules = new Set<PyEdgeRule>();
  const lines: Record<string, number[]> = {};
  for (const h of hits) {
    rules.add(h.rule);
    (lines[h.rule] ??= []).push(h.line);
  }
  return { rules, lines };
}

describe('findPythonEdgeCases', () => {
  it.skipIf(!PY)('detects mutable default arguments (list/dict/set/call)', () => {
    const src = [
      'def a(x=[]):',           // line 1
      '    return x',
      'def b(y={}):',           // line 3
      '    return y',
      'def c(z=set()):',        // line 5
      '    return z',
      'async def d(w=list()):', // line 7
      '    return w',
    ].join('\n');
    const { rules, lines } = rulesOf('app/handlers.py', src);
    expect(rules.has('mutable-default-arg')).toBe(true);
    expect(lines['mutable-default-arg'].sort((m, n) => m - n)).toEqual([1, 3, 5, 7]);
  });

  it.skipIf(!PY)('does NOT flag immutable / None defaults', () => {
    const src = 'def f(a=None, b=0, c="x", d=(1, 2)):\n    return a';
    const { rules } = rulesOf('app/ok.py', src);
    expect(rules.has('mutable-default-arg')).toBe(false);
  });

  it.skipIf(!PY)('detects bare except', () => {
    const src = ['try:', '    risky()', 'except:', '    pass'].join('\n');
    const { rules, lines } = rulesOf('app/x.py', src);
    expect(rules.has('bare-except')).toBe(true);
    expect(lines['bare-except']).toContain(3);
  });

  it.skipIf(!PY)('does NOT flag typed except', () => {
    const src = ['try:', '    risky()', 'except ValueError:', '    pass'].join('\n');
    expect(rulesOf('app/x.py', src).rules.has('bare-except')).toBe(false);
  });

  it.skipIf(!PY)('detects == None / != None', () => {
    const src = ['if x == None:', '    pass', 'if y != None:', '    pass'].join('\n');
    const { rules, lines } = rulesOf('app/x.py', src);
    expect(rules.has('eq-none')).toBe(true);
    expect(lines['eq-none'].sort((m, n) => m - n)).toEqual([1, 3]);
  });

  it.skipIf(!PY)('does NOT flag `is None`', () => {
    const src = 'if x is None:\n    pass';
    expect(rulesOf('app/x.py', src).rules.has('eq-none')).toBe(false);
  });

  it.skipIf(!PY)('detects assert in non-test files but not test files', () => {
    const src = 'def f(x):\n    assert x > 0\n    return x';
    expect(rulesOf('app/service.py', src).rules.has('assert-for-validation')).toBe(true);
    // path contains "test" → skipped
    expect(rulesOf('tests/test_service.py', src).rules.has('assert-for-validation')).toBe(false);
  });

  it.skipIf(!PY)('detects SQL string interpolation (f-string / % / .format)', () => {
    const src = [
      'cursor.execute(f"SELECT * FROM users WHERE id = {uid}")', // line 1
      'cursor.execute("SELECT * FROM t WHERE x = %s" % val)',    // line 2
      'db.raw("SELECT {}".format(name))',                        // line 3
    ].join('\n');
    const { rules, lines } = rulesOf('app/db.py', src);
    expect(rules.has('sql-string-interpolation')).toBe(true);
    expect(lines['sql-string-interpolation'].sort((m, n) => m - n)).toEqual([1, 2, 3]);
  });

  it.skipIf(!PY)('does NOT flag parameterized execute()', () => {
    const src = 'cursor.execute("SELECT * FROM users WHERE id = %s", (uid,))';
    expect(rulesOf('app/db.py', src).rules.has('sql-string-interpolation')).toBe(false);
  });

  it.skipIf(!PY)('detects int()/float() coercion outside try, not literal, not inside try', () => {
    const src = [
      'def parse(raw):',
      '    n = int(raw)',        // line 2 — flagged
      '    f = float(raw)',      // line 3 — flagged
      '    ok = int("5")',       // line 4 — literal, not flagged
      '    try:',
      '        guarded = int(raw)',  // line 6 — inside try, not flagged
      '    except ValueError:',
      '        guarded = 0',
      '    return n',
    ].join('\n');
    const { rules, lines } = rulesOf('app/parse.py', src);
    expect(rules.has('int-coercion-unchecked')).toBe(true);
    expect(lines['int-coercion-unchecked'].sort((m, n) => m - n)).toEqual([2, 3]);
  });

  it.skipIf(!PY)('detects HTTP calls with no timeout, not those with one', () => {
    const src = [
      'resp = requests.get(url)',                  // line 1 — flagged
      'resp2 = requests.post(url, data=d)',        // line 2 — flagged
      'resp3 = requests.get(url, timeout=5)',      // line 3 — has timeout, ok
      'resp4 = httpx.get(url, timeout=10)',        // line 4 — ok
      'resp5 = httpx.delete(url)',                 // line 5 — flagged
    ].join('\n');
    const { rules, lines } = rulesOf('app/client.py', src);
    expect(rules.has('requests-no-timeout')).toBe(true);
    expect(lines['requests-no-timeout'].sort((m, n) => m - n)).toEqual([1, 2, 5]);
  });

  it.skipIf(!PY)('returns no findings for a clean file', () => {
    const src = [
      'def add(a: int, b: int) -> int:',
      '    return a + b',
      '',
      'def lookup(d, key=None):',
      '    if key is None:',
      '        return None',
      '    return d.get(key)',
    ].join('\n');
    expect(findPythonEdgeCases('app/clean.py', src)).toEqual([]);
  });

  it.skipIf(!PY)('returns [] on a syntax-error file (never throws)', () => {
    const src = 'def broken(:\n    this is not python';
    expect(findPythonEdgeCases('app/broken.py', src)).toEqual([]);
  });

  it.skipIf(!PY)('de-dups by (line, rule)', () => {
    // Two distinct rules on overlapping lines must both survive; same rule on
    // same line must collapse. Hard to force a same-line dup naturally, so we
    // just assert no duplicate (line, rule) pairs are ever returned.
    const src = 'def f(x=[], y={}):\n    return x';
    const hits = findPythonEdgeCases('app/x.py', src);
    const keys = hits.map((h) => `${h.line}|${h.rule}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
