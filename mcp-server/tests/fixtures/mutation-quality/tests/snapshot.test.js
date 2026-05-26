// BAD — snapshot-only test file.
import { describe, it, expect } from 'vitest';
import { add, divide } from '../src/math.js';

describe('math (snapshot only)', () => {
  it('add', () => {
    expect(add(1, 2)).toMatchSnapshot();
  });
  it('divide', () => {
    expect(divide(10, 2)).toMatchInlineSnapshot();
  });
  it('add again', () => {
    expect(add(5, 5)).toMatchSnapshot();
  });
});
