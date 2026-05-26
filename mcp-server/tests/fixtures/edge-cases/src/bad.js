// FIXTURE — every edge-case rule should fire on this file.

function parseId(s) {
  // parseInt without radix
  return parseInt(s);
}

function parseConfig(input) {
  // JSON.parse outside try/catch
  const cfg = JSON.parse(input);
  return cfg;
}

function dateFromQuery(query) {
  // new Date() on a non-literal string
  return new Date(query.timestamp);
}

function maybeEqual(a, b) {
  // Loose equality (not == null)
  return a == b;
}

function checkValue(x) {
  // Number() coercion without isNaN check
  return Number(x) * 2;
}

function colorFor(kind) {
  // switch without default
  switch (kind) {
    case 'critical': return 'red';
    case 'warning':  return 'yellow';
    case 'info':     return 'blue';
  }
}
