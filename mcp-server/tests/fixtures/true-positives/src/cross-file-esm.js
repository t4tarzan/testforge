// ESM caller. Uses named imports from redirect-helper.js. Both
// open-redirect and XSS via helper should fire at the call site.

import express from 'express';
import { safelyRedirect, echoBack } from './helpers/redirect-helper.js';

const app = express();

app.get('/go', (req, res) => {
  // Open redirect via cross-file ESM helper.
  safelyRedirect(res, req.query.next);
});

app.get('/echo', (req, res) => {
  // XSS via cross-file ESM helper.
  echoBack(res, req.query.msg);
});

app.listen(0);
