import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, FileText, GitBranch, AlertOctagon } from 'lucide-react';
import { showcaseReports, type ShowcaseReport } from '@/data/showcaseReports';

function scoreColor(score: number) {
  if (score >= 80) return '#22C55E';
  if (score >= 50) return '#EAB308';
  return '#EF4444';
}

function ReportCard({ report }: { report: ShowcaseReport }) {
  const color = scoreColor(report.overall);
  const sev = report.security;
  return (
    <Link
      to={`/in-the-wild/${report.slug}`}
      className="block bg-white border border-[#D9D9D3] rounded-2xl p-7 hover:border-[#574a7d] hover:shadow-[0_8px_24px_rgba(87,74,125,0.08)] transition-all duration-300 group"
    >
      <div className="flex items-start gap-5">
        {/* Score ring */}
        <div className="flex-shrink-0">
          <div
            className="w-[88px] h-[88px] rounded-full border-[6px] flex items-center justify-center"
            style={{ borderColor: color }}
          >
            <span className="font-heading font-bold text-[28px]" style={{ color }}>
              {report.overall}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <GitBranch size={14} className="text-[#9A9A9A]" />
            <span className="font-mono text-[12px] text-[#9A9A9A] uppercase tracking-wider truncate">
              {report.repoUrl.replace('https://github.com/', '')}
            </span>
          </div>
          <h3 className="font-heading font-semibold text-[20px] text-[#12101A] mb-2 group-hover:text-[#574a7d] transition-colors">
            {report.repoName}
          </h3>
          <p className="text-[14px] text-[#6B6B6B] leading-snug mb-4 line-clamp-2">
            {report.tagline}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-mono text-[#6B6B6B]">
            <span>{report.codebase.totalFiles.toLocaleString()} files</span>
            <span>{report.codebase.totalLines.toLocaleString()} lines</span>
            <span>{report.codebase.endpoints} endpoints</span>
            <span>{report.codebase.dependencies} deps</span>
          </div>

          {sev.findings > 0 && (
            <div className="flex items-center gap-3 mt-3 text-[12px] font-mono">
              {sev.critical > 0 && (
                <span className="flex items-center gap-1 text-[#EF4444]">
                  <AlertOctagon size={12} /> {sev.critical} critical
                </span>
              )}
              {sev.high > 0 && <span className="text-[#F97316]">{sev.high} high</span>}
              {sev.medium > 0 && <span className="text-[#EAB308]">{sev.medium} medium</span>}
              {sev.low > 0 && <span className="text-[#574a7d]">{sev.low} low</span>}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 self-center text-[#574a7d] opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowRight size={20} />
        </div>
      </div>
    </Link>
  );
}

export default function InTheWild() {
  useEffect(() => {
    document.title = 'In the Wild — TestForge applied to real OSS repos';
  }, []);

  return (
    <div className="bg-[#F7F7FB] min-h-screen">
      {/* Hero */}
      <section className="bg-[#12101A] pt-32 pb-20 px-6 lg:px-16 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(to right, #574a7d 1px, transparent 1px),
                              linear-gradient(to bottom, #574a7d 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative z-10 max-w-[1100px] mx-auto text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-xs text-[#a99bff] uppercase tracking-[0.15em] mb-6"
          >
            // IN THE WILD · PUBLIC TESTFORGE REPORTS
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-display-xl text-white max-w-[900px] mx-auto mb-6 leading-[1.1]"
          >
            What TestForge sees in <span className="text-[#a99bff]">real OSS repos</span>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#a99bff]/70 text-lg max-w-[760px] mx-auto"
          >
            Every report on this page is a verbatim TestForge analysis of a public repo —
            cloned at depth 1, scanned with{' '}
            <code className="font-mono text-[16px] text-[#a99bff]">@whitenoisenpm/testforge-mcp@latest</code>,
            and saved as JSON. No cherry-picking, no human edits. Run any of them
            against your own repo with one command.
          </motion.p>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-[1100px] mx-auto px-6 lg:px-16 py-16">
        {showcaseReports.length === 0 ? (
          <p className="text-center text-[#6B6B6B] py-20">
            No reports yet. Run <code className="font-mono text-[#574a7d]">scripts/generate-showcase-report.sh</code>.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {showcaseReports.map((r) => (
              <ReportCard key={r.slug} report={r} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 bg-white border border-[#D9D9D3] rounded-2xl p-8 text-center">
          <FileText className="text-[#574a7d] mx-auto mb-4" size={36} />
          <h2 className="font-heading font-semibold text-[24px] text-[#12101A] mb-2">
            Run this on your own repo
          </h2>
          <p className="text-[15px] text-[#6B6B6B] max-w-[560px] mx-auto mb-6">
            Same analyzer, same JSON shape. Runs locally, your code never leaves the
            machine.
          </p>
          <div className="inline-block bg-[#12101A] text-white font-mono text-[14px] px-5 py-3 rounded-lg mb-4">
            npx -y @whitenoisenpm/testforge-mcp@latest
          </div>
          <div>
            <Link
              to="/mcp"
              className="inline-flex items-center gap-2 text-[#574a7d] font-medium hover:underline"
            >
              MCP install guide <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
