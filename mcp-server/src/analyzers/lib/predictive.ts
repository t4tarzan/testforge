// Cross-signal predictive risk aggregation.
//
// Predictive failures used to be 5 project-level heuristics summed
// into one score. The deeper version asks: which FILES are likely to
// produce future incidents? It does this by ingesting signals from the
// other dimensions and assigning weighted risk to each file:
//
//   security findings (per file, weighted by severity)
//   N+1 hits         (per file)
//   dead exports     (per file — small penalty; not a behavior risk)
//   complexity       (per-file max-cc and total-cc from AST)
//   size             (loc — only above a threshold)
//   churn proxy      (TODO/FIXME density)
//
// Output: per-file risk score, ordered. Top-N files surface as
// findings. The dimension's project-level score follows from how
// many files exceed the threshold and how concentrated the risk is.
//
// Deterministic by construction: identical inputs → identical scores.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PerFileSecuritySignal {
  filePath: string;
  /** Count of findings by severity. */
  bySeverity: Record<Severity, number>;
}

export interface PerFileSignal {
  filePath: string;
  loc: number;
  maxCc: number;
  totalCc: number;
  hottestFunction?: string;
  /** Severity-weighted security count. */
  securityWeight: number;
  nPlusOneCount: number;
  deadExports: number;
  todoCount: number;
}

export interface FileRisk {
  filePath: string;
  score: number;
  reasons: string[];
  signals: PerFileSignal;
}

/* -------------------------------------------------------------------------- */
/* Weights — tunable in one place                                              */
/* -------------------------------------------------------------------------- */

const SEC_W = { critical: 25, high: 12, medium: 5, low: 2, info: 0 } satisfies Record<Severity, number>;
const NPLUS_W = 10;
const COMPLEXITY_THRESHOLD = 15;   // McCabe — above this is "complex"
const COMPLEXITY_W = 1.0;          // 1pt per cc above threshold
const LOC_THRESHOLD = 400;         // size — above this is "large"
const LOC_W = 0.05;                // 1pt per 20 loc above threshold
const TODO_THRESHOLD = 3;
const TODO_W = 1;
const DEAD_EXPORT_W = 0.5;

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

export interface AggregateInput {
  /** All files we considered, with raw line counts. */
  files: Array<{ path: string; loc: number }>;
  complexityByFile: Map<string, { maxCc: number; totalCc: number; hottest?: string }>;
  securityByFile: Map<string, Record<Severity, number>>;
  nPlusOneByFile: Map<string, number>;
  deadExportsByFile: Map<string, number>;
  todoCountByFile: Map<string, number>;
}

/**
 * Compute a risk score for every file. Files with zero signals get
 * zero score and are excluded from the result so the list stays
 * focused on the actual hot-spots.
 */
export function aggregateFileRisk(input: AggregateInput): FileRisk[] {
  const out: FileRisk[] = [];
  for (const f of input.files) {
    const sec = input.securityByFile.get(f.path) ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const cc = input.complexityByFile.get(f.path);
    const nplus = input.nPlusOneByFile.get(f.path) ?? 0;
    const dead = input.deadExportsByFile.get(f.path) ?? 0;
    const todos = input.todoCountByFile.get(f.path) ?? 0;

    const securityWeight =
      sec.critical * SEC_W.critical +
      sec.high * SEC_W.high +
      sec.medium * SEC_W.medium +
      sec.low * SEC_W.low;

    let score = 0;
    const reasons: string[] = [];

    if (securityWeight > 0) {
      score += securityWeight;
      const parts: string[] = [];
      if (sec.critical) parts.push(`${sec.critical} critical`);
      if (sec.high) parts.push(`${sec.high} high`);
      if (sec.medium) parts.push(`${sec.medium} medium`);
      if (sec.low) parts.push(`${sec.low} low`);
      reasons.push(`security: ${parts.join(', ')}`);
    }
    if (nplus > 0) {
      score += nplus * NPLUS_W;
      reasons.push(`${nplus} N+1 hit${nplus > 1 ? 's' : ''}`);
    }
    if (cc && cc.maxCc > COMPLEXITY_THRESHOLD) {
      const over = cc.maxCc - COMPLEXITY_THRESHOLD;
      score += over * COMPLEXITY_W;
      reasons.push(`hot function (cc=${cc.maxCc}${cc.hottest ? ` in \`${cc.hottest}\`` : ''})`);
    }
    if (f.loc > LOC_THRESHOLD) {
      const over = f.loc - LOC_THRESHOLD;
      score += over * LOC_W;
      reasons.push(`large file (${f.loc} loc)`);
    }
    if (todos > TODO_THRESHOLD) {
      score += (todos - TODO_THRESHOLD) * TODO_W;
      reasons.push(`${todos} TODO/FIXME`);
    }
    if (dead > 0) {
      score += dead * DEAD_EXPORT_W;
      reasons.push(`${dead} unused export${dead > 1 ? 's' : ''}`);
    }

    if (score === 0) continue;

    out.push({
      filePath: f.path,
      score: round(score),
      reasons,
      signals: {
        filePath: f.path,
        loc: f.loc,
        maxCc: cc?.maxCc ?? 1,
        totalCc: cc?.totalCc ?? 0,
        hottestFunction: cc?.hottest,
        securityWeight: round(securityWeight),
        nPlusOneCount: nplus,
        deadExports: dead,
        todoCount: todos,
      },
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Build a per-file map from a flat SecurityFinding list. */
export function bucketSecurityByFile(
  findings: Array<{ filePath: string; severity: string }>
): Map<string, Record<Severity, number>> {
  const out = new Map<string, Record<Severity, number>>();
  for (const f of findings) {
    const sev = (f.severity as Severity);
    if (!['critical', 'high', 'medium', 'low', 'info'].includes(sev)) continue;
    if (!f.filePath) continue;
    let bucket = out.get(f.filePath);
    if (!bucket) {
      bucket = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      out.set(f.filePath, bucket);
    }
    bucket[sev]++;
  }
  return out;
}
