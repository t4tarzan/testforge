// USED — referenced by other-file.js
export function publicUsed(x) {
  return x + 1;
}

// USED — referenced via subpath import elsewhere
import { get } from 'lodash/get';
export function withLodash(obj, path) {
  return get(obj, path);
}

// DEAD — exported but no other file references the name `internalDead`.
export function internalDead() {
  return 'I am exported and forgotten';
}

// DEAD — same
export const FORGOTTEN_CONSTANT = 42;
