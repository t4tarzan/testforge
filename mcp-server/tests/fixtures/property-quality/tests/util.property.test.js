// FIXTURE — uses fast-check property tests against sortNumbers.
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { sortNumbers } from '../src/util.js';

describe('sortNumbers', () => {
  it('length invariant', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        return sortNumbers(arr).length === arr.length;
      }),
    );
  });

  it('sortedness invariant', () => {
    fc.assert(
      fc.property(fc.array(fc.integer()), (arr) => {
        const out = sortNumbers(arr);
        for (let i = 1; i < out.length; i++) {
          if (out[i] < out[i - 1]) return false;
        }
        return true;
      }),
    );
  });
});
