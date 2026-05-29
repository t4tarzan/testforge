// Principled scoring helpers. The original per-dimension formulas were linear
// (`100 - count * cost`), which CLIFFS to 0 once a repo accumulates enough
// findings — even when they're all low-severity. A 0/100 reads as "the pipeline
// failed" rather than "many minor issues", which undermines trust in the whole
// report. These use diminishing returns instead: the score degrades smoothly
// from 100 and asymptotes toward a non-zero floor, so 0 is reserved for the
// truly catastrophic (and N/A is rendered separately, never as a number).

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 1.0, high: 0.5, medium: 0.2, low: 0.08, info: 0,
};

/**
 * Severity-weighted score with diminishing returns.
 * 0 findings → 100. Each finding adds penalty by severity; the score is
 * 100 / (1 + penalty/k), floored. Tune `k` (higher = more lenient).
 */
export function severityScore(
  findings: ReadonlyArray<{ severity?: string }>,
  k = 5,
  floor = 5,
): number {
  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_WEIGHT[f.severity ?? 'low'] ?? 0.1;
  if (penalty <= 0) return 100;
  return Math.max(floor, Math.round(100 / (1 + penalty / k)));
}

/**
 * Same diminishing curve for a raw weighted count (when issues aren't modeled
 * as severity-tagged findings — e.g. unused-dep / dead-function counts).
 */
export function countScore(weightedCount: number, k = 8, floor = 5): number {
  if (weightedCount <= 0) return 100;
  return Math.max(floor, Math.round(100 / (1 + weightedCount / k)));
}
