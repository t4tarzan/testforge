import { useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GitBranch, ArrowUpRight, AlertTriangle, FileText } from 'lucide-react';
import { getShowcaseReport } from '@/data/showcaseReports';

function scoreColor(score: number) {
  if (score >= 80) return '#22C55E';
  if (score >= 50) return '#EAB308';
  return '#EF4444';
}

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#574a7d',
  info: '#9A9A9A',
};

export default function InTheWildReport() {
  const { slug } = useParams<{ slug: string }>();
  const report = slug ? getShowcaseReport(slug) : undefined;

  useEffect(() => {
    if (report) {
      document.title = `${report.repoName} · TestForge analysis`;
    }
  }, [report]);

  if (!report) {
    return <Navigate to="/in-the-wild" replace />;
  }

  const lc = report.codebase.languageCoverage;
  const showCoverageBanner = lc && lc.coveragePercent < 100 && lc.unsupportedFiles > 0;
  const overallColor = scoreColor(report.overall);

  return (
    <div className="bg-[#F7F7FB] min-h-screen pb-20">
      {/* Header */}
      <section className="bg-[#12101A] pt-32 pb-12 px-6 lg:px-16">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <Link
              to="/in-the-wild"
              className="inline-flex items-center gap-2 text-[#a99bff]/70 hover:text-white text-sm font-mono"
            >
              <ArrowLeft size={14} /> All reports
            </Link>
            <Link
              to={`/in-the-wild/${report.slug}/full`}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-mono px-4 py-2 rounded transition-colors"
            >
              <FileText size={14} /> Open full audit report
            </Link>
          </div>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GitBranch size={14} className="text-[#a99bff]/60" />
                <a
                  href={report.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] text-[#a99bff]/60 uppercase tracking-wider hover:text-[#a99bff]"
                >
                  {report.repoUrl.replace('https://github.com/', '')}
                  <ArrowUpRight size={12} className="inline ml-1" />
                </a>
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-display-lg text-white mb-3"
              >
                {report.repoName}
              </motion.h1>
              <p className="text-[#a99bff]/80 text-[15px] max-w-[600px]">{report.tagline}</p>
            </div>
            {/* Overall score ring */}
            <div className="flex-shrink-0 self-center">
              <div
                className="w-[140px] h-[140px] rounded-full border-[10px] flex flex-col items-center justify-center"
                style={{ borderColor: overallColor }}
              >
                <span className="font-heading font-bold text-[48px] leading-none" style={{ color: overallColor }}>
                  {report.overall}
                </span>
                <span className="font-mono text-[10px] text-white/60 uppercase tracking-wider mt-1">
                  overall
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 lg:px-16 -mt-8">
        {/* Codebase stats card */}
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 lg:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
            <Stat label="Files" value={report.codebase.totalFiles.toLocaleString()} />
            <Stat label="Lines" value={report.codebase.totalLines.toLocaleString()} />
            <Stat label="Endpoints" value={report.codebase.endpoints.toLocaleString()} />
            <Stat label="Dependencies" value={report.codebase.dependencies.toLocaleString()} />
          </div>

          {report.codebase.techStack.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {report.codebase.techStack.map((t) => (
                <span
                  key={t}
                  className="inline-flex px-2.5 py-1 rounded-md text-[12px] font-medium bg-[#E8E5FF] text-[#574a7d]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <p className="mt-5 text-[12px] font-mono text-[#9A9A9A]">
            Analyzed{' '}
            {new Date(report.analyzedAt).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}{' '}
            · scan took {report.analyzeMs} ms · TestForge {' '}
            <code className="text-[#574a7d]">@whitenoisenpm/testforge-mcp@latest</code>
          </p>
        </div>

        {/* Language-coverage banner — only when < 100% */}
        {showCoverageBanner && lc && (
          <div className="mt-6 bg-[rgba(232,168,56,0.1)] border border-[#E8A838] rounded-xl p-4 text-[14px] text-[#7a5500] flex items-start gap-3">
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Partial coverage:</strong> TestForge analyzed{' '}
              <strong>{lc.coveragePercent}%</strong> of this repo natively (JS/TS + Python).
              {' '}
              {lc.unsupportedFiles.toLocaleString()} source files in unsupported languages
              were counted but not parsed
              {lc.unsupportedLanguages.length > 0 &&
                ' (' +
                  lc.unsupportedLanguages
                    .map((l) => `${l.language} ${l.files.toLocaleString()}`)
                    .join(', ') +
                  ')'}
              . Endpoint, test, and dependency counts reflect JS/TS + Python only.
            </div>
          </div>
        )}

        {/* Dimension scores grid */}
        <h2 className="mt-12 mb-5 font-heading font-semibold text-[22px] text-[#12101A]">
          Dimension scores
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {report.scores.map((s) => {
            const notApplicable = s.score === null;
            const c = notApplicable ? '#9A9A9A' : scoreColor(s.score!);
            return (
              <div
                key={s.key}
                className="bg-white border border-[#D9D9D3] rounded-xl p-5"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#6B6B6B]">
                    {s.label}
                  </span>
                  <span
                    className={notApplicable ? 'font-mono text-[13px]' : 'font-heading font-bold text-[24px]'}
                    style={{ color: c }}
                    title={notApplicable ? 'Not applicable to this repo' : undefined}
                  >
                    {notApplicable ? 'N/A' : s.score}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#F7F7FB] rounded-full overflow-hidden">
                  {!notApplicable && (
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, s.score!)}%`, backgroundColor: c }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unit test summary */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#D9D9D3] rounded-xl p-6">
            <h3 className="font-heading font-semibold text-[18px] text-[#12101A] mb-4">
              Test coverage
            </h3>
            <div className="space-y-2 text-[14px] text-[#333333]">
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">Estimated function coverage</span>
                <strong>{report.unit.coverage}%</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">Test files</span>
                <strong>{report.unit.testFiles}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">Test cases</span>
                <strong>{report.unit.totalTests}</strong>
              </div>
              {report.unit.frameworks.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6B6B6B]">Frameworks</span>
                  <strong>{report.unit.frameworks.join(', ')}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#D9D9D3] rounded-xl p-6">
            <h3 className="font-heading font-semibold text-[18px] text-[#12101A] mb-4">
              Security summary
            </h3>
            <div className="space-y-2 text-[14px] text-[#333333]">
              <div className="flex justify-between">
                <span className="text-[#6B6B6B]">Total findings</span>
                <strong>{report.security.findings}</strong>
              </div>
              {(['critical', 'high', 'medium', 'low'] as const).map(
                (sev) => report.security[sev] > 0 && (
                  <div key={sev} className="flex justify-between">
                    <span className="text-[#6B6B6B] capitalize">{sev}</span>
                    <strong style={{ color: SEV_COLOR[sev] }}>{report.security[sev]}</strong>
                  </div>
                ),
              )}
              {report.security.findings === 0 && (
                <p className="text-[14px] text-[#6B6B6B] italic">No security findings.</p>
              )}
            </div>
          </div>
        </div>

        {/* Top security findings */}
        {report.security.topItems.length > 0 && (
          <>
            <h2 className="mt-12 mb-5 font-heading font-semibold text-[22px] text-[#12101A]">
              Top security findings
            </h2>
            <div className="space-y-3">
              {report.security.topItems.map((item, i) => (
                <div
                  key={i}
                  className="bg-white border-l-4 border border-[#D9D9D3] rounded-r-xl p-5"
                  style={{ borderLeftColor: SEV_COLOR[item.severity] || '#9A9A9A' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider text-white"
                      style={{ backgroundColor: SEV_COLOR[item.severity] || '#9A9A9A' }}
                    >
                      {item.severity}
                    </span>
                    <h3 className="font-heading font-semibold text-[16px] text-[#12101A]">
                      {item.title}
                    </h3>
                  </div>
                  {item.filePath && (
                    <p className="font-mono text-[12px] text-[#574a7d] mb-2">
                      {item.filePath}
                      {item.lineNumber ? `:${item.lineNumber}` : ''}
                    </p>
                  )}
                  <p className="text-[14px] text-[#333333] leading-snug mb-2">
                    {item.description}
                  </p>
                  {item.fixSuggestion && (
                    <p className="text-[13px] text-[#6B6B6B] leading-snug italic">
                      💡 {item.fixSuggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="mt-16 bg-[#12101A] text-white rounded-2xl p-8 text-center">
          <h2 className="font-heading font-semibold text-[24px] mb-3">
            Want this on your own repo?
          </h2>
          <p className="text-[#a99bff]/80 text-[15px] max-w-[560px] mx-auto mb-6">
            Same analyzer, same JSON shape. Runs locally. Your code never leaves the
            machine.
          </p>
          <div className="inline-block bg-[#1E1B2E] border border-[#3A3A3A] font-mono text-[14px] px-5 py-3 rounded-lg mb-5">
            npx -y @whitenoisenpm/testforge-mcp@latest
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/mcp"
              className="inline-flex items-center gap-2 bg-[#574a7d] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-[#4a3d6b] transition-colors"
            >
              MCP install guide
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 border border-[#3A3A3A] text-white px-5 py-2.5 rounded-lg font-medium hover:bg-white/10 transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-heading font-bold text-[28px] text-[#12101A] leading-none mb-1">
        {value}
      </p>
      <p className="font-mono text-[11px] text-[#6B6B6B] uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
