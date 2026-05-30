// Turn a raw /clone-and-analyze result into the same per-dimension structure the
// In-the-Wild reports render (ShowcaseDimensionGroup[]), so a freshly-generated
// report shows the full 22-dimension breakdown — scores, progress bars,
// findings, and suggested fixes — not just a radar + security list.
//
// Mirrors mcp-server's showcase distill so live reports and curated reports look
// identical.
import { DIMENSION_ORDER, dimensionMeta } from '@/data/dimensionMeta';
import type { ShowcaseDimensionGroup, ShowcaseDimensionFinding } from '@/data/showcaseReports';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Results = Record<string, any>;

const CAP = 10;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (x: any): any[] => (Array.isArray(x) ? x : []);
const num = (x: unknown): number | null => (typeof x === 'number' ? x : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFinding(f: any): ShowcaseDimensionFinding {
  return {
    severity: f.severity || 'low',
    title: f.title || '',
    description: f.description ? String(f.description).slice(0, 600) : undefined,
    filePath: f.filePath,
    lineNumber: f.lineNumber,
    fixSuggestion: f.fixSuggestion || f.suggestion,
  };
}

export function buildDimensionGroups(results: Results): ShowcaseDimensionGroup[] {
  const r = results || {};
  const sec = r.security || {}, owasp = r.owasp || {}, unit = r.unit || {}, scope = r.scope || {}, a11y = r.accessibility || {}, k8s = r.kubernetes || {};
  const securityScore = Math.max(0, 100 - (sec.critical || 0) * 40 - (sec.high || 0) * 20);

  // [key, score, applicable, findings[], findingCount, naReason?]
  type Row = [string, number | null, boolean, ShowcaseDimensionFinding[], number, string?];
  const rows: Record<string, Row> = {
    security: ['security', securityScore, true, arr(sec.items).map(mapFinding), arr(sec.items).length],
    kubernetes: ['kubernetes', num(k8s.score), k8s.applicable !== false, arr(k8s.findings).map(mapFinding), arr(k8s.findings).length, k8s.applicable === false ? (k8s.naReason || 'No Kubernetes manifests or Helm charts found.') : undefined],
    owasp: ['owasp', num(owasp.coverage), true, arr(owasp.findings).map(mapFinding), arr(owasp.findings).length],
    supplyChain: ['supplyChain', num(r.supplyChain?.score), true, arr(r.supplyChain?.findings).map(mapFinding), arr(r.supplyChain?.findings).length],
    license: ['license', num(r.license?.score), true, arr(r.license?.findings).map(mapFinding), arr(r.license?.findings).length],
    unit: ['unit', num(unit.coverage), true, [], typeof unit.findings === 'number' ? unit.findings : arr(unit.findings).length],
    mutation: ['mutation', num(r.mutation?.score), true, arr(r.mutation?.findings).map(mapFinding), arr(r.mutation?.findings).length],
    propertyBased: ['propertyBased', num(r.propertyBased?.score), true, arr(r.propertyBased?.findings).map(mapFinding), arr(r.propertyBased?.findings).length],
    edgeCases: ['edgeCases', num(r.edgeCases?.score), true, arr(r.edgeCases?.findings).map(mapFinding), arr(r.edgeCases?.findings).length],
    contract: ['contract', num(r.contract?.score), true, arr(r.contract?.findings).map(mapFinding), arr(r.contract?.findings).length],
    predictive: ['predictive', num(r.predictive?.score), true, arr(r.predictive?.findings).map(mapFinding), arr(r.predictive?.findings).length],
    nPlusOne: ['nPlusOne', num(r.nPlusOne?.score), true, arr(r.nPlusOne?.findings).map(mapFinding), arr(r.nPlusOne?.findings).length],
    deadCode: ['deadCode', num(r.deadCode?.score), true, arr(r.deadCode?.findings).map(mapFinding), arr(r.deadCode?.findings).length],
    load: ['load', num(r.load?.score), true, [], 0],
    chaos: ['chaos', num(r.chaos?.score), true, arr(r.chaos?.findings).map(mapFinding), arr(r.chaos?.findings).length],
    agentic: ['agentic', num(r.agentic?.score), true, arr(r.agentic?.findings).map(mapFinding), arr(r.agentic?.findings).length],
    accessibility: ['accessibility', num(a11y.score), a11y.applicable !== false, [], a11y.issues || 0, a11y.applicable === false ? 'No HTML/JSX UI files to evaluate.' : undefined],
    visualRegression: ['visualRegression', num(r.visualRegression?.score), true, arr(r.visualRegression?.findings).map(mapFinding), arr(r.visualRegression?.findings).length],
    vision: ['vision', num(r.vision?.score), true, arr(r.vision?.findings).map(mapFinding), arr(r.vision?.findings).length],
    scope: ['scope', scope.coverage != null ? Math.min(100, scope.coverage) : null, true, arr(scope.findings).map(mapFinding), arr(scope.findings).length],
    stack: ['stack', num(r.stack?.score), true, arr(r.stack?.findings).map(mapFinding), arr(r.stack?.findings).length],
    dora: ['dora', num(r.dora?.score), true, arr(r.dora?.findings).map(mapFinding), arr(r.dora?.findings).length],
  };

  return DIMENSION_ORDER.filter((k) => rows[k]).map((k) => {
    const [key, score, applicable, findings, findingCount, naReason] = rows[k];
    return {
      key,
      label: dimensionMeta[key]?.label || key,
      score: score == null ? null : Math.round(score),
      applicable,
      findingCount,
      findings: findings.slice(0, CAP),
      ...(naReason ? { naReason } : {}),
    };
  });
}

export function overallFromGroups(groups: ShowcaseDimensionGroup[]): number {
  const nums = groups.filter((g) => g.applicable && typeof g.score === 'number').map((g) => g.score as number);
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
}

export function totalFindingsFromGroups(groups: ShowcaseDimensionGroup[]): number {
  return groups.reduce((a, g) => a + g.findingCount, 0);
}
