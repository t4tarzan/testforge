# Architecture

Back to [[TestForge]].

Three planes share **one analyzer core** (the `@whitenoisenpm/testforge-mcp`
package). Same code runs locally, on the managed server, and in CI.

```
┌─ Web (Vercel) — testforge.run ─────────────────────────────┐
│  React 19 + Vite + Tailwind. GitHub OAuth → tf_session JWT  │
│  (httpOnly cookie). Neon Postgres via Drizzle. Stripe.      │
│  /api/* serverless fns: auth, gate/quota, generate-and-run  │
│  proxy, user-llm-key (BYOK), save-results, etc.             │
└───────────────┬─────────────────────────────────────────────┘
                │ /api/generate-and-run + /api/simulate proxy
                ▼  (adds run-secret bearer; forwards BYOK key)
┌─ Managed MCP — mcp.testforge.run (a VPS, behind nginx) ─────┐
│  Fastify + TS. Same analyzers as the npm package.           │
│  Tier-2 sandbox via a locked-down docker socket-proxy.      │
└─────────────────────────────────────────────────────────────┘

┌─ Self-host MCP — npx @whitenoisenpm/testforge-mcp@latest ───┐
│  Binds localhost:33221. SQLite history at ~/.testforge.     │
│  Dashboard at /. Used directly OR as an IDE MCP server.     │
│  Code never leaves the machine.                             │
└─────────────────────────────────────────────────────────────┘
```

## Key endpoints (the MCP server)
- `POST /clone-and-analyze {repoUrl}` — **rich** Tier-1: clones (git, incl. `file://`), runs all 22 dimensions, returns per-dimension scores + findings + Kubernetes block. The reports render from this shape.
- `POST /analyze {projectPath}` — lean Tier-1 over a local path (scores, fewer findings; no kubernetes block). Predates the rich endpoint.
- `POST /generate-and-run {findings}` — [[Tier2-Sandbox]]. Gated by `TESTFORGE_RUN_SECRET` when set; honors a per-request `X-LLM-Key` (BYOK).
- `POST /simulate {repoUrl, dimensions}` — async [[Simulation-Engine]] (returns a jobId, poll for phases).
- `GET /health` — `{status, version}`.
- `GET /status` — Docker + AI-provider readiness (drives the dashboard banner).
- `GET|POST /config` — local-only settings API ([[Self-Host-and-BYOK]]).

## Request flow (managed Tier-2, the most involved)
1. Browser → `POST /api/generate-and-run` (Vercel) with a session cookie.
2. The proxy checks plan/quota (`api/_gate.js`), looks up the user's BYOK key (`api/_llm-key.js`, AES-256-GCM at rest), and forwards to the managed MCP with the run-secret bearer + (if present) `X-LLM-Key`.
3. The MCP generates tests with that key and runs them in the Docker sandbox; results flow back.

## Why the analyzer core is shared
A finding seen on the website, on a self-host run, and in a curated report is
produced by the **same code** — so scores and findings are consistent
everywhere. The web layer adds auth/billing/curation; it never re-implements
analysis. See [[Reports]] for how the three report surfaces stay identical.

## Security posture (web)
GitHub-OAuth-only sessions (HS256 JWT, httpOnly cookie); CORS allowlist; Upstash
rate-limit; Stripe webhook signature-verified; all secrets in Vercel env. The
managed MCP's Tier-2 is gated by a run secret and only reachable via the proxy;
self-host on localhost needs no secret. See [[Self-Host-and-BYOK]].
