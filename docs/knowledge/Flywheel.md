# Flywheel — autonomous self-improvement loop (design)

Back to [[TestForge]]. Status/decisions: [[Status]]. The brain prompt:
`docs/flywheel/proposer-prompt.md`.

**Goal:** hour after hour, surface the highest-value *real* gap in TestForge,
attempt the safe ones (later), prove them, and report the rest — so quality
compounds without rotting. The product can **grade its own work**, which is the
honest fitness function most autonomous-coding loops lack.

## Brain / hands (hermes model)
- **Claude (brain)** — gap analysis, prioritization, the change, adversarial review.
- **Hermes (hands)** — scheduling, Telegram I/O, git/PR plumbing, invoking local models + `claude -p`.
- **Local AI (Ollama)** — cheap routine: triage logs, dedupe/cluster findings, summarize, draft.

## Autonomy levels (graduate, don't leap)
- **L0 · Propose** *(current)* — post a ranked plan + daily digest. No code changes.
- **L1 · Auto-PR** — implement ONE scoped item → branch → PR → CI → ping Telegram. Never touches `main`.
- **L2 · Auto-merge safe classes** — L1 + auto-merge for pre-approved low-risk classes (deps, docs, lint, *added* tests, dead-code removal) behind the gate. Behavior/scoring/product stay gated.
- **L3 · Continuous + canary** — L2 + preview deploy + E2E + In-the-Wild regen before merge; nightly publish.

## The L0 cycle (what hermes runs each heartbeat)
1. **Gather** — run TestForge (`/clone-and-analyze`) on itself + one rotating showcase repo → findings JSON. Also collect CI/Vercel/MCP error signals + new Telegram user feedback.
2. **Triage** (local AI) — dedupe/cluster, drop noise.
3. **Propose** (Claude) — feed findings + the ledger + recent changelog + roadmap to `docs/flywheel/proposer-prompt.md` → a ranked plan.
4. **Emit** — append to the **ledger** (hermes-managed Obsidian note: proposed / shipped / rejected, with dates + evidence) and post a short digest to Telegram.
5. **Learn** — the ledger prevents re-proposing; metric deltas (coverage, mutation, dead-code, bundle) tracked over time.

Most cycles should be cheap; a **do-nothing cycle is a success**, not a failure.

## The four-layer verification gate (required before any future auto-change)
1. **CI** — lint (0 errors) + 326 tests + build.
2. **Self-grade** — run TestForge on the diff/repo; **no score regression** on touched dimensions; **never** reduce test count / drop coverage / weaken a security finding.
3. **Adversarial review** — a second Claude that tries to *refute* the change; kill if it can't survive.
4. **Behavioral** — Playwright E2E + In-the-Wild report regen diff.

## Anti-patterns to design against
Reward hacking (deleting tests / suppressing findings to "improve" a metric) ·
churn/busywork (require evidence of impact) · scope creep (one change/cycle, size
cap, serialized branch) · silent product drift (UX/scoring stay human-gated
longer) · token burn (local-model the cheap steps; batch).

## Why this is on-brand
The changelog already narrates "the In-the-Wild flywheel ships another release."
This industrializes that: real findings → fix the worst → prove with the same
tool → the next report shows the gain. See [[Reports]], [[Scoring]], [[Evolution]].
