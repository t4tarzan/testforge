// FIXTURE — nothing resilience-related wired.

const express = require('express');
const app = express();

// No SIGTERM listener. No global error handler. No retry.
// The comment below mentions "SIGTERM" and "graceful shutdown" — the
// old substring-based check would have falsely concluded those
// patterns existed. AST analysis must NOT be fooled.
// SIGTERM SIGINT graceful shutdown timeout AbortController

app.get('/data', async (req, res) => {
  const r = await fetch('https://example.com'); // no retry, no timeout
  res.json(await r.json());
});

app.listen(0);
