// Showcase reports — pre-computed TestForge /analyze output against
// well-known public repos. Each JSON is produced by
// scripts/generate-showcase-report.sh; the glob import below
// auto-discovers new reports as you add them.
//
// Add a new one:
//   scripts/generate-showcase-report.sh <slug> <repo-url> "<tagline>"
// then commit the JSON; this index picks it up at build time.

export interface ShowcaseDimensionScore {
  key: string;
  label: string;
  /** Number 0-100, or null when the dimension is not applicable to this
   * project (e.g. Accessibility on a Python library — there are no UI
   * files to evaluate). Pages should render null as "N/A". */
  score: number | null;
}

export interface ShowcaseFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  fixSuggestion?: string;
}

export interface ShowcaseLanguageCoverage {
  nativelyAnalyzedFiles: number;
  unsupportedFiles: number;
  coveragePercent: number;
  unsupportedLanguages: Array<{ language: string; files: number }>;
}

export interface ShowcaseDimensionFinding {
  severity: string;
  title: string;
  description?: string;
  filePath?: string;
  lineNumber?: number;
  fixSuggestion?: string;
}

/** All findings for one dimension, plus whether it ran and its score. The
 * report merges this with dimensionMeta (methodology / coverage / N/A) to show
 * an honest per-dimension breakdown instead of a bare score. */
export interface ShowcaseDimensionGroup {
  key: string;
  label: string;
  score: number | null;
  applicable: boolean;
  findingCount: number;
  findings: ShowcaseDimensionFinding[];
  /** Why this dimension was N/A this run (overrides the generic naCriteria). */
  naReason?: string;
}

export interface ShowcaseReport {
  slug: string;
  repoUrl: string;
  repoName: string;
  tagline: string;
  analyzedAt: string;
  analyzeMs: number;
  codebase: {
    totalFiles: number;
    totalLines: number;
    endpoints: number;
    dependencies: number;
    techStack: string[];
    languageCoverage: ShowcaseLanguageCoverage | null;
  };
  unit: {
    coverage: number;
    testFiles: number;
    totalTests: number;
    frameworks: string[];
  };
  security: {
    findings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    topItems: ShowcaseFinding[];
  };
  scores: ShowcaseDimensionScore[];
  overall: number;
  /** Total findings across ALL dimensions (not just security). */
  totalFindings?: number;
  /** Per-dimension findings + applicability, for the honest breakdown. */
  dimensionFindings?: ShowcaseDimensionGroup[];
}

// Vite glob import — eager so each JSON ships in the bundle directly.
// `as` is used to type the imports; the runtime type is the JSON value.
const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const showcaseReports: ShowcaseReport[] = Object.entries(modules)
  .map(([path, value]) => {
    const report = value as ShowcaseReport;
    // Derive slug from filename as a sanity check (the JSON also carries it).
    const filenameSlug = path.replace(/^\.\//, '').replace(/\.json$/, '');
    if (report.slug !== filenameSlug) {
      // eslint-disable-next-line no-console
      console.warn(`showcase report ${path} slug mismatch: ${report.slug} vs ${filenameSlug}`);
    }
    return report;
  })
  .sort((a, b) => a.repoName.localeCompare(b.repoName));

export function getShowcaseReport(slug: string): ShowcaseReport | undefined {
  return showcaseReports.find((r) => r.slug === slug);
}
