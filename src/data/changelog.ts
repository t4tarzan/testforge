// TestForge changelog — every published @whitenoisenpm/testforge-mcp release,
// in the open. Dates are the npm publish timestamps; summaries trace to the
// commit that shipped each version. Newest first.
//
// This page exists for one reason: to show the work is continuous and dated.
// The "precision" entries (0.27.x, 0.28.x) are the flywheel in action — public
// In-the-Wild reports surfaced false positives, and each fix shipped as a
// release within hours.

export type ChangelogTag =
  | 'foundation'
  | 'security'
  | 'accessibility'
  | 'analyzer'
  | 'polyglot'
  | 'platform'
  | 'precision'
  | 'site';

export interface ChangelogEntry {
  version: string;
  date: string; // ISO yyyy-mm-dd (npm publish date)
  tag: ChangelogTag;
  title: string;
  summary: string;
}

export const TAG_LABELS: Record<ChangelogTag, string> = {
  foundation: 'Foundation',
  security: 'Security',
  accessibility: 'Accessibility',
  analyzer: 'Analyzer',
  polyglot: 'Polyglot',
  platform: 'Platform',
  precision: 'Precision',
  site: 'Site',
};

// Tailwind-friendly hex per tag (used for the chip + the row accent).
export const TAG_COLORS: Record<ChangelogTag, string> = {
  foundation: '#6B6B6B',
  security: '#D4524A',
  accessibility: '#0d9488',
  analyzer: '#574a7d',
  polyglot: '#0891b2',
  platform: '#7a6fad',
  precision: '#C2410C',
  site: '#9333EA',
};

export const changelog: ChangelogEntry[] = [
  {
    version: '0.36.4',
    date: '2026-05-31',
    tag: 'site',
    title: 'Self-hosted Markdown report now matches the full In-the-Wild format',
    summary:
      'The downloadable Markdown report from the self-hosted dashboard was missing detail the curated reports have. It now includes, per dimension, HOW it was tested (Method) and its language Coverage — served from /dimension-meta.json — plus a dedicated Test Coverage section (function coverage, test files, test cases, frameworks) and a Security Findings summary (severity counts + items + fixes). It also appends a Tier-2 section listing the generated tests and their sandbox pass/fail when a Generate & Run was done in the session — so the downloaded report reflects the Tier-2 run, not just Tier-1. Every finding keeps its suggested-fix bullet. The website report\'s Markdown export (run-test flow) now produces the same detailed format, including the Tier-2 run.',
  },
  {
    version: '0.36.3',
    date: '2026-05-30',
    tag: 'site',
    title: 'Download Report on the self-hosted dashboard',
    summary:
      'The self-hosted dashboard (localhost:33221) only had "Print / Save PDF". It now has "Download Report (Markdown)" and "Download JSON" buttons. The Markdown export is a full report — overall score, a 22-dimension scores table, and every finding grouped by dimension with its location, description, and suggested fix — so you can save, share, or commit it. JSON gives you the complete raw analysis.',
  },
  {
    version: '0.36.2',
    date: '2026-05-30',
    tag: 'precision',
    title: 'Tier-2 sandbox works without the registry — build-locally fallback',
    summary:
      'Self-hosted Tier-2 could fail to run generated tests if the sandbox runner image couldn\'t be pulled (private registry, offline, or rate-limited) — surfacing as a confusing "0/0 ERRORED". The runner now falls back to BUILDING the image locally from the Dockerfile bundled in the npm package when the pull fails, so Tier-2 works with nothing but Docker — no registry access required (first run ~20-40s to build, cached after). Combined with 0.36.1\'s clean-JSON fix, generated tests now actually execute and report real pass/fail. The published runner images are also multi-arch now (amd64 + arm64) so they run on Intel/AMD Linux servers, not just Apple Silicon.',
  },
  {
    version: '0.36.1',
    date: '2026-05-30',
    tag: 'precision',
    title: 'Fix Tier-2 "0/0 ERRORED" — sandbox now reports real results',
    summary:
      'Some Tier-2 runs showed a baffling "0/0 tests passed, ERRORED" even though generation succeeded and the model was billed. Root cause: the JS sandbox ran vitest with the JSON report going to stdout, and elaborate generated tests printed enough to stdout to corrupt that JSON — so the parser saw garbage and reported a blank error. The runner now writes the JSON report to a file and streams only that to stdout (vitest\'s own output goes to stderr), so results parse cleanly: the same tests now report e.g. 3/4 passed with real assertion messages. When the sandbox genuinely can\'t run a test, the actual error (stderr tail) is surfaced in the report instead of a blank "ERRORED". Runner images are now version-pinned (v0.36.1) so the fix actually reaches self-host users — Docker caches :latest and never re-pulls it, so a new MCP pulls the new tag. The Go runner stopped discarding compile errors too; the Python runner was already correct.',
  },
  {
    version: '0.36.0',
    date: '2026-05-30',
    tag: 'platform',
    title: 'Managed BYOK — use the hosted Tier-2 with your own OpenRouter key',
    summary:
      'You can now run the HOSTED Generate & Run with your OWN OpenRouter key — on any plan, no self-host required. Add your key under Account → API Keys → "Tier-2 AI Key (BYOK)"; it is encrypted at rest (AES-256-GCM, key derived from the session secret), never displayed back, and only decrypted server-side to forward to the sandbox for your generation. The MCP gained a per-request key path: the managed proxy forwards your key as an X-LLM-Key header (honored only behind the run-secret gate, used transiently, never stored or logged), so generation runs on your key and OpenRouter billing while we run the Docker sandbox. A fair monthly cap (max(50, your plan\'s Tier-2 limit)) protects the shared sandbox; self-host the MCP for unlimited runs. Free users with a BYOK key now get hosted Tier-2 instead of a 402, and a "Generate Tests (Tier 2)" button now appears right under every analysis report (managed + run-test flows) — it runs on your key if you have one, or points you to add a key / upgrade. Prefer fully local? The self-hosted MCP settings panel still keeps your key and code entirely on your machine.',
  },
  {
    version: '0.35.0',
    date: '2026-05-30',
    tag: 'platform',
    title: 'Docker preflight + in-dashboard settings (no more confusing Tier-2 failures)',
    summary:
      'Tier-2 runs generated tests in a Docker sandbox — but when Docker was missing the dashboard showed a baffling "ERRORED 0/0". Now there is a real Docker preflight: if Docker is not installed or its daemon is down, the tests are still GENERATED and shown, clearly marked "generated · not run", with a one-line reason and install help — never a silent error. A new /status endpoint reports Docker + AI-provider readiness, and the dashboard shows a banner up-front if either is missing. Biggest addition: a Settings panel right on the local dashboard (localhost:33221 → ⚙ Settings) to configure the AI provider WITHOUT the CLI — paste an OpenRouter key or point Tier-2 at a local Ollama/LM Studio model, and it applies immediately (no restart). Backed by GET/POST /config, which writes ~/.testforge/.env and is strictly local-only (loopback + never on a managed deployment, whose key comes from real env). On the website, the Account → API Keys page now explains that free-plan Tier-2 is BYOK via the self-hosted MCP (set your key in its Settings panel) — and the "Generate New Key" button now surfaces errors instead of failing silently.',
  },
  {
    version: '0.34.1',
    date: '2026-05-30',
    tag: 'precision',
    title: 'Tier-2 fixes: no-filePath 500, local run-secret 401, always-latest npx',
    summary:
      'Three fixes for self-hosters running Tier-2. (1) Generate-and-run crashed with a 500 (Cannot read properties of undefined reading toLowerCase) when a finding had no file path — supply-chain, license, and project-level Kubernetes findings (e.g. "No NetworkPolicy") have none. detectLanguage and the filename builder now handle that, and the handler returns a clean 422 instead of a 500 if anything else slips through. (2) The 0.34.0 setup wizard wrote a Tier-2 run secret by default, which locked LOCAL users out of their own dashboard (it sends no bearer) → 401. The wizard now defaults to NO secret for local use and clears a stale one on re-run; additionally the gate auto-exempts loopback requests whose secret came from the local config file, so already-affected users are fixed just by updating — while managed deployments (secret from real env) stay gated. (3) The IDE config snippets (Claude/Cursor/Windsurf) and a few docs commands were missing @latest, so npx relaunched a long-cached old version (some users were stuck on 0.25.2). Every install command now pins @latest. OpenRouter Tier-2 was never broken — verified end-to-end alongside local Ollama.',
  },
  {
    version: '0.34.0',
    date: '2026-05-29',
    tag: 'platform',
    title: 'Setup wizard, local-AI support, and big-repo fixes',
    summary:
      'Self-hosting is now a guided experience. `npx @whitenoisenpm/testforge-mcp setup` launches a small interactive configuration menu — pick your AI provider, port, and Tier-2 run secret, and it writes ~/.testforge/.env (chmod 600), which the server loads on startup (real environment variables always override it). The big addition: Tier-2 test generation now works with ANY OpenAI-compatible endpoint, not just OpenRouter — point TESTFORGE_LLM_BASE_URL at a local model server (Ollama http://localhost:11434/v1, LM Studio, vLLM) for free, fully-private generation with no cloud key. There is no database to install — run history auto-stores in local SQLite (~/.testforge/history.db). Also fixed: the git-clone timeout was a hard 30s that failed on large monorepos (Supabase is ~1.3 GB even at depth 1) — now configurable via TESTFORGE_CLONE_TIMEOUT_MS, default raised to 120s. `--help` documents every variable. Docs rewritten around the real self-host flow.',
  },
  {
    version: '0.33.0',
    date: '2026-05-29',
    tag: 'precision',
    title: 'No more crying wolf — scoring hardened across every dimension',
    summary:
      'Re-running the In-the-Wild showcase repos against 0.32.0 exposed that the cliff-to-0 bug class lived in more dimensions than the first pass caught (langchain Edge Cases 0/100 with 25 findings; TestForge\'s own Supply Chain 0/100 with 26). This pass routes EVERY finding/count-based scorer — Edge Cases, Supply Chain, Contract, Visual Regression, Chaos, N+1, License, Vision, Agentic, Accessibility, Predictive — through the shared diminishing-returns curve, so no dimension can bottom out from low-severity pile-ups. Three deeper "cry-wolf" fixes: (1) Predictive risk is now size-independent — it scores off surfaced hotspot severity, not an unbounded repo-wide sum, so large mature codebases stop flooring to 10; (2) generated/vendored files (codegen clients like schemas.gen.ts, .d.ts, protobuf stubs, minified bundles, vendored trees) are excluded from risk-hotspot and dead-code reporting — you regenerate them, not refactor them; (3) Dead Code only checks runtime deps (devDependencies are build/lint/test tooling that\'s config- or CLI-invoked, never imported, so flagging them "unused" was noise), and Accessibility scores on issue DENSITY (per √UI-file) instead of raw volume so a large clean app isn\'t tanked by absolute count. Verified across a Python monorepo, a polyglot template, a 78k-star TS monorepo, and TestForge itself.',
  },
  {
    version: '0.32.0',
    date: '2026-05-29',
    tag: 'precision',
    title: 'Principled scoring — no more 0/100 or null cliffs',
    summary:
      'Scores are what people fixate on, so every dimension now scores on solid logic. A new shared scorer (lib/score.ts) replaces the old linear "100 − Σcost" formulas that cliffed to 0 once a repo accumulated enough findings — even all low-severity ones. It uses diminishing returns: the score degrades smoothly from 100 toward a non-zero floor, severity-weighted and monotonic, so 0 is reserved for the genuinely catastrophic and N/A is rendered separately (never as a number). Three concrete fixes: Kubernetes no longer reads 0/100 for a running platform with hardening gaps; Dead Code no longer cliffs to 0 from false-positive "unused" Python/Go packages (the JS import-matcher is now fed npm-only deps, since it can\'t trace non-JS imports); and Load now returns a real readiness capability score instead of null (credit for rate-limiting/caching/pooling/health-probes/timeouts/circuit-breakers/compression/LB/CDN, penalty for blocking sync I/O). Backed by new tests asserting monotonicity, severity-weighting, and no-cliff behavior.',
  },
  {
    version: '0.31.0',
    date: '2026-05-29',
    tag: 'analyzer',
    title: 'Kubernetes dimension + honest per-dimension findings',
    summary:
      'A 22nd dimension: TestForge now parses every Kubernetes manifest and Helm chart (Go-template expressions stubbed) and checks PodSpecs + RBAC — securityContext (runAsNonRoot/privileged/allowPrivilegeEscalation), resource requests/limits, liveness/readiness probes, mutable image tags, wildcard RBAC, secrets-in-ConfigMaps, and NetworkPolicy presence. For a k8s platform the real risk lives in YAML, not app code, and this was the biggest blind spot (16 of 21 dimensions wanted it). Reports also stop headlining only security: findings are now grouped by dimension with how-each-was-tested (method), language/coverage breadth, and the N/A reason — so a high score can never hide an unanalyzed half of a polyglot repo.',
  },
  {
    version: '0.30.0',
    date: '2026-05-29',
    tag: 'platform',
    title: 'Real simulation engine — load, agent & chaos actually run',
    summary:
      'The simulation-named dimensions stop being heuristics and start measuring. /simulate boots a runnable repo (Dockerfile or docker-compose) in an isolated, resource-capped sandbox and drives live traffic: a load ramp to the breaking-point concurrency, a fleet of think-time agents, and a mid-load crash to measure error-spike + recovery time. Async (jobId + poll) so multi-minute runs don’t time out. Also in this release: per-line Python edge-case analysis via a python3 AST pass (FastAPI/Flask/Django backends finally get deep checks, not just project-level), and a Tier-2 fix where same-rule findings collided on one filename and silently dropped tests (dkubex: 13 → 33 executed).',
  },
  {
    version: '0.29.0',
    date: '2026-05-28',
    tag: 'polyglot',
    title: 'Polyglot Tier-2 — generate AND run tests in a sandbox',
    summary:
      'Tier-2 went polyglot and real: the LLM generates a targeted test per finding and TestForge executes it in a hardened, network-less, resource-capped Docker sandbox — Vitest for JS/TS, pytest for Python, go test for Go — parsing each framework’s output into a uniform pass/fail result. Hardened with cap-drop ALL, no-new-privileges, tmpfs-only scratch, and a shared-secret gate on the managed path.',
  },
  {
    version: '0.28.6',
    date: '2026-05-28',
    tag: 'precision',
    title: 'Security analyzer precision pass',
    summary:
      'Hand-verified the Supabase report’s 41 findings (1 critical, 28 high) — almost all cry-wolf. Now: example/demo paths are skipped, window.open is no longer misread as filesystem path traversal, injection-sink severity tracks confidence (unproven taint → low instead of a score-tanking high), internal redirects aren’t flagged as open redirects, and the low-confidence “route without auth” heuristic is medium. Supabase security score 0 → 95.',
  },
  {
    version: '0.28.5',
    date: '2026-05-28',
    tag: 'precision',
    title: 'Accessibility analyzer precision pass',
    summary:
      'Self-audit surfaced an a11y false-positive cluster. Fixed: contrast no longer matches backgroundColor/borderColor or light-text-on-dark config; tables scan their body for <th> instead of just the opening line; conditional button labels count as accessible names; {...props} primitives and <label htmlFor>/<input id> pairs are recognized; structural-role and aria-hidden clickables are exempt; and inline // testforge-disable now works for a11y too.',
  },
  {
    version: '0.28.4',
    date: '2026-05-28',
    tag: 'accessibility',
    title: 'Accessibility analyzer skips test paths',
    summary:
      'Test fixtures intentionally contain broken markup to exercise the analyzer. The a11y pass now skips test paths the same way the security analyzer does, so deliberately-broken fixtures stop counting against a real score.',
  },
  {
    version: '0.28.3',
    date: '2026-05-28',
    tag: 'precision',
    title: 'Security + a11y precision pass',
    summary:
      'First broad false-positive cleanup driven by the public reports: the SQL-injection receiver heuristic split into strong vs. weak query methods (killing ~10 Supabase false criticals), and contrast became luminance-aware instead of flagging every hex color.',
  },
  {
    version: '0.28.2',
    date: '2026-05-28',
    tag: 'analyzer',
    title: 'Coverage + mutation correctness fixes',
    summary:
      'Coverage gained a ratio fallback for library-style repos where function-name matching under-reports, and mutation analysis now gates on actual test-file count and recognizes pytest / Go test files.',
  },
  {
    version: '0.28.1',
    date: '2026-05-28',
    tag: 'security',
    title: 'Version-aware vulnerable-deps + self-audit closed',
    summary:
      'The vulnerable-dependency check short-circuits when the declared version’s major is above the CVE’s upper bound (express ^5 no longer flagged for a <4.17.3 CVE). Shipped alongside TestForge’s own self-audit going 27 findings → 0.',
  },
  {
    version: '0.28.0',
    date: '2026-05-27',
    tag: 'polyglot',
    title: 'Go native support',
    summary:
      'Added Go to the native-parse set: go.mod parsing, Gin/Echo/Chi/Fiber endpoint detection, and Go test-file recognition — completing the JS/TS + Python + Go polyglot story.',
  },
  {
    version: '0.27.2',
    date: '2026-05-28',
    tag: 'accessibility',
    title: 'Accessibility N/A on non-UI repos',
    summary:
      'The a11y dimension now hard-filters to UI files and reports applicable:false for backend/CLI/data repos — LangChain stopped scoring 10/100 for “empty links” found in its README.',
  },
  {
    version: '0.27.1',
    date: '2026-05-28',
    tag: 'security',
    title: 'Rate-limit check only fires on web apps',
    summary:
      'Missing Rate Limiting is gated on the presence of a web framework dependency, so libraries and CLIs aren’t penalized for lacking something they don’t need.',
  },
  {
    version: '0.27.0',
    date: '2026-05-28',
    tag: 'security',
    title: 'Suppress security findings in test paths',
    summary:
      'Per-file security emission now skips test paths. The same patterns that flag real vulnerabilities (string-built SQL, eval, hardcoded creds) are usually intentional inside tests — this removed a huge swath of Supabase “criticals” that lived in e2e/ files.',
  },
  {
    version: '0.26.2',
    date: '2026-05-27',
    tag: 'polyglot',
    title: 'Conventional monorepo recursion',
    summary:
      'Recurses into conventional workspace folders (libs/, packages/, apps/, services/) so monorepos are analyzed whole rather than just at the root.',
  },
  {
    version: '0.26.1',
    date: '2026-05-27',
    tag: 'polyglot',
    title: 'Workspace recursion + [extras] regex fix',
    summary:
      'npm/yarn/pnpm/bun + uv workspace member discovery, plus a fix to the Python [extras] dependency regex.',
  },
  {
    version: '0.26.0',
    date: '2026-05-27',
    tag: 'polyglot',
    title: 'Python support — close the polyglot blind spot',
    summary:
      'The analyzer was JS/TS-only. Added native Python: requirements.txt / pyproject.toml parsing, FastAPI/Flask/Django endpoint detection, and a languageCoverage honesty banner so reports state what was and wasn’t parsed natively.',
  },
  {
    version: '0.25.2',
    date: '2026-05-27',
    tag: 'platform',
    title: 'Runner image to GHCR + auto-pull',
    summary: 'The Tier-2 Docker runner image is published to GHCR and auto-pulled on demand.',
  },
  {
    version: '0.25.1',
    date: '2026-05-27',
    tag: 'platform',
    title: '/health reports the correct version',
    summary: 'Health endpoint now returns the actual package version instead of a stale constant.',
  },
  {
    version: '0.25.0',
    date: '2026-05-27',
    tag: 'platform',
    title: 'Tier-2 managed runner groundwork',
    summary: 'Plumbing for the managed test-runner tier ahead of the GHCR image publish.',
  },
  {
    version: '0.24.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'Stack polish — strict dependency sets',
    summary: 'Dimension-deepening pass 16: tighter dependency classification and new stack-quality signals.',
  },
  {
    version: '0.23.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'Visual regression + property-based detection',
    summary: 'Pass 15: recognizes visual-regression and property-based testing setups.',
  },
  {
    version: '0.22.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'AST edge-case detection',
    summary: 'Pass 14: AST-driven detection of unhandled edge cases.',
  },
  {
    version: '0.21.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'Vision + scope precise matching',
    summary: 'Pass 13: more precise matching of stated product vision and feature scope against the code.',
  },
  {
    version: '0.20.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'DORA capability framing',
    summary: 'Pass 12: frames findings against the four DORA delivery-performance capabilities.',
  },
  {
    version: '0.19.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'Mutation testing — assertion quality',
    summary: 'Pass 11: assesses whether tests actually assert behavior or just execute code.',
  },
  {
    version: '0.18.0',
    date: '2026-05-27',
    tag: 'analyzer',
    title: 'Chaos / resilience patterns',
    summary: 'Pass 10: AST detection of timeouts, retries, circuit breakers, and graceful-degradation patterns.',
  },
  {
    version: '0.17.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'License audit (SPDX-categorized)',
    summary: 'Pass 9: SPDX-categorized license audit across dependencies.',
  },
  {
    version: '0.16.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Lockfile-aware supply-chain audit',
    summary: 'Pass 8: supply-chain analysis that reads lockfiles for resolved versions.',
  },
  {
    version: '0.15.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Honest OWASP coverage',
    summary: 'Pass 7: maps findings to OWASP categories and is explicit about what is and isn’t covered.',
  },
  {
    version: '0.14.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'AST load patterns + sync I/O',
    summary: 'Pass 6: detects blocking sync I/O and load-sensitive patterns via AST.',
  },
  {
    version: '0.13.0',
    date: '2026-05-26',
    tag: 'accessibility',
    title: 'AST-based JSX accessibility',
    summary: 'Pass 5: the first AST-based accessibility checks for JSX/TSX (the foundation the 0.28.x precision passes built on).',
  },
  {
    version: '0.12.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'Predictive cross-signal risk',
    summary: 'Pass 4: combines signals across dimensions into a predictive risk score.',
  },
  {
    version: '0.11.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'Contract analysis (OpenAPI + AST)',
    summary: 'Pass 3: checks code against OpenAPI contracts using the AST.',
  },
  {
    version: '0.10.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'AST-aware unit test quality',
    summary: 'Pass 2: evaluates unit-test quality structurally rather than by file count.',
  },
  {
    version: '0.9.0',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'AST-aware N+1 + dead-code',
    summary: 'Pass 1 of the dimension-deepening series: AST detection of N+1 query patterns and dead code.',
  },
  {
    version: '0.8.1',
    date: '2026-05-26',
    tag: 'analyzer',
    title: 'Internal type tightening',
    summary: 'Lint cleanup and internal type tightening publish.',
  },
  {
    version: '0.8.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'User-authored rules DSL',
    summary: 'Phase 4c of the security engine: a DSL for project-specific rules loaded from .testforge/rules.yaml.',
  },
  {
    version: '0.7.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Cross-file taint propagation',
    summary: 'Phase 4b: taint flows tracked across file boundaries.',
  },
  {
    version: '0.6.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Cross-function taint propagation',
    summary: 'Phase 4a: taint tracked across function calls within a file.',
  },
  {
    version: '0.5.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Structured fix suggestions',
    summary: 'Phase 3: findings carry before/after fix suggestions with an applicability flag.',
  },
  {
    version: '0.4.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'Generalized taint engine + sanitizer registry',
    summary: 'Phase 2: a general taint engine with a registry of recognized sanitizers.',
  },
  {
    version: '0.3.0',
    date: '2026-05-26',
    tag: 'security',
    title: 'AST-based security analyzer',
    summary: 'Phase 1: replaced regex scanning with a real Babel-AST security analyzer — confidence levels, column-accurate locations, inline suppressions, and taint tracking.',
  },
  {
    version: '0.2.0–0.2.19',
    date: '2026-05-24',
    tag: 'foundation',
    title: 'Initial MCP server bring-up (19 rapid iterations)',
    summary:
      'The first two days: stand up the MCP server, full report rendering, default port → 33221, and persist /test and /quick-scan runs to a local ~/.testforge/history.db. Foundational, fast, and public from day one.',
  },
];

// Headline stat for the page hero.
export const RELEASE_COUNT = 57; // published versions on npm (0.2.0 → 0.28.6)
export const FIRST_RELEASE_DATE = '2026-05-24';
export const LATEST_VERSION = '0.28.6';
