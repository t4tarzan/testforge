// OWASP Top 10 (2021) — category mapping and analyzer-coverage matrix.
//
// The old runOwaspCoverage matched on substrings inside finding titles
// and treated "had any finding in this category" as "covered." That's
// the wrong direction: HIGHER coverage by that metric meant MORE
// vulnerabilities, not better security.
//
// This module distinguishes three things:
//
//   1. analyzer-coverage  — "which OWASP categories does the analyzer
//                            have RULES for, regardless of any specific
//                            project's findings?"
//   2. project-findings   — "which OWASP categories did THIS project
//                            actually have findings in?"
//   3. gaps               — categories the analyzer cannot detect yet
//
// A coverage report should surface ALL three, clearly labeled.

export type OwaspCode =
  | 'A01' | 'A02' | 'A03' | 'A04' | 'A05'
  | 'A06' | 'A07' | 'A08' | 'A09' | 'A10';

export interface OwaspCategoryMeta {
  code: OwaspCode;
  title: string;
  /** Security-analyzer finding categories the analyzer can detect under this OWASP code. */
  detectorCategories: string[];
  /** True if the analyzer ships at least one rule that maps here. */
  analyzerCovers: boolean;
}

/** Canonical 2021 Top 10 catalog with analyzer-coverage flags. */
export const OWASP_2021: OwaspCategoryMeta[] = [
  {
    code: 'A01',
    title: 'A01:2021 — Broken Access Control',
    detectorCategories: ['Authentication Bypass', 'Path Traversal'],
    analyzerCovers: true,
  },
  {
    code: 'A02',
    title: 'A02:2021 — Cryptographic Failures',
    detectorCategories: ['Hardcoded Secrets'],
    analyzerCovers: true,
  },
  {
    code: 'A03',
    title: 'A03:2021 — Injection',
    detectorCategories: ['SQL Injection', 'XSS', 'Dangerous Functions', 'Open Redirect'],
    analyzerCovers: true,
  },
  {
    code: 'A04',
    title: 'A04:2021 — Insecure Design',
    detectorCategories: ['Rate Limiting'],
    analyzerCovers: true,
  },
  {
    code: 'A05',
    title: 'A05:2021 — Security Misconfiguration',
    detectorCategories: ['CORS Misconfiguration', 'Security Headers'],
    analyzerCovers: true,
  },
  {
    code: 'A06',
    title: 'A06:2021 — Vulnerable and Outdated Components',
    detectorCategories: ['Vulnerable Dependencies'],
    analyzerCovers: true,
  },
  {
    code: 'A07',
    title: 'A07:2021 — Identification and Authentication Failures',
    detectorCategories: ['Authentication Bypass'],
    analyzerCovers: true,
  },
  {
    code: 'A08',
    title: 'A08:2021 — Software and Data Integrity Failures',
    detectorCategories: [], // No rules ship here yet — explicit gap
    analyzerCovers: false,
  },
  {
    code: 'A09',
    title: 'A09:2021 — Security Logging and Monitoring Failures',
    detectorCategories: ['Sensitive Data Exposure'], // partial — only the "PII in response" case
    analyzerCovers: true,
  },
  {
    code: 'A10',
    title: 'A10:2021 — Server-Side Request Forgery',
    detectorCategories: [], // No rules ship here yet — explicit gap
    analyzerCovers: false,
  },
];

/** Build a flat map: security-category-name → OwaspCode set (a finding can map to multiple). */
const CATEGORY_TO_CODES = (() => {
  const map = new Map<string, OwaspCode[]>();
  for (const cat of OWASP_2021) {
    for (const det of cat.detectorCategories) {
      const existing = map.get(det) ?? [];
      existing.push(cat.code);
      map.set(det, existing);
    }
  }
  return map;
})();

/**
 * Given a security finding's `category` field, return the matching
 * OWASP 2021 codes (may be empty if the analyzer category doesn't
 * map cleanly into the framework).
 */
export function owaspCodesForCategory(category: string | undefined): OwaspCode[] {
  if (!category) return [];
  return CATEGORY_TO_CODES.get(category) ?? [];
}

/** Format the user-facing string for a code, falling back to "Unknown". */
export function owaspTitle(code: OwaspCode): string {
  return OWASP_2021.find((c) => c.code === code)?.title ?? code;
}
