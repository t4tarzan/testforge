# @whitenoisenpm/testforge-mcp

**AI-powered testing in your IDE.** The TestForge MCP server integrates with Cursor, VS Code, Windsurf, Claude Code, and any MCP-compatible editor to provide real-time code analysis — entirely on your machine.

```bash
npx @whitenoisenpm/testforge-mcp@latest serve
# → http://localhost:33221
```

## What it does

| Dimension category | Examples |
|---|---|
| **Security (SAST)** | SQL/NoSQL injection, eval, XSS, sensitive data in logs/responses, hardcoded secrets, CORS misconfig, OWASP coverage |
| **Quality** | Unit-test coverage, mutation-score estimate, predictive risk, dead-code, license/supply-chain audit |
| **Performance & resilience** | Load profile, rate limiting, caching, n+1 query patterns, chaos resilience |
| **Product & ops** | Vision/goal alignment (observability, analytics, feature flags), scope coverage, stack quality, DORA estimate, agentic-scale prediction |
| **UI** | Accessibility (WCAG-ish): alt text, form labels, visual-regression hints |

All analysis is regex/static — fast, no LLM calls, deterministic. Same input → same output (replaces the previous `Math.random()` heuristics in v0.2.16 and earlier).

## Quick Start

```bash
# One-command install: writes MCP config into your IDE
npx @whitenoisenpm/testforge-mcp install

# Or start the server directly (port 33221)
npx @whitenoisenpm/testforge-mcp serve

# Dashboard:
open http://localhost:33221
```

The dashboard lets you paste a local project path **or** a public GitHub URL, runs the full 21-dimension analysis, and persists each run to SQLite at `~/.testforge/history.db` so `/reports` shows your history.

## Manual MCP Setup

### Cursor / Windsurf / Claude Desktop

Open IDE settings → MCP → add server:

```json
{
  "mcpServers": {
    "testforge": {
      "command": "npx",
      "args": ["-y", "@whitenoisenpm/testforge-mcp", "serve"],
      "env": {
        "TESTFORGE_MCP_PORT": "33221"
      }
    }
  }
}
```

### VS Code

Use the Continue / Cline extension and add the same JSON to its MCP config block.

## MCP Tools

| Tool | What it does | Latency |
|---|---|---|
| `testforge_analyze` | Synchronous: scan codebase structure (files, endpoints, dependencies, tech stack) | seconds |
| `testforge_quick_scan` | Async: security + unit dimensions only. Streams progress via SSE. | ~30s |
| `testforge_test` | Async: full suite across all dimensions. Streams progress via SSE. Persists summary to SQLite on completion (since 0.2.19). | 1–5 min |
| `testforge_report` | Get or generate a structured PRD report for a completed test run | seconds |

## REST API (running standalone)

```bash
# Health
curl http://localhost:33221/health
# → {"status":"ok","version":"0.2.19"}

# Public-status check (for badges/uptime)
curl http://localhost:33221/api/reports/latest
# → 404 {"error":"No reports yet"} if SQLite is empty;
#   the most recent report otherwise (no more seed/demo data fallback).

# Synchronous full analysis of a public repo
curl -X POST http://localhost:33221/clone-and-analyze \
  -H "Content-Type: application/json" \
  -d '{"repoUrl":"https://github.com/owner/repo"}'

# Async test run (background, streams via SSE)
curl -X POST http://localhost:33221/test \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/path/to/local/project"}'
# → {"testRunId":"...","status":"running","streamUrl":"/mcp/sse"}

# Progress for a specific run
curl http://localhost:33221/test/<testRunId>/progress

# List recent persisted runs (from SQLite)
curl http://localhost:33221/reports

# Single report by id
curl http://localhost:33221/report-view/<reportId>
```

## Local data

| File | Contents |
|---|---|
| `~/.testforge/history.db` | SQLite with a `reports` table — one row per analyze / test run, including per-dimension scores and the full JSON blob in `full_data`. WAL mode. |
| `~/.testforge/history.db-wal`, `.db-shm` | SQLite WAL sidecars. |
| `/tmp/testforge-repos/` (or `$TMP_DIR`) | Temp clones of public repos for `/clone-and-analyze`. Deleted after each analysis. |

Your source never leaves the machine — the dashboard is local, the analyzers are local, the DB is local. The only outbound calls are the `git clone` step (when you give it a public URL) and dependency lookups for license/supply-chain checks.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TESTFORGE_MCP_PORT` | `33221` | Server port. 33221 chosen to avoid common dev-server collisions (3000/3001/5173/8080). |
| `TMP_DIR` | `/tmp/testforge-repos` | Where `/clone-and-analyze` puts temp checkouts. |
| `LOG_LEVEL` | `info` | Fastify logger level (`debug`, `info`, `warn`, `error`). |
| `DATABASE_URL` | — | Optional. If set, the server can fall back to Neon for read-replica history. Not required for local-only use. |

## Changelog highlights

- **0.4.0** — Spine, Phase 2. Generalized intra-procedural taint tracking across **all** sinks (was only SQL injection in 0.3.0). New `lib/taint.ts` engine: per-file table of `Map<localName, {source, sanitizers[]}>`, expression-tree walker that traces taint through identifiers, member access, template literals, string concat, conditional/logical ops, and `JSON.parse`. Recognizes 20+ sanitizers (DOMPurify, sanitize-html, escape, path.normalize, parseInt/Number, encodeURIComponent, allowlist `.includes()`/`.has()`). New per-finding `flow` field — narrative like "argument flows from request through DOMPurify.sanitize". `confidence` semantics tightened: HIGH = source→sink no sanitizer, MEDIUM = sanitizer in path, LOW = pattern matched without taint. All 6 sink categories (SQL inj, RCE, path traversal, open redirect, reflected XSS, DOM XSS) now share the same engine — adding a new source or sanitizer extends all of them at once.
- **0.3.0** — Spine, Phase 1. Security analyzer moved from line-level regex to a Babel AST traversal. New per-finding `confidence` field (`high` / `medium` / `low`). Inline suppression comments (`// testforge-disable-next-line <category>` and `// testforge-disable-file <category>`). Findings now carry a `column` number alongside the line. File-size cap (500 KB) and per-file 250 ms parse-and-traverse budget. Basic intra-procedural taint: SQL injection detection catches `const q = '…' + req.x; db.query(q);` shape, not just inline interpolation. False-positive corpus and true-positive corpus added under `tests/fixtures/` to lock in the new precision. `eval()` re-categorized from XSS to "Dangerous Functions" (more accurate — it's RCE, not script-injection). Old consumers unaffected: the public response shape is additive-only.
- **0.2.19** — `/test` and `/quick-scan` now persist their summary to `~/.testforge/history.db` on completion (previously written to in-memory Maps only — runs evaporated on restart).
- **0.2.18** — Default port changed from `3001` → `33221` to avoid local-dev collisions. `/api/reports/latest` returns 404 when the local DB is empty instead of fabricated seed data. `fast-json-stringify` listed as direct dep (defensive against npx cache quirks). `/health` now reports the actual package version.
- **0.2.17** and earlier — see git history.

## License

MIT
