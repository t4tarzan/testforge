// FIXTURE — code that uses *recognized sanitizers* between tainted source
// and dangerous sink. The taint engine should mark these as medium-
// confidence (path observed, sanitizer wrapping it) or skip emitting
// entirely when the sanitizer is appropriate for the sink type.
//
// The Phase-2 contract: a SANITIZED tainted value never produces a
// `confidence: 'high'` finding. Tests assert on confidence, not just
// presence.

const DOMPurify = require('dompurify');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const fs = require('fs');
const express = require('express');
const app = express();

// 1. eval with parseInt — output is a number, not user-supplied code.
//    Numeric coercion is a recognized "sanitizer" for code-injection contexts.
app.post('/calc', (req, res) => {
  const n = parseInt(req.body.value, 10);
  // not directly eval — but a contrived demonstration of coercion:
  const square = Function(`return ${Number(n)}`)();
  res.json({ square });
});

// 2. innerHTML with DOMPurify.sanitize — the canonical safe pattern.
function renderUserBio(el, req) {
  el.innerHTML = DOMPurify.sanitize(req.body.bio);
}

// 3. dangerouslySetInnerHTML with sanitize-html.
function UserBio({ req }) {
  return {
    type: 'div',
    props: { dangerouslySetInnerHTML: { __html: sanitizeHtml(req.body.bio) } },
  };
}

// 4. fs.readFile with path.normalize — not perfect, but recognized as
//    a sanitizer that downgrades to medium confidence.
app.get('/file', (req, res) => {
  const cleaned = path.normalize(req.query.name);
  fs.readFile('./uploads/' + cleaned, (e, buf) => res.send(buf));
});

// 5. res.redirect with allowlist check — the .includes() call is the
//    sanitizer signal. We accept medium confidence here.
const ALLOWED = ['/home', '/dashboard', '/settings'];
app.get('/go', (req, res) => {
  const next = req.query.next;
  if (!ALLOWED.includes(next)) return res.status(400).send('bad');
  res.redirect(ALLOWED.find((a) => a === next));
});

// 6. res.send with escape() — HTML escaping is canonical.
const escape = require('escape-html');
app.get('/greet', (req, res) => {
  res.send('<h1>Hello ' + escape(req.query.name) + '</h1>');
});

// 7. encodeURIComponent for URL building — taint is URL-safe.
app.get('/proxy', (req, res) => {
  const url = 'https://api.example.com/items?q=' + encodeURIComponent(req.query.q);
  res.send(url); // (the proxy itself would do more — this is just the encoding)
});

app.listen(0);
