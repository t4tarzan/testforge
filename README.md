# TestForge AI

> AI-Powered Autonomous Testing Suite — The missing intelligence layer between your code and production.

## Overview

TestForge is a comprehensive AI-powered testing platform that goes far beyond traditional test automation. It features a 13-dimensional testing pipeline, a unique "Integrator" intelligence layer for merge/dependency conflict resolution, PRD generation from failed tests, MCP IDE integration, and predictive quality analytics.

## Live Demo

[https://ngmakig3oird2.kimi.page](https://ngmakig3oird2.kimi.page)

## Pages

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Landing page with hero, pipeline preview, stats, testimonials |
| **Pipeline** | `/#/pipeline` | Interactive 13-stage testing pipeline visualization |
| **The Integrator** | `/#/integrator` | Unique integration intelligence layer showcase |
| **Testing Dimensions** | `/#/testing-dimensions` | All 13 testing types with detailed explanations |
| **PRD Generator** | `/#/prd-generator` | Failed-test-to-PRD conversion capability |
| **Dashboard** | `/#/dashboard` | Quality analytics with Recharts visualizations |
| **Pricing** | `/#/pricing` | 4-tier pricing with feature comparison |
| **Test Runner** | `/#/run-test` | Interactive 4-step test execution wizard (auth required) |
| **Auth** | `/#/auth` | Sign in / Sign up with GitHub OAuth |
| **Account** | `/#/account` | Full admin dashboard with 7 tabs (auth required) |
| **MCP Integration** | `/#/mcp` | One-line IDE installer with 6 editor configs |
| **Documentation** | `/#/docs` | Full docs hub with CLI reference and CI/CD guides |
| **Test Report** | `/#/report/:id` | View generated test reports with severity classification |

## Key Features

### 1. Multi-Dimensional Testing Pipeline
13 distinct testing types executed in a visible pipeline with animated progress:
- Scope Testing, Vision/Goal Testing, Feature Matrix Testing
- Unit, Integration, E2E Testing
- Load & Scale Testing, Predictive Model Testing
- Security Scanning (SAST, DAST, AI fuzzing)
- Visual Regression, Accessibility (WCAG)
- Chaos Engineering, Mutation Testing
- Property-Based Testing, Contract Testing
- Edge Case Generation

### 2. The Integrator (Unique Differentiator)
A unified intelligence layer that:
- Combines test results, dependency state, and merge conflicts
- Generates multi-step integration path recommendations
- Predicts breaking changes before they occur
- Suggests the safest path forward with success probabilities

### 3. PRD Generation from Failed Tests
Converts test failures into structured Product Requirements Documents with:
- Severity classification (Critical/High/Medium/Low)
- Phased remediation plans (P0 → P1 → P2)
- Effort estimates and component mapping
- Export as JSON, Markdown, or PDF

### 4. MCP IDE Integration
One-line installer: `npx @testforge/mcp install`
- Cursor, VS Code, Windsurf, Trae, Claude Code support
- Autonomous test generation from natural language
- Security scans and fix suggestions in your IDE
- Live progress tracking

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v3 + shadcn/ui (40+ components)
- **Animations**: GSAP + ScrollTrigger, Framer Motion
- **Charts**: Recharts
- **Smooth Scroll**: Lenis
- **Routing**: react-router-dom (HashRouter)
- **Icons**: Lucide React

## Getting Started

```bash
# Clone the repository
git clone <your-repo-url> testforge
cd testforge

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
  components/
    ui/              # shadcn/ui components (40+)
    pipeline/        # Pipeline visualization components
    integrator/      # Integrator page components
    testing/         # Testing dimensions components
    mcp/             # MCP integration components
    testrunner/      # Test runner wizard steps
    Navbar.tsx       # Auth-aware navigation
    Footer.tsx       # Site footer
    Layout.tsx       # Page layout wrapper
  context/
    AuthContext.tsx  # Authentication state management
  data/
    seedData.ts      # Demo data (repo, test results, reports)
  pages/
    Home.tsx         # Landing page
    Pipeline.tsx     # Pipeline visualization
    Integrator.tsx   # The Integrator showcase
    Testing.tsx      # Testing dimensions reference
    PrdGenerator.tsx # PRD generation showcase
    Dashboard.tsx    # Analytics dashboard
    Pricing.tsx      # Pricing page
    Auth.tsx         # Sign in / Sign up
    Account.tsx      # Admin dashboard (7 tabs)
    TestRunner.tsx   # Interactive test wizard
    TestReport.tsx   # Report viewer
    McpIntegration.tsx # MCP setup page
    Docs.tsx         # Documentation hub
  App.tsx           # Router configuration
  main.tsx          # Entry point
  index.css         # Global styles + Tailwind
```

## Authentication

The app uses mock authentication for the demo:
- Any email/password works for sign in
- Auth state persists in localStorage
- Protected routes redirect to `/auth` when not logged in
- Swap `AuthContext.tsx` for your real auth provider (Firebase, Auth0, Clerk, etc.)

## Seed Data

The `src/data/seedData.ts` file contains comprehensive demo data:
- `SEED_REPO`: express-ecommerce-api repository metadata
- `SEED_TEST_RESULTS`: Results for all 13 test dimensions
- `SEED_REPORT`: Complete test report with PRD phases
- `MOCK_USER`, `MOCK_TEST_HISTORY`, `MOCK_API_KEYS`, `MOCK_TEAM_MEMBERS`

Replace with your API calls to make the platform fully functional.

## Deployment

The app is configured for static deployment:
- Uses HashRouter for client-side routing compatibility
- Build output goes to `dist/` directory
- Deploy `dist/` to any static host (Vercel, Netlify, GitHub Pages, etc.)

```bash
npm run build
# Deploy the dist/ folder
```

## Future Enhancements

- [ ] Backend API with real test execution engine
- [ ] WebSocket integration for live test progress
- [ ] GitHub/GitLab OAuth and webhook integration
- [ ] Real MCP server package (`@testforge/mcp`)
- [ ] Database for test history and user data
- [ ] PDF export generation
- [ ] Team collaboration features
- [ ] Custom test rule builder
- [ ] Performance benchmarking history
- [ ] Slack/Discord notifications

## License

MIT
