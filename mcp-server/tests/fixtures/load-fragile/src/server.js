// FIXTURE — fragile under load. None of the patterns wired.

const express = require('express');
const fs = require('fs');
const axios = require('axios');

const app = express();

// BAD: sync fs read INSIDE a route handler — blocks the event loop
app.get('/config', (req, res) => {
  const config = fs.readFileSync('/etc/app/config.json', 'utf-8');
  res.json(JSON.parse(config));
});

// BAD: external API call with no timeout and no circuit breaker
app.get('/external', async (req, res) => {
  const data = await axios.get('https://example.com/api/data');
  res.json(data.data);
});

// BAD: another sync I/O in a handler
app.post('/upload-meta', (req, res) => {
  fs.writeFileSync('/tmp/last-upload.json', JSON.stringify(req.body));
  res.json({ ok: true });
});

// Note the comments mention `rateLimit` and `cache` as words — the
// previous substring-based check would have falsely concluded those
// patterns were present. AST-based detection must NOT be fooled.
// "rateLimit", "cache", "compression", "Pool"

app.listen(0);
