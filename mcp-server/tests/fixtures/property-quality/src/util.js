// FIXTURE — module with runtime invariants + type guards.

import assert from 'node:assert';

export function sortNumbers(arr) {
  // type guard
  if (!Array.isArray(arr)) throw new TypeError('expected array');
  // runtime invariant: every element must be a number
  for (const x of arr) {
    if (typeof x !== 'number') throw new TypeError('expected number');
  }
  const sorted = [...arr].sort((a, b) => a - b);
  assert.ok(sorted.length === arr.length, 'sort must preserve length');
  return sorted;
}

export function isStringy(v) {
  return typeof v === 'string';
}

export function isErrorOf(v, Cls) {
  return v instanceof Cls;
}
