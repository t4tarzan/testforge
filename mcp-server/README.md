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

- **0.12.0** — Dimension deepening, pass 4. **Predictive failures** goes from 5 project-level heuristic counts to **cross-signal per-file risk aggregation**. New `lib/predictive.ts` ingests signals from other dimensions (security findings by severity, N+1 hits, dead exports) plus AST-derived **cyclomatic complexity** (new `lib/complexity.ts`) and TODO/FIXME density per file, and produces a ranked list of risk hotspots. Each hotspot carries a `reasons[]` breakdown so you know exactly why a file scored high (e.g. "security: 2 critical · 1 N+1 hit · hot function (cc=23 in `processOrder`)"). The aggregator runs in two modes: standalone (derives N+1, dead-code, complexity itself) or cross-signal (caller passes pre-computed findings — preferred when running the full pipeline). The dimension's public report grows a `topRiskyFiles: FileRisk[]` field; up to 5 hotspots also surface as findings with `category: 'Predictive'` and severity scaling with the per-file score. Deterministic by construction — same inputs → same scores; weights centralized in `lib/predictive.ts`. Replaces the previous brace-counting "max nesting" heuristic which over-fired on arrow functions and template literals. Tests: 64 → 69. New test cases cover hotspot surfacing, cross-signal aggregation, multi-reason scoring, the `Risk hotspot:` finding shape, and the Low-risk no-signal floor.
- **0.11.0** — Dimension deepening, pass 3. **Contract analysis** goes from a substring check on filenames to real cross-referencing between OpenAPI/Swagger specs and AST-discovered routes. New `lib/openapi-parse.ts` loads `openapi.{yaml,yml,json}` / `swagger.*` / `api-spec.*` files (parses with js-yaml, validates the `openapi:` / `swagger:` root, extracts `paths` → method tuples + operationIds). New `lib/endpoint-discovery.ts` AST-walks source files for `app.get`/`router.post`/`fastify.put`/etc., recording the canonical `(method, path)` of each registration. `canonicalPath` normalizes `/users/{id}` (OpenAPI) and `/users/:id` (Express) to the same shape so they match. New findings emitted: undocumented endpoints (in code, missing from spec), orphan endpoints (in spec, no handler in code), invalid-but-named spec files (file looks like a spec but no `openapi:` root / parse error), and a smarter missing-versioning check (only fires when a spec exists to compare). `code-scanner.ts` now loads YAML/JSON files (with package-lock and yarn-lock explicitly excluded). Tests: 58 → 64. New fixtures: `tests/fixtures/contracts/` (spec + Express server with intentional mismatches: 2 matched, 2 undocumented, 1 orphan) and `tests/fixtures/contracts-missing/` (8 endpoints, no spec at all).
- **0.10.0** — Dimension deepening, pass 2. Unit-analyzer goes from a regex test-counter to an AST-aware test-quality analyzer. New `lib/test-quality.ts` walks each parseable test file and produces a structured `TestFileQuality` per file. New report shape carries a `quality` block at the top level: `{ totalCases, skippedCases, focusedCases, assertionlessCases, emptyCases, isolatedTestFiles }`. **Detection of new anti-patterns**: `it.skip` / `xit` / `it.todo` (skipped — rot risk); `it.only` / `fit` (focused — silently kills sibling tests in CI); test bodies with NO recognized assertion call (`expect`/`assert`/`should`/`t.X`/snapshot matchers from Jest/Vitest/Mocha/Chai/AVA/tap/node:test/Testing Library); empty test bodies (only comments / trivial statements); test files that import nothing project-relative (testing only the framework). Recognized frameworks expanded: Jest, Vitest, Mocha, AVA, Node Tap, node:test, Testing Library, Chai. Tests: 51 → 58. New fixture `tests/fixtures/test-quality/` with healthy + 5 unhealthy patterns; 7 tests assert each detection.
- **0.9.0** — Dimension deepening, pass 1. The keepers across the 21 dimensions stay at 21; the depth inside each one grows. This pass takes **N+1 detection** and **dead-code detection** from regex-and-substring heuristics to AST-aware analysis using the same Babel + visitor + cross-file infrastructure the security spine uses.<br><br>**N+1 detection** — new `lib/n-plus-one.ts`. Walks parsed ASTs for db sinks (`.query/.exec/.findOne/.findUnique`, `sql\`\``, `prisma.x`, `mongoose.x`, `sequelize.x`) nested inside `for` / `for-of` / `for-in` / `while` / `do-while`, plus the higher-order `arr.forEach`/`map`/`filter`/`reduce`/`some`/`every`/`find`/`flatMap` forms (callback body = loop body). Skips calls already wrapped in `Promise.all` / `Promise.allSettled` (parallelised, not N+1). Replaces the prior `{/}` line-counter that over-fired on inner closures and missed db calls in arrow-function loop bodies.<br><br>**Dead-code detection** — new `lib/dead-code.ts`. For each project file, the AST yields its declared/exported symbols + every referenced identifier + every imported module specifier. An exported symbol is "dead" iff no OTHER file references its name. Replaces the prior `allContent.includes(name)` heuristic that flagged nothing because every symbol's own declaration line contained its name. **Unused-deps** check now matches on the module ROOT (`lodash`) so `import { get } from 'lodash/get'` counts as a use — covers a common false-positive that wrongly flagged sub-path-only imports.<br><br>Tests: 41 → 51. New fixtures at `tests/fixtures/n-plus-one/` (3 positive cases: for-of, forEach, classic for; 2 negative cases: `Promise.all`-wrapped, no-loop) and `tests/fixtures/dead-code/` (used vs. unused exports, sub-path import, genuinely-unused dep). Limitations called out in the source: cross-file dead-code is name-based (global-scope collisions over-count as "used"), and N+1 doesn't follow function calls into closures (intentional — would explode FP rate).
- **0.8.1** — Patch. Internal cleanup matching the repo-wide lint backlog clearance (127 → 0 errors). Type tightening across `mcp-server.ts`, `local-db.ts`, `types.d.ts`: replaced `any` / `as any` with `Awaited<ReturnType<…>>`, `unknown` with narrowing, and concrete shapes (e.g. new `ReportRow`). Dead-code purges (unused regex constants in `accessibility-analyzer.ts`, unused `findParamForExpression` in `function-summaries.ts`, dead imports in `mcp-server.ts` / `test-runner.ts`). `catch (err: any) → (err)` then `(err as Error).message`. No behavior changes; same analyzer outputs on the same fixtures (41/41 tests pass).
- **0.8.0** — Spine, Phase 4c. User-authored rules DSL. Projects can drop a `.testforge/rules.yaml` (or `.yml` / `.json`) at the repo root to declare custom pattern detectors that ride on top of the built-in analyzer — no fork required. Each rule has `id`, `title`, `severity`, `category`, an optional `description`/`fixSuggestion`, and a `match` block. Match shapes in v1: `callee` (exact dotted match, string or array), `calleeRegex` (anchored as written), `taintedArg` (require the arg at this index to come back tainted via the Phase 2 engine), and `argRegex` (require the string-literal arg at this index to match). Taint-gated rules get HIGH confidence (real source-to-sink flow); shape-only rules get MEDIUM. Malformed rules log a one-shot warning and are skipped — one bad rule never aborts analysis. Up to 200 rules per project. Rules can also be supplied programmatically via the new `userRules?: UserRule[]` config field (overrides the on-disk file). Tests: 36 → 41; new `tests/fixtures/user-rules/` exercises all three match shapes plus the no-fire negative paths.
- **0.7.0** — Spine, Phase 4b. Cross-file taint propagation. New `lib/cross-file-summaries.ts` walks every parseable file in a single pre-pass, computes the per-file function summary table (from Phase 4a), then publishes the ones that carry sinks under `<resolvedPath>::<exportName>` keys. A companion `lib/module-resolver.ts` resolves relative imports against the candidate file set (`.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs`, plus `/index.*` directory-imports and explicit-extension swaps) without touching disk. Each file gets its own `collectFileImports` map of "local-name → cross-file key" — handles ESM (`import { x }`, `import x`, `import * as ns`) and CJS (`const { x } = require(...)`, `const x = require(...).y`, `const ns = require(...)`). The analyzer's `checkCrossFunctionSinkCall` now consults the cross-file index for both direct identifier calls and `ns.X` member calls, emitting findings at the call site of the importing file. Deferred: re-exports (`export { x } from './y'`), tsconfig path aliases, node_modules resolution, dynamic `require()`. Tests: 30 → 36; new `helpers/db-helper.js` (CJS) + `helpers/redirect-helper.js` (ESM) + `cross-file-cjs.js` + `cross-file-esm.js` fixture set.
- **0.6.0** — Spine, Phase 4a. Cross-function taint propagation (intra-file). New `lib/function-summaries.ts` builds a per-file table summarizing each named/aliased function: which parameters land in a sink (and which category), which sanitizers wrap them, whether the return value propagates taint. The analyzer then emits findings *at the call site* when a helper with a sink summary is called with tainted arguments. Catches `function runQuery(q) { db.query(q); }` + `runQuery('...' + req.body.x)` as critical/high SQL injection. Handles named declarations, aliased function expressions (`const fn = function() {…}`), arrow functions (`const fn = (a, b) => …`). Per-helper intra-procedural taint runs to a small fixpoint so chains `param → const A = param + '…' → const B = A → sink(B)` resolve cleanly. Deferred: cross-file resolution (Phase 4b), higher-order references like `[].map(handler)`. Tests: 25 → 30, new `cross-function.js` fixture covering SQL inj / open redirect / path traversal / XSS via helpers.
- **0.5.0** — Spine, Phase 3. Structured fix suggestions. Each finding can now carry `fix: { description, before, after, importsNeeded?, applicable }`. `applicable: true` means "safe to apply mechanically" — the dashboard / CLI can offer a one-click apply (still asking confirmation). `applicable: false` means "directional advice, the rewrite needs human judgment." Categories that auto-rewrite: SQL injection (concat / template → parameterized form with `$N` placeholders + bind array), hardcoded named secrets (`const api_key = 'sk_…'` → `const api_key = process.env.API_KEY`), reflected XSS via `res.send` (wrap argument with `escape()`), innerHTML / dangerouslySetInnerHTML (wrap with `DOMPurify.sanitize(...)`). Description-only suggestions for `eval`/`Function`/`exec`, open redirect, path traversal, CORS wildcard, sensitive field in `res.json` (destructure-omit). Public response shape stays additive; old consumers unaffected.
- **0.4.0** — Spine, Phase 2. Generalized intra-procedural taint tracking across **all** sinks (was only SQL injection in 0.3.0). New `lib/taint.ts` engine: per-file table of `Map<localName, {source, sanitizers[]}>`, expression-tree walker that traces taint through identifiers, member access, template literals, string concat, conditional/logical ops, and `JSON.parse`. Recognizes 20+ sanitizers (DOMPurify, sanitize-html, escape, path.normalize, parseInt/Number, encodeURIComponent, allowlist `.includes()`/`.has()`). New per-finding `flow` field — narrative like "argument flows from request through DOMPurify.sanitize". `confidence` semantics tightened: HIGH = source→sink no sanitizer, MEDIUM = sanitizer in path, LOW = pattern matched without taint. All 6 sink categories (SQL inj, RCE, path traversal, open redirect, reflected XSS, DOM XSS) now share the same engine — adding a new source or sanitizer extends all of them at once.
- **0.3.0** — Spine, Phase 1. Security analyzer moved from line-level regex to a Babel AST traversal. New per-finding `confidence` field (`high` / `medium` / `low`). Inline suppression comments (`// testforge-disable-next-line <category>` and `// testforge-disable-file <category>`). Findings now carry a `column` number alongside the line. File-size cap (500 KB) and per-file 250 ms parse-and-traverse budget. Basic intra-procedural taint: SQL injection detection catches `const q = '…' + req.x; db.query(q);` shape, not just inline interpolation. False-positive corpus and true-positive corpus added under `tests/fixtures/` to lock in the new precision. `eval()` re-categorized from XSS to "Dangerous Functions" (more accurate — it's RCE, not script-injection). Old consumers unaffected: the public response shape is additive-only.
- **0.2.19** — `/test` and `/quick-scan` now persist their summary to `~/.testforge/history.db` on completion (previously written to in-memory Maps only — runs evaporated on restart).
- **0.2.18** — Default port changed from `3001` → `33221` to avoid local-dev collisions. `/api/reports/latest` returns 404 when the local DB is empty instead of fabricated seed data. `fast-json-stringify` listed as direct dep (defensive against npx cache quirks). `/health` now reports the actual package version.
- **0.2.17** and earlier — see git history.

## License

MIT
