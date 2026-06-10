# Gap Analysis — antirez "AI-Driven Software Testing" (news/168) vs. TestForge

> Source: https://antirez.com/news/168 · Target: TestForge as of **v0.37.0** (this repo, `origin/main` merged 2026-06-09).
> Supersedes the earlier draft written against v0.36.6. Scope: methodology fit, not feature parity.

---

## 1. The article in one paragraph

antirez argues LLMs are unusually strong at **QA** and should be used as **autonomous QA engineers, not linters**. Thesis: *"covering all the lines of the code does not mean covering all the possible states."* Method: **markdown mission files** an agent executes like a human tester — (a) **inspect recent commits** to know what could regress, (b) **operate the real running system** with handed-in context (SSH, creds, paths, configs), (c) **build apps on top** and **simulate multi-user / multi-day usage** (Redis-arrays: replication + persistence over time), (d) **track baselines dynamically**, (e) catch **speed and output-coherence regressions** (DwarfStar: distributed inference, coherence across every GGUF), and (f) render **subjective "psychological" judgments** — surprise, thin docs, sloppiness. Throughline: **dynamic, stateful, change-driven, exploratory operation of the running system, plus human-style judgment.**

---

## 2. What v0.37.0 changed (this is the headline)

Between the first draft (0.36.6) and now, TestForge shipped the **"one boot engine, many lanes"** model — and three of those lanes land squarely on gaps the earlier analysis flagged:

| New in 0.37.0 | Code | Closes which earlier gap |
|---|---|---|
| **Real-code Tier-2** — every finding ships its actual source (`codeContext`/`sourceFile`); leaf modules are *imported and executed*, not recreated | `generator/source-wiring.ts`, `generate-tests.ts` | "Tier-2 tests are self-contained, don't drive the real project" |
| **Wired-unit lane** — generated `node:test` files run against the user's **real modules inside the booted app image**, where deps resolve | `simulation/wired-unit.ts` | same — covers non-self-contained apps |
| **E2E smoke crawl (Phase 1, no LLM)** — Playwright sibling container crawls ≤25 pages of the booted app; reports console errors, uncaught page errors, 4xx/5xx, axe a11y | `simulation/e2e-crawl.ts`, `runner/e2e-crawl.mjs` | "no autonomous exploration"; partial "psychological/UX" |
| **E2E user journeys (Phase 2)** — captures the live app's interaction surface, an **LLM authors realistic journeys** in a constrained step DSL (goto/click/fill/expectText/expectUrl), a **deterministic executor** runs them | `simulation/e2e-journey.ts`, `runner/e2e-journey.mjs` | "AI as QA engineer"; "use it like a user" |

**Design worth calling out:** in the journey lane *"the AI decides **what** to test; a fixed executor decides **how**"* — no model-written code ever touches the browser. This is a **safety/determinism property antirez's free-form-agent approach lacks**, while still capturing his "agent uses the product" intent.

---

## 3. Tier map (current)

| Tier / lane | What it does | antirez axis |
|---|---|---|
| **Tier-1** (22 AST analyzers) | Deterministic static pattern/taint/structure. No exec, no LLM, <2s. | Pure "cover the lines" — the thing antirez calls insufficient. Kept as the fast gate. |
| **Tier-2 · Generate & Run** | LLM writes a test per finding; **now grounded in real source**; leaf modules imported & executed in a `--network=none` sandbox. | Behavioral, real-code. Still per-finding, not journey-level. |
| **Tier-2 · Wired-unit lane** | `node:test` against the **real module inside the booted app image**. | Operates real code with real deps. |
| **Tier-2 · E2E crawl lane** | Autonomous browser crawl → console/page/HTTP/a11y errors. | Operates the running app; surfaces "surprising behavior." |
| **Tier-2 · E2E journey lane** | LLM-authored, executor-run user journeys against the live app. | **Closest to antirez** — agent decides what a user would do. |
| **Tier-2 · Simulate** | Boots app/throwaway k3s via its own Helm; load/chaos; MTTR; **static→runtime policy-enforcement verification**. | Runtime capacity/resilience; novel policy check. |
| **Tier-3 · Consensus audit** | 3 models (opus 4.8 · sonnet 4.6 · gpt-5.1), ≥2-of-3 vote; 54 bugs flagged, 13 rescued by lineage independence. | Deep reasoning about defects — reads source, doesn't operate. |

---

## 4. Tenet-by-tenet scorecard (re-graded for 0.37.0)

Legend: ✅ covered · 🟡 partial · 🔴 gap. Arrows show movement since the 0.36.6 draft.

| # | antirez tenet | Now | Δ | Notes |
|---|---|:--:|:--:|---|
| 1 | **States > lines** | 🟡 | ↑ | Wired-unit runs real code; journeys reach multi-step states. Still no *systematic* state-space exploration. |
| 2 | **AI as QA engineer** | 🟡 | ↑ from 🔴 | Journey lane: LLM authors realistic flows against the live app. Gap: journeys are surface-derived & ephemeral, **not driven by markdown missions + change context**. |
| 3 | **Change-driven** (read commits, target regressions) | 🔴 | — | **Unchanged — now the #1 gap.** Every lane analyzes a snapshot/whole repo. The `hermes/` flywheel grades the tracked tree on a schedule but **does not diff commits** to focus QA. |
| 4 | **Operate the real system** w/ handed-in context | 🟡 | ↑ | Crawl + journeys operate the booted app; journeys fill forms. Gap: no "here are creds/SSH/endpoints for the *deployed* system" flow; auth-gated depth shallow. |
| 5 | **Build apps on top / multi-user, multi-day** | 🔴 | ~ | Journeys are short (2–8 steps), **single-user, single-run**. No realistic multi-actor usage over time. |
| 6 | **Output coherence across many inputs** | 🔴 | — | No differential / golden-output / coherence testing. |
| 7 | **Speed-regression w/ dynamic baseline** | 🟡 | — | Simulate measures p50/p99/rps/MTTR but **per-run**; no persisted baseline, no commit-over-commit delta. |
| 8 | **Distributed / multi-node** | 🔴 | — | Single-cluster / single-container; no multi-machine scenario. |
| 9 | **Psychological / UX quality** | 🟡 | ↑ from 🔴 | Crawl surfaces console/page errors + a11y = real sloppiness signals. Gap: no subjective "surprise / thin docs / feel" judgment — it counts errors, doesn't *opine*. |

**Tally:** 0 full · **5 partial** (1,2,4,7,9) · **4 gaps** (3,5,6,8) — up from 0/4/5 at 0.36.6. The improvements all came from the new E2E + wired lanes. The remaining gaps are about **change-awareness, realistic-usage depth, output coherence, regression baselines, and subjective judgment.**

---

## 5. Where TestForge is *ahead of* the article (defend these)

- **"Model decides what, executor decides how."** The journey DSL keeps LLM-authored code out of the browser — a determinism/safety property antirez's free-form agents don't have.
- **Reliability of the AI tester itself.** Tier-3 **≥2-of-3 majority across two model lineages** attacks the LLM-QA's own false negatives (13 bugs rescued by gpt-5.1). antirez never addresses tester reliability.
- **static→runtime policy-enforcement verification** (Simulate): deploy a violating pod, check if Kyverno/PSA blocks it. A test antirez doesn't pose.
- **Determinism as a gate** (Tier-1, <2s, reproducible) fronting the non-deterministic agentic lanes.
- **Honesty mechanics** (`languageCoverage`, N/A-with-reasons, no-cry-wolf scoring) — an autonomous QA agent that hides what it didn't test is dangerous; the scaffolding already exists.

---

## 6. Remaining recommendations (prioritized for 0.37.0+)

1. **Change-driven QA — the #1 open gap (tenet #3).** Accept a base ref; have Tier-1 emit a `changedSurface` (endpoints/functions/routes touched) and **seed the crawl, journeys, and wired-unit lanes against it** so they hunt regressions, not the whole app. The `hermes/` flywheel already runs on a schedule — make it **diff-scoped**. Cheapest high-leverage win.
2. **Persisted baselines + regression deltas (tenet #7).** Store per-commit journey pass/fail and Simulate metrics in `~/.testforge/history.db`; report **deltas vs the last green run**. A journey that passed last run and fails now is the cleanest regression signal TestForge could emit — and it's antirez's "dynamic baseline" almost verbatim.
3. **Coherence / differential lane (tenet #6).** Run the same journeys / wired tests against `HEAD` and the prior version; flag output divergence (the GGUF-coherence idea generalized).
4. **Deepen journeys → realistic multi-user/multi-day (tenet #5).** Longer, stateful, multi-actor, auth/credential-aware sessions (sign up → create → share → second user acts → revoke → verify), beyond the current 2–8 single-user steps.
5. **Subjective UX pass (tenet #9).** An agent that reads crawl output + snapshots and *judges* surprise / doc gaps / sloppiness — scored, with examples, kept separate from correctness. Reuse the Tier-3 vote to keep it honest.
6. **Markdown QA-mission files (tenet #2 → full).** Let a mission = goal + handed-in context + diff under test, so the agent's targets are author-controlled, not just surface-derived. This unifies #1, #4, and #5.
7. **Distributed / multi-node (tenet #8).** Stretch: drive a 2-node deployment to catch distributed-state bugs.

---

## 7. The single highest-value move

**Make the agentic lanes change-driven and baseline-aware.** 0.37.0 already built the hard part — autonomous lanes that operate the real running system (crawl, journeys, wired). What they lack is antirez's two cheapest, most defining ideas: *target what changed* and *compare to a tracked baseline*. Adding `changedSurface` seeding + per-commit baselines to the existing lanes flips gaps #3 and #7 and sharpens #5/#6 — without building a new engine. That is the shortest path from "TestForge has antirez-style lanes" to "TestForge does antirez's methodology."

---

## 8. Appendix — evidence base

- Article: antirez.com/news/168.
- 0.37.0: `src/data/changelog.ts` (v0.37.0, 2026-06-05, "Tier-2 runs your real code — plus a browser/E2E lane"); commits #66 (E2E crawl), #67 (E2E journeys), #68–#70 (real-code Tier-2, docs, release).
- Lanes: `mcp-server/src/simulation/{e2e-crawl,e2e-journey,wired-unit,load-sim,chaos-sim,agent-sim,sandbox}.ts`; runners `mcp-server/runner/e2e-*.mjs`.
- Tier-1: `docs/knowledge/Dimensions.md`, `src/data/dimensionMeta.ts`.
- Tier-3 consensus: `pathc-3model.py`, `consensus-out/THREE-MODEL-CONSENSUS-REPORT.md` (in the dclaw-agent copy).
- Self-improvement (not yet change-driven): `docs/knowledge/Flywheel.md`, `Status.md`.
</content>
</invoke>
