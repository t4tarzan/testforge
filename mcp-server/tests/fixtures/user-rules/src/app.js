// FIXTURE — every line below is intentionally a trigger for the
// user-authored rules in .testforge/rules.yaml.

const express = require('express');
const app = express();

app.get('/users/:id', (req, res) => {
  // Rule: no-internal-unsafe-query (callee-only)
  internalApi.unsafeQuery('SELECT * FROM users WHERE id = ' + req.params.id);

  // Rule: no-tainted-debug-log (callee + taintedArg=0)
  debugLog(req.body.email);

  // Rule: no-secret-keys-in-storage (callee + argRegex index 0 matching /token/i)
  localStorage.setItem('auth_token', 'abc123');

  // These calls SHOULD NOT fire any user rule:
  internalApi.query('SELECT * FROM users WHERE id = $1', [req.params.id]); // safe alternative
  debugLog('startup complete');                                            // arg not tainted
  localStorage.setItem('theme', 'dark');                                   // arg doesn't match regex

  res.json({ ok: true });
});

app.listen(0);
