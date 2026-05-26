// FIXTURE — vulnerable patterns that the AST analyzer must flag.
// One representative per category; the tests check both presence
// (it was flagged) and shape (confidence, severity).

const express = require('express');
const fs = require('fs');
const { execSync } = require('child_process');
const app = express();

// ── SQL injection via intermediate variable (intra-procedural taint) ──
app.get('/search', (req, res) => {
  const q = "SELECT * FROM products WHERE name LIKE '%" + req.query.q + "%'";
  db.query(q, (e, rows) => res.json(rows));
});

// ── SQL injection via template literal ──
app.get('/orders/:id', (req, res) => {
  const r = db.query(`SELECT * FROM orders WHERE id = ${req.params.id}`);
  res.json(r);
});

// ── eval with request input ──
app.post('/exec', (req, res) => {
  res.send(eval(req.body.code));
});

// ── child_process.exec with concatenation ──
app.post('/shell', (req, res) => {
  execSync('ls ' + req.body.dir, (e, out) => res.send(out));
});

// ── Path traversal via fs.readFile ──
app.get('/file', (req, res) => {
  fs.readFile('./uploads/' + req.query.name, (e, buf) => res.send(buf));
});

// ── Open redirect ──
app.get('/go', (req, res) => {
  res.redirect(req.query.url);
});

// ── XSS via res.send with req input ──
app.get('/say', (req, res) => {
  res.send('<h1>' + req.query.greeting + '</h1>');
});

// ── Sensitive field in res.json ──
app.get('/whoami', (req, res) => {
  res.json({ id: req.user.id, refresh_token: req.user.refresh_token });
});

// ── CORS wildcard with credentials ──
const cors = require('cors');
app.use(cors({ origin: '*', credentials: true }));

// ── Hardcoded named secret ──
const api_key = 'sk_live_4242BogusBogusBogus42';

app.listen(3000);
