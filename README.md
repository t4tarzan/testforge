# 🧪 TestForge — AI CODE? Run TestForge!

> **21-dimension AI-powered testing. Drop any repo URL. Get a full report in under 2 seconds.**

[![Website](https://img.shields.io/badge/testforge.run-574a7d)](https://testforge.run)
[![npm](https://img.shields.io/badge/npm-%40whitenoisenpm%2Ftestforge--mcp-574a7d)](https://www.npmjs.com/package/@whitenoisenpm/testforge-mcp)
[![CI](https://img.shields.io/badge/CI-passing-22c55e)](https://github.com/t4tarzan/testforge/actions)
[![License](https://img.shields.io/badge/license-BUSL--1.1-blue)](LICENSE)

---

## 🚀 Try It

**Web (managed):** https://testforge.run — drop any public GitHub repo URL, get a 21-dimension report.

**Local (MCP) — one command, no cloud, no sign-up:**
```bash
npx @whitenoisenpm/testforge-mcp@latest serve
open http://localhost:33221
```
Dashboard accepts a local project path **or** a GitHub URL. The npm package ships `better-sqlite3` prebuilt for macOS/Linux/Windows, so the SQLite engine that backs `~/.testforge/history.db` installs with zero native-build steps. Your source code never leaves the machine.

### 🎬 30-second walkthrough — fully offline

<p align="center">
  <a href="https://github.com/t4tarzan/testforge/raw/main/public/demos/testforge-mcp-demo.mp4">
    <img src="https://raw.githubusercontent.com/t4tarzan/testforge/main/public/demos/local-mcp-poster.jpg" alt="Local MCP demo — paste a path, click Run, see a 12-dimension report" width="720" />
  </a>
  <br />
  <em>One <code>npx</code> command installs the package + bundled SQLite engine. Paste a local path or GitHub URL, click <strong>Run Full Analysis</strong>, get a 12-dimension report. Every byte stays on your machine — results persist to <code>~/.testforge/history.db</code>.</em>
</p>

---

## 📊 What We Analyze (21 dimensions)

| Category | Dimensions | Detection method |
|---|---|---|
| **Code Quality** | Security (SAST), Unit Tests, Load/Perf, Accessibility | Babel AST + taint tracking |
| **API** | Contract testing (OpenAPI cross-ref), Visual regression | AST + YAML parsing |
| **Advanced** | Edge cases, Property-based, Chaos, Mutation, Predictive | AST + cross-signal aggregation |
| **Strategic** | Vision & goals, Scope coverage, Stack analysis | Strict dep-name sets + tsconfig parse |
| **Enterprise** | Agentic-scale, DORA, Supply chain (lockfile), N+1 queries, Dead code, License (SPDX), OWASP | AST + package-lock parse + node_modules walk |

Tier-1 analyzers are deterministic — same input always produces the same output. No LLM calls, no `Math.random()`. Every dimension shipped substantive AST-based depth in v0.6.0 → v0.24.0 (16 deepening passes; see the [mcp-server changelog](./mcp-server/README.md)). **Tier 2 (v0.25.0)** layers LLM-generated Vitest tests + sandbox execution on top — separate path, optional, BYOK on self-host. **v0.26.0** closes the polyglot blind spot: Python (FastAPI / Flask / Django / pytest) is now native alongside JS/TS, and the dashboard surfaces a `languageCoverage` banner instead of pretending "0 endpoints" means "no endpoints" on repos written in languages we don't parse yet.

### 🆕 Recent work (2026-05-28)

Shipped **30 npm releases** (`0.6.0 → 0.28.4`) covering:

- **Spine (phases 4a/4b/4c)** — intra-file → cross-file taint propagation + user-authored rules DSL (`.testforge/rules.yaml`)
- **16 deepening passes** across all 21 dimensions: substring-matching → AST analysis. Substring traps fixed across the board (e.g. `dep.includes('vite')` no longer matches `vitest`)
- **Tier 2** (`0.25.0 → 0.25.2`) — LLM-generated Vitest + sandboxed Docker execution, runner image auto-pulled from GHCR
- **Python support** (`0.26.0`) — FastAPI/Flask/Django routes detected, `requirements.txt` + `pyproject.toml` parsed, pytest counted, `languageCoverage` honesty banner for everything else
- **Monorepo recursion** (`0.26.1`) — uv workspaces + npm/yarn/bun/pnpm workspaces + PEP 735 `[dependency-groups]` + a string-aware TOML array parser that fixes silent truncation on entries like `"fastapi[standard]"`
- **Conventional-monorepo recursion** (`0.26.2`) — also globs `libs/*`, `packages/*`, `apps/*`, `services/*` for `pyproject.toml` / `package.json` / `requirements.txt`. Caught by the In-the-Wild showcase: LangChain went from `deps: 0` to `27 + 66 dev-deps` once we followed `libs/<pkg>/pyproject.toml` even with no workspace declaration at root.
- **Test-path security suppression** (`0.27.0`) — per-file SAST findings in `tests/`, `__tests__/`, `e2e/`, `cypress/`, `playwright/`, `*.test.*`, `*.spec.*`, `test_*.py`, `*_test.py`, `.d.ts` paths are dropped (the patterns we flag are usually intentional in tests). Caught by the In-the-Wild showcase: Supabase went from 125 "critical" findings to a trustworthy small number that reflects production code only.
- **Rate-limit check only fires on web apps** (`0.27.1`) — `checkMissingRateLimit` now gates on a `WEB_FRAMEWORK_DEPS` set (Express/Fastify/Hono/Next/etc. + FastAPI/Flask/Django/Starlette/etc.). Caught by the In-the-Wild LangChain report: pure Python library got pestered about missing rate limiting it can't possibly need.
- **127 → 0** ESLint errors with CI gate now blocking
- **30 → 179** vitest tests (6×)

Full per-pass detail in [`mcp-server/README.md` changelog](./mcp-server/README.md#changelog-highlights).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Vercel — Frontend + 22 API routes (testforge.run)      │
│  React 19 + Vite + Tailwind + shadcn/ui                  │
│                                                          │
│  Auth:  GitHub OAuth → tf_session JWT cookie (httpOnly)  │
│  Edge:  CORS allowlist, X-Request-Id, Upstash rate-limit │
│  Data:  Neon Postgres via Drizzle ORM                    │
└────────────────────────────┬─────────────────────────────┘
                             │
                             │  /api/analyze passes through
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Fly.io — MCP Server (testforge-mcp.fly.dev)             │
│  Fastify + TypeScript, 8 analyzer modules                │
│  Same analyzers as the npm-published @whitenoisenpm/     │
│  testforge-mcp package.                                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Local MCP (npm package, default port 33221)             │
│  npx @whitenoisenpm/testforge-mcp@latest serve           │
│  SQLite at ~/.testforge/history.db (WAL mode)            │
│  🔒 No outbound calls except git clone + npm registry    │
└──────────────────────────────────────────────────────────┘
```

---

## 🔐 Security model

- **Auth:** GitHub OAuth only. The callback mints a 30-day HS256 JWT and sets it as an `httpOnly`, `secure`, `sameSite=Lax` cookie named `tf_session`. Frontend never sees the token. Anonymous requests to user-scoped routes return `401`, not seed data.
- **CORS:** Allowlist enforced via `Vary: Origin` + origin reflection. Allowed: `https://testforge.run`, `*.vercel.app` preview deployments, and `localhost` dev ports. Anything else gets `403 "Origin not allowed"`.
- **Rate limit:** Sliding window via Upstash Redis (`@upstash/ratelimit`). Default 60 req/min/IP. Falls back to in-memory with a console warning when Upstash isn't configured.
- **Request id:** Every API response carries `X-Request-Id` (echoes Vercel's id when present). Logged with every line via the structured JSON logger — search Vercel logs by `rid:` for correlation.
- **Stripe webhook:** Signature verified against the raw request body (`bodyParser: false`). Idempotent — duplicate event IDs return `200 {duplicate:true}` via a `stripe_events` PK conflict.
- **Secrets posture:** all credentials live in Vercel project env. `.gitignore` covers `.env`, `.env*`, `.vercel`, `.secure/`.

---

## 📦 Quick Start

### Use the managed service
```
open https://testforge.run
```
Sign in with GitHub. Click "Managed", paste a repo URL.

### Run the MCP locally
```bash
# IDE integration (Cursor / VS Code / Windsurf / Claude Desktop)
npx @whitenoisenpm/testforge-mcp@latest install

# Or boot the standalone server
npx @whitenoisenpm/testforge-mcp@latest serve
# Dashboard: http://localhost:33221
```

Port override: `TESTFORGE_MCP_PORT=9000 npx ...`. SQLite path: `~/.testforge/history.db`.

### Self-host the analyzer (Fly.io)
```bash
git clone https://github.com/t4tarzan/testforge
cd testforge/mcp-server && flyctl launch --now
```

---

## 🛠️ Local Development

```bash
git clone https://github.com/t4tarzan/testforge && cd testforge
npm install
npm run dev     # frontend + api on http://localhost:9999

# In another terminal:
cd mcp-server && npm install && npm run dev   # analyzer on :33221
```

Environment variables: copy `.env.example` to `.env`. The required ones to run anything authenticated are `DATABASE_URL`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. See `RUNBOOK.md` for the full launch checklist.

---

## 💰 Pricing

| Plan | Price | Tests/Month | Repos | Key Features |
|------|-------|-------------|-------|-------------|
| **Free** | $0 | 5 | 1 | All 21 dimensions, public repos |
| **Pro** | $29/mo | 100 | 10 | Private repos, CI/CD webhooks, Slack/Discord |
| **Enterprise** | $199/mo | Unlimited | Unlimited | SSO, SLA, dedicated support, custom integrations |

---

## 🔌 API Reference

Full API docs at [testforge.run/#/docs](https://testforge.run/#/docs). Quick reference:

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | none | DB ping + version |
| GET | `/api/status` | none | All-services rollup (parallel checks) |
| GET | `/api/badge?score=N` | none | SVG badge for README embedding |
| GET | `/api/auth/callback` | none | OAuth start + callback; sets `tf_session` cookie |
| GET | `/api/auth/me` | cookie | Current user; 401 if not signed in |
| POST | `/api/auth/logout` | cookie | Clears `tf_session` |
| POST | `/api/analyze` | none | Proxies to Fly.io MCP; 502/504 on upstream failure (no fake fallback) |
| GET | `/api/projects` | cookie | User's projects |
| GET | `/api/history` | cookie | User's test runs |
| GET | `/api/reports/:id` | cookie | One report; 404 (not seed) when missing |
| POST | `/api/save-results` | cookie | Persist an analysis run |
| GET/POST/DELETE | `/api/keys` | cookie | API key CRUD |
| GET/POST | `/api/gate` | cookie | Plan quota — usage from real `test_runs` counts |
| GET/POST | `/api/stripe` | cookie (POST) | Checkout session |
| POST | `/api/stripe-webhook` | Stripe signature | Idempotent via `stripe_events` table |
| POST | `/api/webhook` | none | GitHub CI/CD webhook (notify/Slack/Discord) |

All responses include `X-Request-Id` and rate-limit headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`).

---

## 🧪 Tests & CI

```bash
# Frontend + API E2E (Playwright)
npx playwright test
# Set BASE_URL=https://<preview>.vercel.app to run against a preview.

# Analyzer integration tests (vitest, against fixture projects)
cd mcp-server && npm test
```

CI runs on every PR via `.github/workflows/ci.yml`:

- **Lint + build** — blocking. `tsc -b && vite build`.
- **Analyzer tests** — blocking. `vitest run` against `mcp-server/tests/fixtures/{vulnerable,clean}-app`.
- **Playwright (preview URL)** — blocking. Pulls the PR's Vercel preview URL, sends requests with the `x-vercel-protection-bypass` header so Vercel's SSO doesn't gate the run.

The bypass requires `VERCEL_AUTOMATION_BYPASS_SECRET` set as a GitHub Actions secret (mirroring Vercel's project-level "Protection Bypass for Automation"). See `.github/workflows/ci.yml` for the full setup steps.

---

## 📁 Project Structure

```
testforge/
├── api/                    # Vercel serverless functions
│   ├── _security.js        # withSecurity wrapper: CORS allowlist, rate limit, security headers, request-id, error catch
│   ├── _session.js         # jose-based HS256 JWT cookie, requireSession helper
│   ├── _env.js             # requireEnv() — typed env contract with clear missing-var errors
│   ├── _log.js             # JSON-line structured logger with per-request rid
│   ├── auth/               # callback, me, logout
│   ├── reports/[id].js     # single report; 404 (not seed) when missing
│   └── ...                 # analyze, projects, history, keys, gate, stripe, …
├── mcp-server/             # Fly.io / npm-published MCP server
│   ├── src/
│   │   ├── analyzers/      # 8 modules covering 21 dimensions
│   │   ├── local-db.ts     # SQLite via better-sqlite3
│   │   ├── mcp-server.ts   # /test, /quick-scan with SQLite persistence
│   │   └── index.ts        # Fastify app, port 33221
│   └── tests/
│       ├── analyzers.test.ts   # vitest against real fixtures
│       └── fixtures/{vulnerable,clean}-app/
├── src/                    # React 19 frontend (Vite)
│   ├── pages/              # 15 page components (HashRouter)
│   ├── context/AuthContext.tsx  # Hydrates from /api/auth/me cookie
│   └── db/schema.ts        # Drizzle ORM (8 tables, FK cascade)
├── drizzle/                # Generated migration baseline
├── scripts/
│   ├── migrate-to-v1.sql   # Idempotent one-shot to bring an existing Neon DB up to v1
│   ├── wrap-handlers.js    # Codemod that wraps every api/*.js with withSecurity
│   └── smoke.sh            # 10-assertion post-deploy smoke test
├── e2e/                    # Playwright E2E suite
├── RUNBOOK.md              # Pre-launch checklist + incident playbooks
└── LOG.md                  # Original build log
```

---

## 🏆 Built With

React 19 · TypeScript · Vite · Tailwind · shadcn/ui · Fastify · Neon Postgres · Drizzle ORM · Fly.io · Vercel · Stripe · Upstash Redis · jose · Playwright · Vitest · GSAP · Recharts · Framer Motion · better-sqlite3

---

## 📄 License

BUSL-1.1 — Free for non-production use and self-hosting. Commercial managed service requires a paid plan at [testforge.run](https://testforge.run).
