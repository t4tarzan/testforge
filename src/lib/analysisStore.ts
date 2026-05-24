const STORAGE_KEY = 'testforge_last_analysis';

export interface AnalysisResults {
  repo?: string;
  branch?: string;
  analyzedAt?: string;
  codebase?: {
    totalFiles?: number;
    totalLines?: number;
    endpoints?: number;
    techStack?: string[];
    dependencies?: number;
  };
  security?: {
    findings?: number;
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    items?: Array<{
      severity: string;
      title: string;
      description?: string;
      filePath?: string;
      lineNumber?: number;
      fixSuggestion?: string;
      category?: string;
    }>;
  };
  unit?: {
    coverage?: number;
    testFiles?: number;
    totalTests?: number;
    frameworks?: string[];
    findings?: number;
  };
  load?: {
    maxUsers?: number;
    rateLimiting?: boolean;
    caching?: boolean;
    recommendations?: string[];
  };
  accessibility?: {
    score?: number;
    issues?: number;
    imagesWithoutAlt?: number;
    formsWithoutLabels?: number;
  };
}

export function saveAnalysisResults(results: AnalysisResults) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  } catch {}
}

export function getAnalysisResults(): AnalysisResults | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearAnalysisResults() {
  localStorage.removeItem(STORAGE_KEY);
}
