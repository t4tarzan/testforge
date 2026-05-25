# 🧪 TestForge — AI CODE? Run TestForge!

> **21-dimension AI-powered testing. Drop any repo URL. Get a full report in 30 seconds.**

[![Website](https://img.shields.io/badge/testforge.run-574a7d)](https://testforge.run)
[![npm](https://img.shields.io/badge/npm-testforge--mcp-574a7d)](https://www.npmjs.com/package/@whitenoisenpm/testforge-mcp)
[![Product Hunt](https://img.shields.io/badge/Product_Hunt-Featured-DA552F)](https://www.producthunt.com/products/testforge)
[![License](https://img.shields.io/badge/license-BUSL--1.1-blue)](LICENSE)

---

## 🚀 Try It

```
https://testforge.run
```

Paste any public GitHub repo URL → 21-dimension analysis in 30 seconds.

---

## 📊 What We Analyze (21 Dimensions)

| Category | Dimensions | Competitor Coverage |
|----------|-----------|-------------------|
| **Code Quality** | Security (SAST), Unit Tests, Load/Perf, Accessibility | Snyk ✅, SonarQube ✅ |
| **API** | Contract Testing, Visual Regression | TestSigma ✅ |
| **Advanced** | Edge Cases, Property-Based, Chaos, Mutation, Predictive | **Only TestForge** 🟣 |
| **Strategic** | Vision & Goals, Scope Coverage, Stack Analysis | **Only TestForge** 🟣 |
| **Enterprise** | Agentic Scale, DORA Metrics, Supply Chain, N+1 Queries, Dead Code, License, OWASP | **Only TestForge** 🟣 |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│  Vercel — Frontend (React 19 + Vite + Tailwind)     │
│  testforge.run                                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 15 Pages  │  │ 18 API Routes│  │  Neon PG (DB) │  │
│  │ HashRouter│  │  Serverless  │  │  8 tables     │  │
│  └──────────┘  └──────┬───────┘  └───────────────┘  │
│                       │                              │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────┐
│  Fly.io — MCP Server  │ https://testforge-mcp.fly.dev│
│  clone-and-analyze endpoint                          │
│  8 analyzer modules, 21 dimensions                   │
└──────────────────────────────────────────────────────┘
```

---

## 📦 Quick Start

### Web Platform
```bash
open https://testforge.run
```

### MCP IDE Integration
```bash
npx @whitenoisenpm/testforge-mcp install
```
Works with Cursor, VS Code, Windsurf, Claude Code.

### CLI Score
```bash
npx @whitenoisenpm/testforge-mcp score https://github.com/user/repo
```
CI/CD friendly — exit code based on threshold.

### Self-Hosted
```bash
git clone https://github.com/t4tarzan/testforge
cd testforge/mcp-server
flyctl launch --now
```

---

## 🛠️ Local Development

```bash
git clone https://github.com/t4tarzan/testforge
cd testforge
npm install
npm run dev    # → localhost:9999
npm run build  # → dist/
```

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (DB + MCP + Stripe) |
| POST | `/api/analyze` | Analyze a GitHub repo |
| GET | `/api/projects` | List projects (user-scoped) |
| GET | `/api/history` | Test history (user-scoped) |
| POST | `/api/save-results` | Save analysis to DB |
| POST | `/api/stripe` | Create checkout session |
| POST | `/api/keys` | Generate API key |
| GET | `/api/badge` | SVG score badge |

---

## 📁 Project Structure

```
testforge/
├── api/                    # 18 Vercel serverless functions
├── mcp-server/             # Fly.io MCP server (8 analyzers)
├── src/
│   ├── pages/              # 15 page components
│   ├── components/         # UI components (40+ shadcn/ui)
│   ├── lib/                # API client, analysis store
│   ├── db/                 # Drizzle ORM schema (8 tables)
│   └── context/            # Auth context
├── e2e/                    # Playwright E2E tests
├── scripts/                # DB seed scripts
└── public/                 # Static assets
```

---

## 📊 Test Suite

```bash
# E2E tests (Playwright)
npx playwright test

# Unit tests (Vitest)
cd mcp-server && npx vitest run
```

- **31 E2E tests** — every page + API endpoint
- **29 unit tests** — every analyzer independently tested

---

## 🏆 Built With

React 19 · TypeScript · Vite · Tailwind · Fastify · Neon PostgreSQL · Drizzle ORM · Fly.io · Vercel · Stripe · Playwright · Vitest · GSAP · Recharts · Framer Motion

---

## 📄 License

BUSL-1.1 — Free for non-production use and self-hosting. Commercial managed service requires a paid plan at [testforge.run](https://testforge.run).
