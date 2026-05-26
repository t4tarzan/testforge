// FIXTURE — safe code that naive regex SAST falsely flags as vulnerable.
// The AST analyzer must report zero findings against this file.

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db');
const app = express();

app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 60 }));

// 1. PostgreSQL parameter placeholders ($1, $2) — SAFE.
//    Regex that flags any `$` near a query would false-positive here.
app.get('/users/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, name, email FROM users WHERE id = $1 AND tenant_id = $2',
    [req.params.id, req.user.tenantId]
  );
  res.json(result.rows);
});

// 2. Template literal with constants — no interpolation of variables.
const SAFE_QUERY = `
  SELECT id, name FROM users
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
`;
app.get('/active-users', requireAuth, async (_req, res) => {
  const r = await pool.query(SAFE_QUERY);
  res.json(r.rows);
});

// 3. eval used in a *constant string* (e.g. a legitimate parser).
//    No req.* involvement → analyzer flags as Dangerous Functions but
//    with medium confidence; the analyzer correctly does NOT flag it as
//    user-input RCE.
const evaluateMath = (expr) => Function(`return (${String(expr)})`)();
//    ^^ Note: this IS still flagged (rightly) as Function() ctor — keeping
//    the pattern here is intentional to show the analyzer fires on the real
//    risk (string-to-code) regardless of input source.

// 4. Object with a "password" key — but for *validation*, not response.
function validateLoginPayload(input) {
  if (!input.password || input.password.length < 8) {
    return { valid: false, error: 'password too short' };
  }
  return { valid: true };
}

// 5. Hardcoded string that LOOKS like a key but is a constant fixture / format.
const SUPPORTED_PREFIXES = ['sk-test', 'sk-live'];
const PLACEHOLDER_KEY_FORMAT = 'sk-XXXXXXXXXXXXXXXX'; // not a real secret

// 6. innerHTML assigned from a trusted constant — not user input.
function buildLoader(target) {
  target.innerHTML = '<div class="loader">Loading…</div>';
}

// 7. CORS with explicit allowlist — the AST shape `origin: function/array`
//    is safe.
const ALLOWED = ['https://app.example.com', 'https://admin.example.com'];
const cors = require('cors');
app.use(
  cors({
    origin: (origin, cb) => cb(null, ALLOWED.includes(origin)),
    credentials: true,
  })
);

// 8. dangerouslySetInnerHTML with a *sanitized* value (well, ostensibly).
//    The AST analyzer flags only when the expression reads from req.*
//    or otherwise looks untrusted. A pure constant is safe.
function StaticHtml() {
  return {
    type: 'div',
    props: { dangerouslySetInnerHTML: { __html: '<strong>Static</strong>' } },
  };
}

function requireAuth(_req, _res, next) {
  next();
}

app.listen(3000);
