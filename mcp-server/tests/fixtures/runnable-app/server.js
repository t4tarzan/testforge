// Minimal zero-dependency HTTP server used as a /simulate "runnable" fixture.
// It binds 0.0.0.0 so the sandbox's health probe + autocannon load can reach it
// through the mapped port, and answers fast on a few GET routes so the load
// phase produces real throughput/latency numbers (not a static fallback).
const http = require('node:http');

const PORT = Number(process.env.PORT) || 3000;

// A touch of CPU per request so the load phase shows a real latency curve under
// concurrency instead of an unrealistically flat ~0ms response.
function work() {
  let acc = 0;
  for (let i = 0; i < 2000; i++) acc += Math.sqrt(i);
  return acc;
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  if (url === '/api/echo') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ echo: true, ts: req.headers['x-ts'] || null }));
  }
  // Baseline route — the load phase always drives '/'.
  work();
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end('<!doctype html><title>runnable-app</title><h1>TestForge runnable fixture</h1>');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`runnable-app listening on 0.0.0.0:${PORT}`);
});
