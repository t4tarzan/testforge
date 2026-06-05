// TestForge web app (repo/dist) on the hub — Mirror OS Phase 1, the 4th piece.
// Serves the full Vite SPA (the /full whitepaper reports + gradient cards) and
// proxies its backend calls to the local mcp-server (127.0.0.1:9990), so local
// runs render at the SAME fidelity as testforge.run. Zero deps.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.TESTFORGE_WEB_PORT) || 9991;
const MCP = { host: '127.0.0.1', port: Number(process.env.TESTFORGE_MCP_PORT) || 9990 };
const DIST = '/Users/whitenoise-oc/testforge/repo/dist';

// Backend paths proxied straight through to the MCP.
const PROXY = ['/clone-and-analyze', '/analyze', '/generate-and-run', '/simulate',
  '/status', '/config', '/dimension-meta.json', '/health', '/report-view', '/reports', '/test'];
// /api/* the web app calls → mapped to MCP routes (or stubbed; no local Neon).
const API_MAP = { '/api/generate-and-run': '/generate-and-run', '/api/analyze': '/analyze' };
const API_STUB = ['/api/save-results', '/api/history', '/api/reports'];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function proxy(req, res, mcpPath) {
  const opt = { host: MCP.host, port: MCP.port, path: mcpPath, method: req.method, headers: { ...req.headers, host: `${MCP.host}:${MCP.port}` } };
  const up = http.request(opt, (r) => { res.writeHead(r.statusCode || 502, r.headers); r.pipe(res); });
  up.on('error', (e) => { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'mcp unreachable', detail: e.message })); });
  req.pipe(up);
}

function serveStatic(res, urlPath) {
  let f = path.join(DIST, urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath));
  if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { // SPA fallback
      const idx = path.join(DIST, 'index.html');
      return fs.readFile(idx, (e, buf) => { if (e) { res.writeHead(404); res.end('not found'); } else { res.writeHead(200, { 'content-type': 'text/html' }); res.end(buf); } });
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
}

http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (API_STUB.some((p) => u.startsWith(p))) { res.writeHead(u.startsWith('/api/reports') ? 404 : 200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(u.startsWith('/api/history') ? { runs: [] } : { ok: true, local: true })); }
  for (const [api, mcp] of Object.entries(API_MAP)) if (u === api || u.startsWith(api + '/')) return proxy(req, res, mcp + u.slice(api.length));
  if (PROXY.some((p) => u === p || u.startsWith(p + '/'))) return proxy(req, res, req.url);
  serveStatic(res, u);
}).listen(PORT, () => console.log(`[testforge-web] serving ${DIST} on :${PORT}, MCP→:${MCP.port}`));
