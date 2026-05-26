// Caller for the CJS db-helper module. Both the destructured-import and
// the namespace forms should trigger cross-file taint findings.

const express = require('express');
const { runQuery, buildAndQuery } = require('./helpers/db-helper');
const dbHelpers = require('./helpers/db-helper');

const app = express();

app.get('/products/:id', (req, res) => {
  // SQL injection through destructured cross-file helper.
  runQuery('SELECT * FROM products WHERE id = ' + req.params.id);
  res.json({ ok: true });
});

app.get('/orders', (req, res) => {
  // SQL injection through cross-file helper that uses an intermediate
  // variable on the way to the sink.
  buildAndQuery(req.query.id);
  res.json({ ok: true });
});

app.get('/ns/:id', (req, res) => {
  // SQL injection through namespace-style cross-file helper.
  dbHelpers.runQuery('SELECT * FROM widgets WHERE id = ' + req.params.id);
  res.json({ ok: true });
});

app.listen(0);
