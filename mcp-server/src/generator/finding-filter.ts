// Tier-2 dimension filter.
//
// Tier-2 test generation only makes sense for CONCRETE, code-level findings — a
// specific function/line with verifiable behavior the generated test can assert
// (security issues, logic/validation bugs from the security/unit dimensions).
//
// Advisory/heuristic findings from the load, accessibility, chaos, mutation and
// predictive dimensions describe PROJECT-LEVEL gaps ("no rate limiting", "no
// observability stack", "estimated mutation score 32%", "<button> has no
// accessible name") with no testable contract. Forcing the LLM to "demonstrate"
// them yields synthetic tests — and for mutation-score findings the model often
// writes a deliberately-FAILING assertion to illustrate the gap, which reds the
// suite for no real reason. Drop these before generation.
import type { InputFinding } from './generate-tests.js';

/** Analyzer dimensions whose findings are advisory, not unit-testable. */
export const ADVISORY_DIMENSIONS = new Set([
  'load',
  'accessibility',
  'chaos',
  'mutation',
  'predictive',
]);

/**
 * Fallback matchers for when a finding carries no `dimension` (the public
 * InputFinding shape may omit it): the meta-finding titles those dimensions
 * emit. Kept deliberately specific so real security/unit findings are never
 * caught by accident.
 */
const ADVISORY_TITLE_PATTERNS: RegExp[] = [
  // predictive / observability / coverage
  /no observability/i,
  /estimated mutation|mutation score|mutation testing/i,
  /(low|moderate|unit) test\b.*(coverage|ratio)|test-to-source/i,
  /unchained promise calls/i,
  // load / scalability
  /load analysis/i,
  /no (rate limiting|caching|response compression|circuit breaker|input validation|database connection pooling)/i,
  /missing (health check|rate limiting)/i,
  // accessibility
  /accessible name|visible label association|without alt attribute|low contrast|onclick|skipped heading|table without headers|role\+tabindex/i,
];

export type FilterableFinding = InputFinding & { dimension?: string };

/** True when a finding is a concrete, code-level target worth generating a test for. */
export function isTestableFinding(f: FilterableFinding): boolean {
  const dim = (f.dimension ?? '').trim().toLowerCase();
  if (dim) return !ADVISORY_DIMENSIONS.has(dim);
  // No dimension provided — fall back to title heuristics.
  const title = f.title ?? '';
  return !ADVISORY_TITLE_PATTERNS.some((re) => re.test(title));
}

export interface DroppedFinding {
  title: string;
  dimension?: string;
  reason: string;
}

export interface FilterResult {
  kept: InputFinding[];
  dropped: DroppedFinding[];
}

/**
 * Split findings into testable (kept) and advisory (dropped). The caller passes
 * `kept` to generateTestsForFindings and surfaces `dropped` so the skip is
 * visible rather than silent.
 */
export function filterTestableFindings(findings: FilterableFinding[]): FilterResult {
  const kept: InputFinding[] = [];
  const dropped: DroppedFinding[] = [];
  for (const f of findings) {
    if (isTestableFinding(f)) {
      kept.push(f);
    } else {
      dropped.push({
        title: f.title,
        dimension: f.dimension,
        reason:
          'advisory finding (no testable contract) — Tier-2 generates tests only for concrete security/unit findings',
      });
    }
  }
  return { kept, dropped };
}
