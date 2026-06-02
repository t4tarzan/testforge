// Real coverage from artifacts — turns the Unit dimension's heuristic estimate
// into a MEASURED number when the repo ships a coverage report. Supports the
// three common formats (polyglot): lcov.info (JS/Go/C…), Cobertura coverage.xml
// (pytest-cov / coverage.py / gocover), and Istanbul coverage-summary.json (nyc).
// Pure parsers + a discovery helper; returns null when nothing is found so the
// caller falls back to the estimate.
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

export interface CoverageResult {
  /** 0..100 overall line coverage. */
  overallPct: number;
  /** How many files the report covers. */
  fileCount: number;
  /** Which artifact it came from (relative path). */
  source: string;
  format: 'lcov' | 'cobertura' | 'istanbul';
}

/** lcov.info: SF:<file> … LF:<found> LH:<hit> … end_of_record (per file). */
export function parseLcov(content: string): { overallPct: number; fileCount: number } | null {
  let lf = 0, lh = 0, files = 0;
  let sawFile = false;
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) { sawFile = true; files++; }
    else if (line.startsWith('LF:')) lf += Number(line.slice(3)) || 0;
    else if (line.startsWith('LH:')) lh += Number(line.slice(3)) || 0;
  }
  if (!sawFile || lf === 0) return null;
  return { overallPct: Math.round((lh / lf) * 100), fileCount: files };
}

/** Cobertura coverage.xml: <coverage line-rate="0.83"> + per <class line-rate>. */
export function parseCobertura(xml: string): { overallPct: number; fileCount: number } | null {
  const root = xml.match(/<coverage[^>]*\bline-rate="([0-9.]+)"/);
  const classes = xml.match(/<class\b[^>]*\bline-rate="[0-9.]+"/g) || [];
  if (!root) {
    // No root line-rate — average the per-class rates if present.
    if (!classes.length) return null;
    const rates = classes.map((c) => Number((c.match(/line-rate="([0-9.]+)"/) || [])[1]) || 0);
    return { overallPct: Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100), fileCount: rates.length };
  }
  return { overallPct: Math.round(Number(root[1]) * 100), fileCount: classes.length };
}

/** Istanbul coverage-summary.json: { total: { lines: { pct } }, "<file>": {…} }. */
export function parseIstanbulSummary(content: string): { overallPct: number; fileCount: number } | null {
  let obj: Record<string, { lines?: { pct?: number } }>;
  try { obj = JSON.parse(content); } catch { return null; }
  const total = obj.total?.lines?.pct;
  if (typeof total !== 'number') return null;
  const fileCount = Object.keys(obj).filter((k) => k !== 'total').length;
  return { overallPct: Math.round(total), fileCount };
}

// Discovery order: most-specific/common first. Each candidate maps to a parser.
const CANDIDATES: Array<{ globs: string[]; format: CoverageResult['format']; parse: (s: string) => { overallPct: number; fileCount: number } | null }> = [
  { globs: ['coverage/coverage-summary.json', '**/coverage-summary.json'], format: 'istanbul', parse: parseIstanbulSummary },
  { globs: ['coverage.xml', 'coverage/coverage.xml', '**/cobertura*.xml', '**/coverage.xml'], format: 'cobertura', parse: parseCobertura },
  { globs: ['lcov.info', 'coverage/lcov.info', '**/lcov.info'], format: 'lcov', parse: parseLcov },
];

// Exclusions go in `ignore:` — node-glob ignores `!`-negation in the pattern array.
const IGNORE = ['**/node_modules/**', '**/.venv/**', '**/venv/**', '**/dist/**', '**/build/**'];

/** Find + parse the first usable coverage artifact under projectPath. */
export async function readRealCoverage(projectPath: string): Promise<CoverageResult | null> {
  for (const cand of CANDIDATES) {
    let matches: string[] = [];
    try { matches = await glob(cand.globs, { cwd: projectPath, absolute: false, nodir: true, ignore: IGNORE }); } catch { continue; }
    for (const rel of matches.slice(0, 5)) {
      let content: string;
      try { content = readFileSync(join(projectPath, rel), 'utf8'); } catch { continue; }
      const parsed = cand.parse(content);
      if (parsed && parsed.fileCount > 0) {
        return { overallPct: Math.max(0, Math.min(100, parsed.overallPct)), fileCount: parsed.fileCount, source: rel, format: cand.format };
      }
    }
  }
  return null;
}
