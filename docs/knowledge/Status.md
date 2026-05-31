# Status & Handoff

> **Fresh context? Read this first.** It's the "what happened + where we are"
> entrypoint. Last updated: 2026-05-31.
> Read order: **this file → [[TestForge]] (knowledge map) → the changelog
> (`src/data/changelog.ts`) → agent memory (deploy/ops)**.

## Current state
- **npm `@whitenoisenpm/testforge-mcp` = 0.36.4** (latest). **Live managed MCP
  `mcp.testforge.run` = 0.36.4.** Website auto-deploys from `main` (Vercel).
- Three planes, one analyzer core: web (Vercel) · managed MCP (a VPS) · self-host
  MCP (`npx`). See [[Architecture]].
- 326 MCP tests pass; CI gates on lint (0 errors) + tests + build. **Run
  `npm run lint` before every push** ([[feedback_testforge_ci_lints]] in memory).
- All green and shipped — no known broken state.

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
Designing an **autonomous, continuous self-improvement loop** for TestForge.
Decision so far (2026-05-31): start at **L0 — propose-only**, focus on the
**self-flywheel (quality)**, **orchestrated by hermes** (Claude = brain, hermes =
hands, local AI = routine triage, Telegram = comms).

The loop each cycle: run TestForge on itself + a rotating showcase repo → local
AI triages findings → Claude does gap analysis → posts a **ranked improvement
plan + daily digest** (no code changes yet) → appends a ledger so it doesn't
repeat. Earn autonomy later by graduating *mechanical* change-classes to
auto-PR/auto-merge behind a four-layer gate (CI · TestForge-self-grade ·
adversarial-review · E2E). Full design: [[Flywheel]] / `docs/flywheel/`.

### Next steps (pick up here)
1. Build the **flywheel scan** command (one call → ranked-findings JSON for a
   target repo) — hermes's "gather" step.
2. The **proposer prompt** exists at `docs/flywheel/proposer-prompt.md` — the
   brain's instructions. Refine if needed.
3. **Wire hermes**: cron heartbeat → scan → local-AI triage → `claude -p` with
   the proposer prompt → append the ledger (in the Obsidian vault) → Telegram
   digest. Needs a look at the hermes folder to match its task interface.
4. Define where the **ledger** lives (hermes-managed Obsidian note) + the digest
   format.

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
