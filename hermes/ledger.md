# TestForge Flywheel — Ledger

Append-only memory of what the flywheel has **proposed / shipped / rejected**, so
the proposer ([docs/flywheel/proposer-prompt.md](../docs/flywheel/proposer-prompt.md))
never re-proposes an open or rejected item without new evidence. `cycle.mjs`
appends to this file (or, in production, to `$TESTFORGE_LEDGER` — the
hermes-managed Obsidian note).

Format (one entry per line):

```
- <date> | <state> | <title> | <risk-class> | <evidence>
```

- **state**: `proposed` · `shipped` · `rejected`
- **risk-class**: `mechanical` · `behavior` · `product`
- **evidence**: finding id / metric / user report — never "felt like it"

When an item ships or is rejected, add a *new* line (don't edit the old one) so
the history stays auditable.

---

## Entries

<!-- cycle.mjs appends below this line -->

<!-- 2026-05-31 · cycle (self-only) · proposer: Claude -->
- 2026-05-31 | proposed | Fix "no testing framework" false negative on multi-package repos | behavior | signals.stack.weaknesses="No testing framework" vs signals.unit.frameworks=[Vitest,...], totalTests=365; root-only package.json scan misses mcp-server/ subpackage
- 2026-05-31 | proposed | Fix dead-code unused-dependency false positives | behavior | signals.deadCode.unusedDeps lists react-router/zod/stripe which stack.strengths + codebase.techStack confirm are USED
- 2026-05-31 | proposed | Triage 25 known-vulnerable dependencies | mechanical | signals.supplyChain.knownVulnerable=25 (lowest dimension, score 11); verify via npm audit before bumping

<!-- 2026-05-31 · shipped #1 -->
- 2026-05-31 | shipped | Fix "no testing framework" false negative on multi-package repos | behavior | added lib/test-presence.ts (hasTestFiles); wired into stack (strategic-analyzer.ts) + dora (lib/dora-signals.ts). Self-grade: stack 79→99, dora 25→55, overall 70→75, weakness cleared. +3 regression tests (326→329 pass), lint 0 errors, build clean.

<!-- 2026-05-31 · shipped #2 -->
- 2026-05-31 | shipped | Fix dead-code unused-dependency false positives | behavior | two root causes: (1) dynamic import('x') not detected by the AST walker; (2) parse filter skipped any path containing substring "test" (e.g. generate-tests.ts). Added isTestFile() to lib/test-presence.ts; dead-code.ts now detects import(); advanced-analyzer.ts uses isTestFile. Self-grade: deadCode 40→48, unusedDeps 9→4 (cleared stripe/@neondatabase/serverless/@upstash/* via dynamic-import, zod via test-filter); remaining 4 are genuinely unused or the react-router/react-router-dom companion case (deferred). +2 regression tests (329→331), lint 0 errors, build clean.
- 2026-05-31 | proposed | dead-code: companion-package awareness (react-router vs react-router-dom) | behavior | react-router declared + react-router-dom imported; matcher can't bridge sibling packages. Lower confidence — react-router may be legitimately removable. Needs a curated companion map or dep-graph awareness.

<!-- 2026-05-31 · triaged #4 (the "25 known-vulnerable deps") -->
- 2026-05-31 | shipped | Triage known-vulnerable dependencies — safe lockfile fixes | mechanical | npm audit (ground truth): root 21→14 via non-force `npm audit fix` (lockfile-only, no package.json range changes — esbuild/brace-expansion/path-to-regexp/smol-toml chain). vite was already 7.3.3 (patched). Build + 331 tests + lint all green. mcp-server: non-force fix changed nothing.
- 2026-05-31 | rejected | Auto-fix remaining vulns via `npm audit fix --force` | mechanical | npm's only "fix" for the @vercel/node→undici chain is DOWNGRADING @vercel/node 5.8.4→4.0.0 (a regression) — refused. Reward-hacking-adjacent: lowers the count by breaking the app.
- 2026-05-31 | proposed | Bump @vercel/node to a patched-undici release (or add an undici override) | behavior | root: 6 remaining vulns are transitive undici via @vercel/node 5.8.4; needs an upstream release or an `overrides` pin + serverless API testing. Breaking — own PR.
- 2026-05-31 | proposed | Migrate mcp-server fastify v4→v5 | behavior | mcp-server: 5 high in the fastify chain (fast-json-stringify/fast-uri); only non-vulnerable line is fastify v5 (major API migration: routes/plugins/error-handling). Needs its own PR + full test pass.
