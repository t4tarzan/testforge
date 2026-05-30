# Scoring — diminishing returns, no cry-wolf

Back to [[TestForge]]. Implementation: `mcp-server/src/analyzers/lib/score.ts`.

**The rule:** a score must never "cry wolf." A `0/100` or `null` reads as "the
pipeline is broken," not "this code has issues" — and that destroys trust in the
*whole* report. So:

- **Diminishing returns, not linear cliffs.** The old formulas were
  `score = max(0, 100 − Σ(finding·cost))`, which cliffs to 0 once a repo
  accumulates enough findings — even all-low-severity ones. Replaced with
  `severityScore()` / `countScore()`: the score degrades smoothly from 100 toward
  a non-zero floor, severity-weighted and monotonic. `0` is reserved for the
  genuinely catastrophic.
- **N/A is rendered separately**, never as a number. A dimension that doesn't
  apply (Kubernetes on a repo with no manifests, Accessibility on a backend) shows
  **N/A + a reason**, not `0`.
- **Size-independence.** Scores that summed an unbounded per-file quantity made
  any large repo floor out. Predictive Risk now scores off the *severity of
  surfaced hotspots*, and Edge Cases off finding severity — both bounded.
- **Density over raw volume.** Accessibility scores on issues per √(UI files), so
  a large, mostly-clean app isn't tanked by a high absolute count.
- **No false positives masquerading as signal.** Two recurring traps fixed:
  - *Polyglot deps:* the JS dead-code analyzer was fed the unioned dep list and
    flagged Python/Go packages as "unused." It now gets **runtime npm deps only**.
  - *Generated/vendored files:* codegen clients (`*.gen.ts`), `.d.ts`, protobuf
    stubs, minified bundles, and vendored trees are excluded from predictive
    hotspots and dead-code (`isGeneratedOrVendored()` in `lib/parse.ts`).

## How this was discovered
The "cry-wolf" links were found empirically by re-running the real
[[Reports|In-the-Wild]] repos: langchain showed Edge Cases `0/100` with 25
findings; TestForge's own Supply Chain showed `0/100` with 26. The fix wasn't to
soften everything — scores stay **meaningful** (criticals still drop a score
hard) — but to stop the cliffs and the false flags. See [[Evolution]].

## Helpers
- `severityScore(findings, k, floor)` — for severity-tagged findings.
- `countScore(weightedCount, k, floor)` — for raw counts.
Both: 0 findings → 100; degrade `100 / (1 + penalty/k)`; floored ≥ 5.
