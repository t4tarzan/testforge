// CJS helper module. `runQuery` funnels its argument into a SQL sink.
// The caller in cross-file-cjs.js must be flagged at the call site.

function runQuery(q) {
  return db.query(q);
}

function buildAndQuery(id) {
  // Intermediate variable on the way to the sink — Phase 4a intra-procedural
  // taint inside the helper must still mark `id` as a sink param.
  const sql = 'SELECT * FROM orders WHERE id = ' + id;
  return db.query(sql);
}

module.exports = { runQuery, buildAndQuery };
