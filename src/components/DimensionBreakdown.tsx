// Rich per-dimension breakdown — the same view the In-the-Wild reports show,
// rendered from ShowcaseDimensionGroup[]. Used by the live analysis report so a
// freshly-generated report is as detailed as the curated ones: every dimension
// with its score + progress bar, finding count, how it's tested (methodology),
// each finding's severity / location / description, and the suggested fix.
import { useState } from 'react';
import { dimensionMeta } from '@/data/dimensionMeta';
import type { ShowcaseDimensionGroup } from '@/data/showcaseReports';

const SEV_COLOR: Record<string, string> = {
  critical: '#c53030', high: '#dd6b20', medium: '#d69e2e', low: '#574a7d', info: '#9A9A9A',
};
function scoreColor(score: number | null) {
  if (score === null || score === undefined) return '#9A9A9A';
  if (score >= 80) return '#2f855a';
  if (score >= 50) return '#d69e2e';
  return '#c53030';
}

export default function DimensionBreakdown({ groups }: { groups: ShowcaseDimensionGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!groups?.length) return null;
  const withFindings = groups.filter((d) => d.findingCount > 0).length;
  const total = groups.reduce((a, d) => a + d.findingCount, 0);

  return (
    <div>
      <h3 className="font-heading font-medium text-[20px] text-[#12101A] mb-1">Findings by dimension</h3>
      <p className="text-[14px] text-[#6B6B6B] font-body mb-4">
        <strong className="text-[#12101A]">{total}</strong> findings across{' '}
        <strong className="text-[#12101A]">{withFindings}</strong> of {groups.length} dimensions.
      </p>

      <div className="space-y-3">
        {groups.map((dim) => {
          const meta = dimensionMeta[dim.key];
          const na = !dim.applicable || dim.score === null || dim.score === undefined;
          const pct = na ? 0 : Math.max(0, Math.min(100, dim.score as number));
          const c = scoreColor(na ? null : dim.score);
          const isOpen = open[dim.key] ?? false;
          const expandable = dim.findings.length > 0 || !!meta;
          return (
            <div key={dim.key} className="border border-[#E8E5FF] rounded-[10px] bg-white overflow-hidden">
              <button
                onClick={() => expandable && setOpen((o) => ({ ...o, [dim.key]: !isOpen }))}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${expandable ? 'hover:bg-[#faf9ff] cursor-pointer' : 'cursor-default'}`}
              >
                <span className="font-body font-medium text-[15px] text-[#12101A] min-w-[150px]">{dim.label}</span>
                <div className="flex-1 h-2 bg-[#EEECF7] rounded-full overflow-hidden max-w-[260px]">
                  {!na && <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />}
                </div>
                <span className="font-mono text-[13px] font-semibold w-[60px] text-right" style={{ color: c }}>
                  {na ? 'N/A' : `${dim.score}`}
                </span>
                <span className="text-[12px] text-[#6B6B6B] w-[80px] text-right">
                  {dim.findingCount} finding{dim.findingCount === 1 ? '' : 's'}
                </span>
                {expandable && <span className="text-[#a39fd4] text-[12px] w-3">{isOpen ? '▾' : '▸'}</span>}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-[#F1EFF9]">
                  {meta && (
                    <p className="text-[12px] text-[#6B6B6B] font-body mt-3 mb-3 leading-[1.6]">
                      <span className="font-semibold text-[#574a7d]">How it's tested:</span> {meta.methodology}
                      {na && <><br /><span className="font-semibold text-[#574a7d]">Why N/A:</span> {dim.naReason || meta.naCriteria}</>}
                    </p>
                  )}
                  {dim.findings.length > 0 ? (
                    <ul className="space-y-2.5">
                      {dim.findings.map((f, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase h-[18px] mt-0.5 text-white shrink-0" style={{ background: SEV_COLOR[f.severity] || SEV_COLOR.info }}>
                            {f.severity}
                          </span>
                          <div className="min-w-0">
                            <span className="text-[13px] font-medium text-[#12101A]">{f.title}</span>
                            {f.filePath && <span className="text-[12px] text-[#9A9A9A] font-mono"> {f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}</span>}
                            {f.description && <p className="text-[12px] text-[#6B6B6B] leading-[1.55] mt-0.5">{f.description}</p>}
                            {f.fixSuggestion && <p className="text-[12px] text-[#2f855a] leading-[1.55] mt-0.5"><span className="font-semibold">Fix:</span> {f.fixSuggestion}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[#9A9A9A] font-body mt-1">
                      {na ? 'Not applicable to this repo.' : dim.findingCount > 0 ? `${dim.findingCount} finding(s) counted; details not itemized for this dimension.` : 'No issues found.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
