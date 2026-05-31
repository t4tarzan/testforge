# Status & Handoff

> **Fresh context? Read this first.** It's the "what happened + where we are"
> entrypoint. Last updated: 2026-05-31.
> Read order: **this file → [[TestForge]] (knowledge map) → the changelog
> (`src/data/changelog.ts`) → agent memory (deploy/ops)**.

## Current state
- **`main` = 0.36.5** (merged 2026-05-31, PR #47). **npm
  `@whitenoisenpm/testforge-mcp` + live managed MCP `mcp.testforge.run` still =
  0.36.4** — 0.36.5 is **not yet published / redeployed** (manual step below).
  Website auto-deploys from `main` (Vercel), so the 0.36.5 changelog is live.
- Three planes, one analyzer core: web (Vercel) · managed MCP (a VPS) · self-host
  MCP (`npx`). See [[Architecture]].
- 331 MCP tests pass; CI gates on lint (0 errors) + tests + build. **Run
  `npm run lint` before every push** ([[feedback_testforge_ci_lints]] in memory).
- All green and shipped — no known broken state.
- **Pending publish:** `cd mcp-server && npm publish` (bump already done), then
  redeploy the live MCP (deploy recipe in agent memory — [[hetzner-oc-server]]).

## What's been built (recent arcs — detail in the changelog + [[Evolution]])
- **Scoring overhaul (0.32–0.33)** — diminishing-returns, no-cry-wolf; killed
  0/100 + null cliffs, generated-file & polyglot-dep false flags. [[Scoring]].
- **Kubernetes dimension (0.31)** — 22nd dimension; grouped-by-dimension reports.
- **Simulation engine (0.30)** — real load/agent/chaos runs. [[Simulation-Engine]].
- **Self-host UX + BYOK (0.34–0.36)** — setup wizard, local-AI (Ollama/LM Studio),
  Docker preflight, in-dashboard Settings, **managed BYOK** (own OpenRouter key,
  encrypted), Tier-2 sandbox fixes (the `0/0 ERRORED` bug), multi-arch +
  version-pinned runner images + build-locally fallback, **Download Report**,
  rich per-dimension report breakdown. [[Tier2-Sandbox]], [[Self-Host-and-BYOK]],
  [[Reports]].
- **Docs pass** — this knowledge graph (`docs/knowledge/`), refreshed READMEs,
  rewritten website Docs (MCP Server, Install/CLI, API reference).
- **dkubex** — private deep-test target; report/video kept **local-only**
  (gitignored), never deployed.

## Where we are NOW (in-flight)
Building an **autonomous, continuous self-improvement loop** for TestForge.
Decision (2026-05-31): start at **L0 — propose-only**, focus on the
**self-flywheel (quality)**, **orchestrated by hermes** (Claude = brain, hermes =
hands, local AI = routine triage, Telegram = comms).

The loop each cycle: run TestForge on itself + a rotating showcase repo → (local
AI triages findings) → Claude does gap analysis → posts a **ranked improvement
plan + digest** (no code changes yet) → appends a ledger so it doesn't repeat.
Earn autonomy later by graduating *mechanical* change-classes to auto-PR/auto-
merge behind a four-layer gate (CI · TestForge-self-grade · adversarial-review ·
E2E). Full design: [[Flywheel]] / `docs/flywheel/`.

**The loop is now built and ships with the repo: [`hermes/`](../../hermes/README.md).**
It's a self-contained Node package, scheduler-agnostic (hermes is just the hands):
- `hermes/scan.mjs` — **gather** (Status step 1 ✓): ensures the local analyzer
  (`:33221`), grades the repo's **tracked tree** (a `git archive` export — *not*
  gitignored `dist/`/`node_modules`, which otherwise drown the proposer in phantom
  criticals) + a date-rotating showcase repo → proposer-shaped `state/findings.json`.
- `hermes/cycle.mjs` — **orchestrator**: scan → assemble bundle (findings + ledger
  + recent changelog) → `claude -p` (configurable via `$TESTFORGE_BRAIN`) → append
  ledger → print the Telegram digest on stdout.
- `hermes/register-hermes.sh` — `hermes cron create … --no-agent --deliver telegram`.
- `hermes/ledger.md` — seeded anti-repeat memory (`$TESTFORGE_LEDGER` to point at
  the Obsidian note in prod).

**First cycle already paid off (2026-05-31, shipped in 0.36.5 via PR #47).** The
gather step grades the tracked tree; Claude ran the propose step manually and
the loop's findings drove two real precision fixes — both monorepo blind spots
TestForge surfaced *on itself*:
- **#1 ✓ shipped** — Stack/DORA "no testing framework" false negative (checked
  only root devDeps; vitest lives in the `mcp-server/` sibling). Now a test
  *file* is sufficient signal. **stack 79→99, dora 25→55.** ([[Scoring]] no-cry-wolf.)
- **#2 ✓ shipped** — dead-code unused-dep false positives: dynamic `import()`
  was invisible to the AST walker + the parse loop skipped any path containing
  the substring `"test"`. **unusedDeps 9→4.**
- The ledger (`hermes/ledger.md`) records both as `shipped`, plus a deferred
  **#3 proposed** (dead-code companion-package awareness: react-router ↔
  react-router-dom) and **#4 proposed** (triage 25 known-vulnerable deps).

`scan.mjs` was also widened this cycle: `findings[]` now merges *all* dimensions
(not just security) + a `signals` block, so the brain sees the real signal.

### Next steps (pick up here)
1. **Publish 0.36.5** — `cd mcp-server && npm publish`, then redeploy the live
   MCP (recipe in [[hetzner-oc-server]]). Version + changelog already landed.
2. **Automate the brain** — the propose step has only been run manually so far.
   Wire `node hermes/cycle.mjs` (not `--dry`) to invoke `claude -p` for real;
   tune `extractDigest` / `extractLedgerEntries` in `cycle.mjs` if the output
   drifts from the prompt shape.
3. **Decide where the ledger lives** — set `$TESTFORGE_LEDGER` to the hermes-
   managed Obsidian note (currently defaults to the in-repo `hermes/ledger.md`).
4. **Turn it on** — `hermes/register-hermes.sh --create` (schedule + Telegram).
5. **Pick up the ledger backlog** — #4 (the 25 known-vulnerable deps via
   `npm audit`), then #3 (companion-package awareness).
6. **Feed `signals.md`** / **local-AI triage** (optional) — `$TESTFORGE_TRIAGE`
   + CI/Vercel/MCP error clusters into `hermes/state/signals.md`.

## Operational quick-reference
- **Test/lint/build:** `cd mcp-server && npx vitest run` · `npm run lint` (repo root) · `npm run build`.
- **Publish MCP:** bump `mcp-server/package.json`, add a changelog entry, commit, `cd mcp-server && npm publish`.
- **Redeploy live MCP + runner images:** see the deploy recipe in agent memory ([[hetzner-oc-server]]) — git pull on the VPS, rebuild the MCP image, recreate the container with the full env (run-secret, socket-proxy, runner image tags).
- **Runner images:** must stay **public + multi-arch + version-pinned** on GHCR; GHCR visibility is **UI-only** (no API). See [[testforge-runner-images]] in memory.
- **Canonical sources:** changelog (dated history) · `docs/knowledge/` (this graph) · `dimensionMeta.ts` (per-dimension truth) · agent memory (private ops/secrets — NOT in this repo).

## Keep this current
When a meaningful chunk of work lands, update this file's **Current state** +
**Where we are NOW**, and add the changelog entry. This is the handoff a future
session reads.
