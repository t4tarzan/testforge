# 🧪 TestForge AI

> **AI CODE? Run TestForge! — 21-dimension analysis in 30 seconds.** Security, performance, accessibility — plus vision alignment, scope coverage, and stack analysis that no other platform provides.

[![Live Demo](https://img.shields.io/badge/Live-testforge--steel.vercel.app-5A8F5E)](https://testforge.run)
[![MCP Server](https://img.shields.io/badge/MCP-testforge--mcp.fly.dev-5A8F5E)](https://testforge-mcp.fly.dev)
[![GitHub](https://img.shields.io/badge/GitHub-t4tarzan/testforge-5A8F5E)](https://github.com/t4tarzan/testforge)

---

## 🚀 Quick Start

### Option 1: Use the Web Platform
Go to **[testforge.run](https://testforge.run)** → enter any public repo URL → get a full analysis report in 30 seconds.

### Option 2: IDE Integration (MCP)
```bash
npx @whitenoisenpm/testforge-mcp install
```
Then in Cursor/VS Code: Settings → MCP → Add server → command: `npx`, args: `["-y", "@whitenoisenpm/testforge-mcp", "serve"]`

### Option 3: Self-Host (Docker / Fly.io)
```bash
git clone https://github.com/t4tarzan/testforge
cd testforge/mcp-server
flyctl launch --now
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│  Vercel — Frontend (React 19 + Vite + Tailwind)     │
│  https://testforge.run                  │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ 14 Pages  │  │  API Routes  │  │  Neon PG (DB) │  │
│  │ HashRouter│  │  /api/*.js   │  │  5 tables     │  │
│  └──────────┘  └──────┬───────┘  └───────────────┘  │
│                       │                              │
└───────────────────────┼──────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────┐
│  Fly.io — MCP Server  │                              │
│  https://testforge-mcp.fly.dev                       │
│                       ▼                              │
│  ┌──────────────────────────────────────────────┐    │
│  │  Analysis Engine                             │    │
│  │  • Code Scanner (files, endpoints, deps)     │    │
│  │  • Security (SAST, vulnerability detection)  │    │
│  │  • Unit Test Analysis (coverage, frameworks) │    │
│  │  • Load Analysis (rate limiting, caching)    │    │
│  │  • Accessibility (WCAG compliance)           │    │
│  │  • Vision & Goal Alignment ⭐                │    │
│  │  • Scope Coverage ⭐                         │    │
│  │  • Stack Choice Analysis ⭐                  │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

⭐ = Unique differentiators — competitors don't do this

---

## 📊 What We Analyze (8 Dimensions)

| Dimension | What It Checks | Weight |
|-----------|---------------|--------|
| 👁️ **Vision & Goals** | Observability, feature flags, analytics, CI/CD maturity | 25% |
| 🎯 **Scope Coverage** | Documented vs implemented features, README traceability | 15% |
| 📦 **Stack Choice** | TypeScript, testing, ORM, caching, architecture | 15% |
| 🔒 **Security** | SAST scanning, vulnerability detection, OWASP checks | 15% |
| 🧪 **Unit Tests** | Coverage estimation, framework detection, untested functions | 10% |
| ⚡ **Load/Performance** | Rate limiting, caching, connection pooling | 10% |
| ♿ **Accessibility** | WCAG compliance, alt text, form labels | 10% |
| 📝 **Codebase** | Files, lines, endpoints, tech stack, dependencies | — |

---

## 📄 Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Hero, features, testimonials, stats |
| Pipeline | `/#/pipeline` | 13-stage testing pipeline visualization |
| Integrator | `/#/integrator` | 4-layer integration intelligence engine |
| Testing Dimensions | `/#/testing-dimensions` | All testing types explained |
| PRD Generator | `/#/prd-generator` | Converts findings into structured PRDs |
| Dashboard | `/#/dashboard` | Analytics with real data integration |
| Pricing | `/#/pricing` | Plans and feature comparison |
| **Test Runner** | `/#/run-test` | 🔥 Submit real repos → get real reports |
| Test Report | `/#/report/:id` | View generated test reports |
| MCP Integration | `/#/mcp` | IDE setup instructions |
| Documentation | `/#/docs` | Comprehensive guides |
| Auth | `/#/auth` | Sign in / Sign up |
| Account | `/#/account` | User dashboard |

---

## 🛠️ Local Development

```bash
# Clone the repo
git clone https://github.com/t4tarzan/testforge.git
cd testforge

# Install dependencies
npm install

# Start dev server (Vite + API proxy)
npm run dev
# → Frontend: http://localhost:9999
# → API: http://localhost:3002 (proxied through Vite)

# Build for production
npm run build
# → Output: dist/

# Run MCP server locally
cd mcp-server
npm install
npx tsx src/index.ts
# → http://localhost:3001
```

---

## 🚢 Deployment

### Frontend (Vercel)
```bash
npm run build
vercel --prod
```
Auto-deploys on push to `main`.

### MCP Server (Fly.io)
```bash
cd mcp-server
flyctl deploy
```

### Database (Neon PostgreSQL)
```bash
# Set DATABASE_URL in Vercel/Fly.io env
npx drizzle-kit push  # Push schema
node scripts/seed.js   # Seed demo data
```

---

## 📦 npm Package

```bash
# Publish (from mcp-server/)
cd mcp-server
npm publish --access public

# Users can then:
npx @whitenoisenpm/testforge-mcp install   # Show IDE setup guide
npx @whitenoisenpm/testforge-mcp serve     # Start MCP server
```

---

## 🔌 API Reference

### Vercel API (`/api/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with DB status |
| GET | `/api/projects` | List projects |
| GET | `/api/test-runs` | List test runs |
| GET | `/api/reports/:id` | Get report by ID |
| POST | `/api/auth/login` | Login (mock) |
| POST | `/api/analyze` | Analyze repo (proxies to Fly.io) |
| GET | `/api/analyze` | Get MCP server endpoints |
| POST | `/api/test` | Start test suite |

### Fly.io MCP Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health |
| POST | `/clone-and-analyze` | Clone repo → full analysis |
| POST | `/analyze` | Analyze local path |
| POST | `/test` | Start test suite |
| GET | `/test/:id/progress` | Test progress |
| GET | `/report/:id` | Generated report |
| POST | `/mcp/messages` | MCP protocol |
| GET | `/mcp/sse` | SSE progress stream |

---

## 📁 Project Structure

```
testforge/
├── api/                    # Vercel serverless functions
│   ├── health.js
│   ├── analyze.js
│   ├── test.js
│   ├── projects.js
│   ├── test-runs.js
│   ├── auth/login.js
│   └── reports/[id].js
├── mcp-server/             # MCP server (deployed on Fly.io)
│   ├── src/
│   │   ├── index.ts        # Entry point + CLI
│   │   ├── mcp-server.ts   # MCP protocol + routes
│   │   ├── test-runner.ts  # Test orchestration
│   │   ├── report-generator.ts
│   │   └── analyzers/
│   │       ├── code-scanner.ts
│   │       ├── security-analyzer.ts
│   │       ├── unit-analyzer.ts
│   │       ├── load-analyzer.ts
│   │       ├── accessibility-analyzer.ts
│   │       └── strategic-analyzer.ts  ⭐ Vision, Scope, Stack
│   ├── Dockerfile
│   ├── fly.toml
│   └── package.json
├── scripts/
│   └── seed.js             # DB seed script
├── src/
│   ├── components/         # React components
│   │   ├── ui/             # shadcn/ui (40+)
│   │   ├── pipeline/
│   │   ├── integrator/
│   │   ├── testing/
│   │   ├── mcp/
│   │   └── testrunner/
│   ├── pages/              # 14 page components
│   ├── lib/                # Utilities
│   │   ├── api.ts          # API client
│   │   ├── analysisStore.ts # Shared analysis data
│   │   └── utils.ts
│   ├── db/                 # Drizzle ORM
│   │   ├── schema.ts       # 5 tables
│   │   └── client.ts
│   ├── context/            # Auth context
│   ├── data/               # Seed/mock data
│   └── index.css           # Global styles
├── public/                 # Static assets
├── vercel.json             # Vercel config
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 🆚 vs Competitors

| Feature | TestForge | TestRail | TestSigma | Snyk | SonarQube |
|---------|-----------|----------|-----------|------|-----------|
| Security scanning | ✅ | ❌ | ❌ | ✅ | ✅ |
| Unit test analysis | ✅ | ❌ | ✅ | ❌ | ✅ |
| Load/performance | ✅ | ❌ | ✅ | ❌ | ❌ |
| Accessibility | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Vision alignment** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Scope coverage** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Stack analysis** | ✅ | ❌ | ❌ | ❌ | ❌ |
| MCP IDE integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Self-hosted option | ✅ | ✅ | ❌ | ✅ | ✅ |
| Free tier | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## 📄 License

MIT
