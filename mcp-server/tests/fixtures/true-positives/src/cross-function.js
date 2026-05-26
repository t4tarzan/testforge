// FIXTURE — cross-function taint patterns. Each helper takes a tainted
// input and routes it to a real sink. The analyzer must flag the
// CALLER, not the helper itself.

const express = require('express');
const fs = require('fs');
const app = express();

// Helper that funnels its arg straight into a SQL sink.
function runQuery(q) {
  return db.query(q);
}

// Helper using a destructuring + intermediate variable (still tainted).
const lookupUser = function (id) {
  const q = 'SELECT * FROM users WHERE id = ' + id;
  return db.query(q);
};

// Arrow form: redirect helper. Should flag at the caller.
const safelyRedirect = (res, to) => res.redirect(to);

// Path helper.
function readUserFile(name) {
  return fs.readFile('./uploads/' + name, 'utf-8');
}

// XSS helper.
function send404(res, msg) {
  res.send('<h1>Not found: ' + msg + '</h1>');
}

// ─── Callers — these are the lines the analyzer must flag ──────────

app.get('/products/:id', (req, res) => {
  // SQL injection via helper
  runQuery('SELECT * FROM products WHERE id = ' + req.params.id);
  res.json({ ok: true });
});

app.get('/profile/:id', (req, res) => {
  // SQL injection via helper (uses intermediate var inside helper too)
  res.json(lookupUser(req.params.id));
});

app.get('/go', (req, res) => {
  // Open redirect via helper
  safelyRedirect(res, req.query.next);
});

app.get('/file', (req, res) => {
  // Path traversal via helper
  readUserFile(req.query.name).then((buf) => res.send(buf));
});

app.get('/notfound', (req, res) => {
  // XSS via helper
  send404(res, req.query.what);
});

app.listen(0);
