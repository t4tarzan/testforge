// FIXTURE — every resilience pattern wired correctly.

const express = require('express');
const pRetry = require('p-retry');

const app = express();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, draining...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

// Process-level safety
process.on('unhandledRejection', (reason) => {
  console.error('unhandled rejection', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('uncaught exception', err);
  process.exit(1);
});

// Retry library use
app.get('/external', async (req, res) => {
  try {
    const data = await pRetry(() => fetch('https://example.com').then(r => r.json()), {
      retries: 3,
      factor: 2,
      minTimeout: 500,
    });
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: 'upstream unavailable' });
  }
});

// Payment endpoint reads Idempotency-Key
app.post('/charge', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) return res.status(400).json({ error: 'idempotency key required' });
  // ... handle charge
  res.json({ ok: true });
});

// AbortController-based cancellation
app.get('/external2', async (req, res) => {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch('https://example.com', { signal: ctrl.signal });
    res.json(await r.json());
  } catch (e) {
    res.status(504).json({ error: 'timeout' });
  }
});

// Global error handler — Express 4-arg signature
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const server = app.listen(0);
