// GOOD — varied strong matchers.
import { describe, it, expect } from 'vitest';
import { add, divide } from '../src/math.js';

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
  it('handles negative numbers', () => {
    expect(add(-1, -2)).toEqual(-3);
  });
});

describe('divide', () => {
  it('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });
  it('throws on zero', () => {
    expect(() => divide(1, 0)).toThrow('div by zero');
  });
  it('returns the right type', () => {
    expect(divide(4, 2)).toBeInstanceOf(Number); // intentionally wrong but illustrates strong matcher
  });
});
