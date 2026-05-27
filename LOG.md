# TestForge — Architecture & Build Log

> Complete record of everything built. Clone the repo and this document explains it all.

**Started**: May 24, 2026 | **Last Updated**: May 25, 2026  
**URL**: https://testforge.run | **GitHub**: https://github.com/t4tarzan/testforge  
**npm**: `@whitenoisenpm/testforge-mcp` (v0.27.2)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Vercel — Frontend (React 19 + Vite + Tailwind)     │
│  https://testforge.run                               │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 15 Pages  │  │ 18 API Routes│  │  Neon PG (DB) │  │
│  │ HashRouter│  │  Serverless  │  │  8 tables     │  │
│  └──────────┘  └──────┬───────┘  └───────────────┘  │
│                       │                              │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────┐
│  Fly.io — MCP Server  │ https://testforge-mcp.fly.dev│
│  Fastify + TypeScript                                │
│  8 analyzer modules, 21 dimensions                   │
│  clone-and-analyze endpoint                          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Local MCP (npm package)                             │
│  npx @whitenoisenpm/testforge-mcp@latest             │
│  Dashboard: http://localhost:33221                   │
│  SQLite: ~/.testforge/history.db                     │
│  🔒 Code never leaves the machine                    │
└──────────────────────────────────────────────────────┘
```

**Two products, same engine:**
- **Local MCP**: npm package, runs on developer machine, SQLite, no sign-in
- **Managed (testforge.run)**: Vercel + Fly.io + Neon, GitHub OAuth, Stripe billing

---

## 📊 Database (Neon PostgreSQL — 8 tables)

```sql
-- Core tables
projects       (id, name, repo_url, local_path, branch, tech_stack, user_id)
test_runs      (id, project_id, user_id, branch, status, overall_score, findings...)
test_results   (id, test_run_id, dimension, status, metrics, logs)
findings       (id, test_run_id, dimension, severity, title, file_path, fix_suggestion)
reports        (id, test_run_id, title, content, format)

-- User & Enterprise
users          (id, github_id, name, email, avatar_url, login, plan, tests_this_month)
organizations  (id, name, slug, plan, stripe_customer_id)
memberships    (id, user_id, organization_id, role)
api_keys       (id, user_id, name, key_hash, key_prefix, revoked_at)

-- Task tracking
enterprise_tasks (id, title, description, category, priority, status, stage)
```

**ORM**: Drizzle ORM with Neon serverless driver (`@neondatabase/serverless`)

---

## 🔌 API Endpoints (18 total on Vercel)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check (DB status) |
| POST | `/api/auth/login` | Mock login |
| GET | `/api/auth/callback` | GitHub OAuth redirect + callback |
| GET | `/api/projects` | List projects (user-scoped) |
| GET | `/api/test-runs` | List test runs |
| GET | `/api/history` | Test history (user-scoped) |
| GET | `/api/reports/:id` | Get report detail |
| POST | `/api/analyze` | Analyze repo (proxies to Fly.io) |
| POST | `/api/test` | Start test suite |
| POST | `/api/save-results` | Save analysis to DB |
| GET/POST | `/api/tasks` | Enterprise task CRUD |
| GET/POST/DELETE | `/api/keys` | API key generation + revocation |
| POST | `/api/stripe` | Create checkout session |
| POST | `/api/stripe-webhook` | Stripe webhook handler |
| POST | `/api/webhook` | GitHub CI/CD webhook |
| POST | `/api/notify` | Slack/Discord notifications |
| GET | `/api/badge` | SVG score badge |
| GET | `/api/status` | Public status page |
| GET/POST/DELETE | `/api/rules` | Custom rule builder |
| GET | `/api/usage` | Usage + quota stats |
| GET/POST | `/api/orgs` | Organization management |
| GET/POST | `/api/gate` | Plan limit enforcement |

**Security**: Rate limiting (60 req/min), API key auth, security headers, CORS restricted to testforge.run

---

## 🧪 Analysis Engine (MCP Server — 21 dimensions)

Located in `mcp-server/src/analyzers/`:

| File | Dimensions | Type |
|------|-----------|------|
| `code-scanner.ts` | Codebase structure | Real — file system scanning |
| `security-analyzer.ts` | Security (SAST) | Real — pattern matching |
| `unit-analyzer.ts` | Unit test analysis | Real — test file detection |
| `load-analyzer.ts` | Load/performance | Real — dependency analysis |
| `accessibility-analyzer.ts` | Accessibility (WCAG) | Real — HTML/JSX scanning |
| `strategic-analyzer.ts` | Vision, Scope, Stack | Real — observability, features, architecture |
| `advanced-analyzer.ts` | Contract, Visual, Edge, Property, Chaos, Mutation, Predictive, Supply Chain, N+1, Dead Code, License, DORA, OWASP | Real — pattern analysis |
| `agentic-scale.ts` | Agentic Scale Prediction | Real — AI agent simulation |

**Server**: Fastify + TypeScript, deployed on Fly.io (2 machines, auto-scaling)

---

## 📄 Pages (15 total)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `Home.tsx` | Landing page, hero, 21-dimension grid |
| `/#/managed` | `Managed.tsx` | Drop repo URL → full analysis |
| `/#/pipeline` | `Pipeline.tsx` | 21-stage pipeline visualization |
| `/#/integrator` | `Integrator.tsx` | 4-layer architecture flow |
| `/#/testing-dimensions` | `Testing.tsx` | All 21 dimensions explained |
| `/#/prd-generator` | `PrdGenerator.tsx` | PRD from test results |
| `/#/dashboard` | `Dashboard.tsx` | Real-time analytics |
| `/#/pricing` | `Pricing.tsx` | Free/Pro/Enterprise plans |
| `/#/auth` | `Auth.tsx` | GitHub OAuth + email login |
| `/#/account` | `Account.tsx` | User dashboard (6 tabs) |
| `/#/run-test` | `TestRunner.tsx` | 4-step test wizard |
| `/#/report/:id` | `TestReport.tsx` | Report viewer |
| `/#/mcp` | `McpIntegration.tsx` | MCP IDE setup |
| `/#/docs` | `Docs.tsx` | Documentation hub |
| `/#/press` | `Press.tsx` | Press kit |

---

## 🎨 Design System

- **Color**: Violet (#574a7d) primary, #12101A dark, #F7F7FB light
- **Fonts**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (code)
- **Components**: 40+ shadcn/ui components
- **Animations**: GSAP + Framer Motion + Recharts
- **Icons**: Lucide React

---

## 🛠️ Infrastructure

| Service | Purpose | Config |
|---------|---------|--------|
| **Vercel** | Frontend + API | Auto-deploy on git push |
| **Fly.io** | MCP server | 2 machines, auto-scale, min 1 |
| **Neon** | PostgreSQL | Serverless, PITR backups |
| **Stripe** | Payments | Checkout + webhook |
| **GitHub** | OAuth + repo | Public, 1 star |
| **npm** | Package | @whitenoisenpm/testforge-mcp |

---

## 📦 npm Package

```
npx @whitenoisenpm/testforge-mcp@latest    # Start MCP server (port 33221)
                                            # Dashboard: http://localhost:33221
```

**Version**: 0.2.17 | **Size**: ~165KB | **Files**: 24

---

## 🧪 Testing

- **Playwright E2E**: 31 tests (every page + API endpoint)
- **Vitest Unit**: 29 tests (every analyzer independently)
- **Run**: `npx playwright test` / `cd mcp-server && npx vitest run`

---

## 📋 Key Files

```
testforge/
├── api/                          # 18 Vercel serverless functions
│   ├── _security.js              # Rate limiting, API key auth, security headers
│   ├── _middleware.js             # Shared middleware
│   ├── health.js                 # Health check
│   ├── auth/callback.js          # GitHub OAuth
│   ├── stripe.js                 # Stripe checkout
│   ├── stripe-webhook.js         # Auto-upgrade on payment
│   ├── webhook.js                # GitHub CI/CD webhook
│   ├── keys.js                   # API key management
│   ├── gate.js                   # Plan limit enforcement
│   ├── badge.js                  # SVG badge generator
│   ├── notify.js                 # Slack/Discord
│   ├── rules.js                  # Custom rule builder
│   ├── tasks.js                  # Enterprise task tracking
│   ├── save-results.js           # Persist to Neon
│   └── ...                       # projects, test-runs, history, reports, orgs, status, usage
├── mcp-server/                   # Fly.io MCP server
│   ├── src/
│   │   ├── index.ts              # Entry point + dashboard routes
│   │   ├── mcp-server.ts         # MCP protocol + /analyze route
│   │   ├── local-db.ts           # SQLite storage (~/.testforge/history.db)
│   │   ├── test-runner.ts        # Test orchestration
│   │   ├── report-generator.ts   # PRD report generation
│   │   └── analyzers/            # 8 analyzer modules (21 dimensions)
│   ├── public/index.html         # Local dashboard UI
│   ├── Dockerfile                # Fly.io container
│   └── fly.toml                  # Fly.io config (auto-scale)
├── src/
│   ├── pages/                    # 15 page components
│   ├── components/               # UI components (40+ shadcn/ui + custom)
│   │   ├── ui/States.tsx         # EmptyState, LoadingSkeleton, ErrorBoundary
│   │   └── OnboardingModal.tsx   # First-run welcome modal
│   ├── lib/
│   │   ├── api.ts                # API client
│   │   └── analysisStore.ts      # Shared analysis data (localStorage)
│   ├── db/
│   │   ├── schema.ts             # Drizzle ORM (8 tables)
│   │   └── client.ts             # DB client
│   ├── context/AuthContext.tsx    # Auth state (GitHub OAuth + mock)
│   └── data/seedData.ts          # Demo/seed data
├── public/                       # Static assets + images
├── scripts/                      # DB seed scripts
├── e2e/                          # Playwright E2E tests
├── vercel.json                   # Vercel deployment config
├── LAUNCH_KIT.md                 # Marketing launch kit
├── README.md                     # Project README
└── LOG.md                        # This file
```

---

## 🚀 How to Run

### Web Platform
```bash
git clone https://github.com/t4tarzan/testforge
cd testforge
npm install
npm run dev    # → localhost:9999
```

### Local MCP
```bash
npx @whitenoisenpm/testforge-mcp@latest
open http://localhost:33221
```

### Deploy
```bash
# Vercel (auto-deploys on push to main)
git push origin main

# Fly.io MCP
cd mcp-server && flyctl deploy

# npm
cd mcp-server && npm publish --access public
```

---

## 📊 Task Completion

**117 enterprise tasks completed across all phases:**
- Phase 1: Foundations (40 tasks)
- Phase 2: Deep Enhancement (37 tasks)  
- Phase 3: Dashboard (10 tasks)
- Phase 4: Enterprise Readiness (30 tasks)

**Total: 117/117 (100%)**

---

*Built with ❤️ by t4tarzan | testforge.run*
