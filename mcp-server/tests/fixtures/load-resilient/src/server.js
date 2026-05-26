// FIXTURE — resilient under load. All the patterns wired in correctly.

const express = require('express');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const Redis = require('ioredis');
const { Pool } = require('pg');
const CircuitBreaker = require('opossum');

const app = express();

// Rate limiting — real middleware registration
app.use(rateLimit({ windowMs: 60_000, max: 100 }));

// Compression — real middleware registration
app.use(compression());

// Connection pool
const pool = new Pool({ max: 20, idleTimeoutMillis: 30_000 });
const redis = new Redis();

// Health check — orchestrator-friendly
app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

// Real timeout on server
const server = app.listen(0);
server.timeout = 30_000;

// Real cache call
async function getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const row = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  await redis.set(`user:${id}`, JSON.stringify(row));
  return row;
}

// Circuit breaker around external call
const fetchExternalBreaker = new CircuitBreaker(async (url) => fetch(url), {
  timeout: 5000, errorThresholdPercentage: 50, resetTimeout: 30_000,
});

app.get('/users/:id', async (req, res) => {
  const u = await getUser(req.params.id);
  res.json(u);
});

app.get('/external', async (req, res) => {
  const r = await fetchExternalBreaker.fire('https://example.com');
  res.json(r);
});
