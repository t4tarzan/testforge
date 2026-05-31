# Evolution

Back to [[TestForge]]. The authoritative, dated record is the **changelog**
(`src/data/changelog.ts` → `testforge.run/#/changelog`). This note is the
*narrative* — the arcs and the "why" behind the releases.

## Arc 1 — Depth (0.6.0 → 0.24.x): substring → AST
Every dimension started as substring/regex matching and was deepened to real
AST analysis over ~16 passes (unit, N+1, dead-code, contract, predictive,
load, a11y, OWASP, supply-chain, license, chaos, mutation, DORA, vision/scope,
edge-cases, property-based, stack). The recurring bug it killed: substring traps
like `dep.includes('vite')` matching `vitest`. A user-authored rules DSL
(`.testforge/rules.yaml`) and cross-file taint propagation landed here.

## Arc 2 — Polyglot (0.25 → 0.29): beyond JS/TS
- **Tier-2** (0.25.x) — LLM-generated Vitest + sandboxed Docker execution; runner
  image to GHCR with auto-pull. See [[Tier2-Sandbox]].
- **Python native** (0.26) — FastAPI/Flask/Django routes, requirements/pyproject
  parsing, pytest; plus monorepo recursion (workspaces, `libs/*`) and a TOML
  `[extras]` parser fix. The `languageCoverage` honesty banner appears.
- **Go native** (0.29) + a string of **precision passes** driven by the
  In-the-Wild showcase ([[Reports]]): test-path security suppression (Supabase:
  125 "critical" → a trustworthy few), rate-limit only on web apps (LangChain),
  accessibility N/A on non-UI repos, version-aware vulnerable-deps.

## Arc 3 — Real execution (0.30): simulation engine
[[Simulation-Engine]] — load / agent / chaos actually run against the booted app
(autocannon, docker pause/restart faults), not just static guesses. Warmup
window, compose-aware boot, async jobId+poll.

## Arc 4 — Kubernetes + honesty (0.31)
The **22nd dimension, Kubernetes** ([[Dimensions]]) — the biggest blind spot for
a k8s platform (the real risk is in YAML). Reports switch to **grouped-by-
dimension** with per-dimension method/coverage/N-A.

## Arc 5 — Trust the numbers (0.32 → 0.33): no cry-wolf
[[Scoring]]. 0.32 introduced diminishing-returns scoring (kill 0/100 + null
cliffs). 0.33 was the decisive pass: re-running the showcase repos proved the
cliff bug lived in *more* dimensions (langchain Edge Cases 0/25-findings;
TestForge's own Supply Chain 0/26). Fixed across edgeCases/supplyChain/contract/
visualRegression/chaos/nPlusOne/license/vision/agentic/accessibility/predictive;
made predictive size-independent; excluded generated/vendored files; dead-code
checks runtime deps only.

## Arc 6 — Self-host UX (0.34 → 0.35)
- **Setup wizard** + **local-AI** (point Tier-2 at Ollama/LM Studio) + clone
  timeout fix for huge monorepos. See [[Self-Host-and-BYOK]].
- Fixes: no-filePath 500, the local run-secret 401 (the wizard wrongly set a
  secret that locked users out of their own dashboard — now exempt for loopback
  + file-sourced secrets), and **always-`@latest`** install commands (users were
  stuck on cached 0.25.2).
- **Docker preflight** + in-dashboard **Settings panel** + `/status` (no more
  confusing Tier-2 failures).

## Arc 7 — Managed BYOK + the Tier-2 sandbox saga (0.36.x)
- **0.36.0 Managed BYOK** — hosted Tier-2 with your own OpenRouter key, encrypted
  at rest; a Tier-2 button now appears on the generated reports.
- **0.36.1** — the "`0/0 ERRORED` after a real OpenRouter charge" mystery: the JS
  runner's JSON-to-stdout was corrupted by test output. Now writes to a file →
  real pass/fail. Multi-arch + version-pinned runner images.
- **0.36.2** — build-the-runner-locally fallback (the GHCR packages were private →
  pulls 401'd; later made public, but the fallback means Tier-2 needs only
  Docker regardless).
- **0.36.3 / 0.36.4** — Download Report on the self-host dashboard, then the
  Markdown (self-host + web export) brought to full In-the-Wild parity:
  method/coverage per dimension, Test Coverage + Security sections, Tier-2 run.

## Arc 8 — the self-improvement flywheel (0.36.5)
The In-the-Wild loop turned inward: **TestForge now grades itself on a schedule.**
- **`hermes/` L0 flywheel built + ships with the repo** (scheduler-agnostic;
  hermes = hands). `scan.mjs` grades the *tracked tree* (`git archive`, so
  build artifacts don't drown the signal) + a rotating showcase repo →
  proposer-shaped `findings.json` (all-dimension findings + a `signals` block);
  `cycle.mjs` feeds it to a brain (`claude -p`) → ranked plan + ledger + digest.
  Design: [[Flywheel]]. Anti-repeat memory: `hermes/ledger.md`.
- **First cycle, run on TestForge itself, shipped three fixes** — all monorepo
  blind spots the product surfaced *on its own code*:
  - **#1** Stack/DORA "no testing framework" false negative — they checked only
    root `package.json` devDeps; vitest lives in the `mcp-server/` sibling. Now a
    test *file* is sufficient signal (`lib/test-presence.ts`). stack 79→99, dora
    25→55. ([[Scoring]] no-cry-wolf, applied to ourselves.)
  - **#2** dead-code unused-dep false positives — dynamic `import()` was invisible
    to the AST walker, and the parse loop skipped any path containing the
    substring `"test"` (e.g. `generate-tests.ts`). unusedDeps 9→4.
  - **#4** supply-chain triage — verified vs `npm audit`: root 21→14 via a
    non-breaking lockfile fix; refused the `npm audit fix --force` regression
    (it downgrades `@vercel/node` 5→4). Breaking migrations (undici via
    `@vercel/node`, fastify v4→v5) deferred as ledger proposals.
- Shipped through the full gate (CI · self-grade · Playwright/Vercel) as PRs
  #47/#49, published to npm, and **redeployed to the live VPS** — all three
  planes on 0.36.5. The brain step was run manually this cycle; automating it
  (`claude -p` on a schedule) is the open next step in [[Status]].

## Cross-cutting themes
- **The In-the-Wild reports are the test harness.** Most precision/cry-wolf bugs
  were caught by running real public repos and looking at the output.
- **One analyzer core, three surfaces.** Web, managed, self-host, and curated
  reports all share the same code so findings are consistent ([[Architecture]]).
- **Honesty over flattery.** `languageCoverage` banners, N/A-with-reasons, and
  no-cry-wolf scoring all exist so a score never hides what wasn't tested.
- **dkubex** — a private polyglot k8s platform used as the recurring real-world
  deep-test target; its report/video are kept local-only.
