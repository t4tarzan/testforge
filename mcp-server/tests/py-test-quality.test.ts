import { describe, it, expect } from 'vitest';
import { findPythonTestQuality } from '../src/analyzers/lib/py-test-quality.js';
import { pythonAvailable } from '../src/analyzers/lib/py-edge-cases.js';
const PY = pythonAvailable();

describe.skipIf(!PY)('findPythonTestQuality', () => {
  it('classifies assert / assertionless / skipped / empty pytest functions', () => {
    const src = [
      'import pytest',
      'def test_good():',
      '    assert add(1, 2) == 3',
      'def test_assertionless():',
      '    result = add(1, 2)',
      '    print(result)',
      '@pytest.mark.skip(reason="wip")',
      'def test_skipped():',
      '    assert False',
      'def test_empty():',
      '    pass',
    ].join('\n');
    const q = findPythonTestQuality(src);
    expect(q.total).toBe(4);
    expect(q.skipped).toBe(1);
    expect(q.empty).toBe(1);
    expect(q.assertionless).toBe(2); // assertionless + empty
  });
  it('unittest self.assertEqual + pytest.raises count as assertions', () => {
    const src = [
      'import unittest, pytest',
      'class TestThing(unittest.TestCase):',
      '    def test_eq(self):',
      '        self.assertEqual(1, 1)',
      '    def test_raises(self):',
      '        with pytest.raises(ValueError):',
      '            boom()',
    ].join('\n');
    const q = findPythonTestQuality(src);
    expect(q.total).toBe(2);
    expect(q.assertionless).toBe(0);
  });
});
