// BAD — weak-assertion-dominated. A mutation that changes 42→41 still passes.
import { describe, it, expect } from 'vitest';
import { add, divide } from '../src/math.js';

describe('add (weakly tested)', () => {
  it('returns truthy', () => {
    expect(add(1, 2)).toBeTruthy();
  });
  it('returns defined', () => {
    expect(add(1, 2)).toBeDefined();
  });
  it('returns not null', () => {
    expect(add(1, 2)).not.toBeNull();
  });
});

describe('divide (weakly tested)', () => {
  it('returns truthy', () => {
    expect(divide(10, 2)).toBeTruthy();
  });
  it('returns defined', () => {
    expect(divide(10, 2)).toBeDefined();
  });
});
