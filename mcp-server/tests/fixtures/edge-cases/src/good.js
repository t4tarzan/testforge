// FIXTURE — well-guarded versions. NONE of these should fire.

function parseId(s) {
  return parseInt(s, 10);
}

function parseConfig(input) {
  try {
    return JSON.parse(input);
  } catch (e) {
    return null;
  }
}

function dateFromQuery(query) {
  // ISO 8601 literal — known good shape
  return new Date('2024-01-15T00:00:00Z');
}

function maybeEqual(a, b) {
  return a === b;
}

function isNullish(x) {
  return x == null;  // explicit nullish check — allowed exception
}

function checkValue(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return n * 2;
}

function colorFor(kind) {
  switch (kind) {
    case 'critical': return 'red';
    case 'warning':  return 'yellow';
    case 'info':     return 'blue';
    default:         return 'gray';
  }
}
