import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, FileText, GitBranch, AlertOctagon, BookOpen } from 'lucide-react';
import { showcaseReports, type ShowcaseReport } from '@/data/showcaseReports';
import NewsletterSignup from '@/components/NewsletterSignup';

// Visual "hero" for each card. Per-tech-stack gradient picked from the
// repo's primary detected framework so each card has its own identity
// (LangChain → purple/violet, Supabase → emerald, FastAPI → teal).
const TECH_GRADIENTS: Record<string, string> = {
  FastAPI: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
  Django: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
  Flask: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)',
  Pydantic: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  React: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
  'Next.js': 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
  Gin: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
  Express: 'linear-gradient(135deg, #525252 0%, #737373 100%)',
  Fastify: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg, #574a7d 0%, #a39fd4 100%)';

function ReportCard({ report }: { report: ShowcaseReport }) {
  const sev = report.security;
  // Pick the first recognized framework in the stack for the hero gradient.
  const primaryTech = report.codebase.techStack.find((t) => TECH_GRADIENTS[t]);
  const gradient = primaryTech ? TECH_GRADIENTS[primaryTech] : DEFAULT_GRADIENT;

  return (
    <div className="bg-white border border-[#D9D9D3] rounded-2xl overflow-hidden hover:border-[#574a7d] hover:shadow-[0_8px_24px_rgba(87,74,125,0.08)] transition-all duration-300 group">
      {/* Hero strip with score, repo name, primary tech */}
      <Link to={`/in-the-wild/${report.slug}`} className="block relative h-[120px] overflow-hidden" style={{ background: gradient }}>
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px),
                              linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 h-full flex items-center justify-between px-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/70 mb-1">
              {primaryTech || 'Public report'}
            </div>
            <h3 className="font-heading font-semibold text-[22px] text-white tracking-tight">
              {report.repoName}
            </h3>
          </div>
          <div className="text-right">
            <div className="font-heading font-bold text-[36px] leading-none text-white">{report.overall}</div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-white/70 mt-1">overall</div>
          </div>
        </div>
      </Link>

      {/* Body */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch size={14} className="text-[#9A9A9A]" />
          <span className="font-mono text-[12px] text-[#9A9A9A] uppercase tracking-wider truncate">
            {report.repoUrl.replace('https://github.com/', '')}
          </span>
        </div>
        <p className="text-[14px] text-[#6B6B6B] leading-snug mb-4 line-clamp-2">{report.tagline}</p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] font-mono text-[#6B6B6B] mb-3">
          <span>{report.codebase.totalFiles.toLocaleString()} files</span>
          <span>{report.codebase.totalLines.toLocaleString()} lines</span>
          <span>{report.codebase.endpoints} endpoints</span>
          <span>{report.codebase.dependencies} deps</span>
        </div>

        {sev.findings > 0 && (
          <div className="flex items-center gap-3 mb-4 text-[12px] font-mono">
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

        {/* CTAs: summary + full audit */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#F0EFE8]">
          <Link
            to={`/in-the-wild/${report.slug}`}
            className="flex-1 text-center font-mono text-[12px] text-[#574a7d] hover:bg-[#E8E5FF] py-2 rounded transition-colors inline-flex items-center justify-center gap-1.5"
          >
            Summary <ArrowRight size={12} />
          </Link>
          <Link
            to={`/in-the-wild/${report.slug}/full`}
            className="flex-1 text-center font-mono text-[12px] bg-[#12101A] text-white hover:bg-[#574a7d] py-2 rounded transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <BookOpen size={12} /> Full audit
          </Link>
        </div>
      </div>
    </div>
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
            // THE TESTFORGE JOURNEY · IN THE WILD
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
            Not a leaderboard, and definitely not gotchas. Each report is a verbatim
            TestForge run on a public repo — cloned at depth 1, scanned with{' '}
            <code className="font-mono text-[16px] text-[#a99bff]">@whitenoisenpm/testforge-mcp@latest</code>,
            saved as JSON, no human edits. When one of these runs flags something that
            turns out to be a false positive, that becomes the{' '}
            <Link to="/changelog" className="text-[#a99bff] underline hover:text-white transition-colors">next analyzer release</Link>.
            This page is the record of that journey.
          </motion.p>
        </div>
      </section>

      {/* How to read these — transparency over boasting */}
      <section className="max-w-[1100px] mx-auto px-6 lg:px-16 pt-14">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              k: 'Reproducible',
              v: 'Cloned at depth 1, scanned with the published npm package, distilled to JSON by a script in the repo. Re-run it and you get the same numbers.',
            },
            {
              k: 'Production-focused',
              v: 'Scores reflect shipping code. Tests, examples/demos, and vendored bundles are suppressed; dimensions that don’t apply (a11y on a Python lib) report N/A, not a fake zero.',
            },
            {
              k: 'Self-correcting',
              v: 'A flagged finding isn’t a verdict. When a report over-fires, the fix ships as a release — often the same day. Honesty beats a higher number.',
            },
          ].map((c) => (
            <div key={c.k} className="bg-white border border-[#D9D9D3] rounded-xl p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#574a7d] mb-2">{c.k}</div>
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{c.v}</p>
            </div>
          ))}
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

        {/* Newsletter */}
        <div className="mt-12">
          <NewsletterSignup source="in-the-wild" />
        </div>

        {/* CTA */}
        <div className="mt-12 bg-white border border-[#D9D9D3] rounded-2xl p-8 text-center">
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
