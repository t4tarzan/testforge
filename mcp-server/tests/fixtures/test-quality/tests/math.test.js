// FIXTURE — mix of healthy and unhealthy test patterns.
import { describe, it, expect } from 'vitest';
import { add, subtract } from '../src/math.js';

describe('add', () => {
  // GOOD — has an assertion.
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  // BAD — no assertion inside; this test passes trivially.
  it('runs add without crashing', () => {
    add(2, 3);
  });

  // BAD — empty body.
  it('TODO: handle negative numbers', () => {});

  // BAD — focused. Will cause CI to skip siblings in some runners.
  it.only('add(0,0) is 0', () => {
    expect(add(0, 0)).toBe(0);
  });

  // BAD — skipped, accumulating rot.
  it.skip('handles very large numbers', () => {
    expect(add(1e20, 1)).toBe(1e20 + 1);
  });

  // BAD — another skipped one (triggers the 2+ skipped findings).
  it.skip('handles infinity', () => {});
});

describe('subtract', () => {
  it('subtracts two numbers', () => {
    expect(subtract(5, 2)).toBe(3);
  });
});
