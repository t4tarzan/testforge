// FIXTURE — contains deliberate vulnerabilities for analyzer tests.
// Not for execution. Do not import outside tests.
const express = require('express');
const app = express();

// SQL injection — string-concatenated query (security-analyzer should flag).
app.get('/users/:id', (req, res) => {
  const query = 'SELECT * FROM users WHERE id = ' + req.params.id;
  db.query(query, (err, rows) => res.json(rows));
});

// NoSQL $where injection (security-analyzer should flag).
app.post('/search', (req, res) => {
  db.collection('users').find({ $where: 'this.name == "' + req.body.name + '"' });
});

// XSS — eval() with user input.
app.get('/run', (req, res) => {
  const result = eval(req.query.code);
  res.send(result);
});

// XSS — unsanitized user input echoed in response.
app.get('/echo', (req, res) => {
  res.send(req.query.message);
});

// Sensitive data exposure — password in response.
app.get('/me', (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, password: req.user.password });
});

// Hardcoded secret.
const API_KEY = 'sk_live_4242deadbeef';

app.listen(3000);
