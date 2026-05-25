// FIXTURE — parameterized queries, sanitized output, secrets via env.
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

function requireAuth(req, res, next) {
  if (!req.headers.authorization) return res.status(401).end();
  next();
}

// Parameterized query — no string concat.
app.get('/users/:id', requireAuth, (req, res) => {
  db.query('SELECT id, name, email FROM users WHERE id = $1', [req.params.id], (err, rows) =>
    res.json(rows)
  );
});

// Output is the trusted user record minus sensitive fields.
app.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name });
});

const API_KEY = process.env.API_KEY;

app.listen(3000);
