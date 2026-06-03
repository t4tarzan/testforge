import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  GitBranch, Play, Shield, Zap, Gauge, Server, Cloud, Check,
  ArrowRight, Loader2, AlertCircle, BarChart3, Container
} from 'lucide-react';
import { Tier2Section } from '@/components/testrunner/ReportStep';
import DimensionBreakdown from '@/components/DimensionBreakdown';
import { buildDimensionGroups } from '@/lib/buildDimensionGroups';

const MCP_URL = 'https://mcp.testforge.run';

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, string> = {
    critical: 'bg-[rgba(239,68,68,0.1)] text-[#EF4444]',
    high: 'bg-[rgba(249,115,22,0.1)] text-[#F97316]',
    medium: 'bg-[rgba(234,179,8,0.1)] text-[#EAB308]',
    low: 'bg-[rgba(87,74,125,0.1)] text-[#574a7d]',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium uppercase ${config[severity] || config.low}`}>
      {severity}
    </span>
  );
}

export default function ManagedTesting() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/oneconvergence/dkubex-examples');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Dynamic analyzer response; see ReportStep AnalysisResults note.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<Record<string, any> | null>(null);

  const stages = ['Cloning repository', 'Scanning codebase', 'Security analysis', 'Unit test analysis', 'Load analysis', 'Accessibility check', 'Vision & goals', 'Strategic dimensions', 'Generating report'];
  const [stageIndex, setStageIndex] = useState(0);

  const handleAnalyze = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    setStageIndex(0);

    // Animate through stages
    const stageInterval = setInterval(() => {
      setStageIndex(i => {
        if (i < stages.length - 1) return i + 1;
        clearInterval(stageInterval);
        return i;
      });
    }, 1500);

    try {
      const res = await fetch(`${MCP_URL}/clone-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), branch: 'main' }),
      });
      clearInterval(stageInterval);
      setStageIndex(stages.length);
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: 'Failed' }))).error || 'Server error');
      setResults(await res.json());
    } catch (e) {
      clearInterval(stageInterval);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F7F7FB]">
      {/* Hero */}
      <section className="relative pt-[140px] pb-[80px] px-6 lg:px-16 bg-[#12101A] overflow-hidden">
        {/* Light gradient strip at top so navbar is visible */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F7F7FB] via-[#F7F7FB]/60 to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-grid-pattern-dark pointer-events-none opacity-30" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-[#574a7d] opacity-[0.06] blur-[100px]" />
        
        <div className="relative z-10 max-w-[1280px] mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono text-xs text-[#a99bff] uppercase tracking-[0.15em] mb-6"
          >
            // MANAGED TESTING · OSS-FIRST
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-display-xl text-white max-w-[900px] mx-auto mb-6 leading-[1.1]"
          >
            Don&rsquo;t want to install anything?{' '}
            <span className="text-[#a99bff]">We&rsquo;ll host it.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[#a99bff]/70 text-lg max-w-[720px] mx-auto mb-6"
          >
            TestForge is open source &mdash; you can <Link to="/mcp" className="text-[#a99bff] underline hover:text-white">run it locally with <code className="font-mono">npx</code></Link> and your code never leaves your machine. This page is for everyone who&rsquo;d rather skip the install: paste a public repo URL, we clone it into a sandboxed container, run all 21 dimensions, and give you back a report.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-[#a99bff]/50 text-sm max-w-[600px] mx-auto mb-10"
          >
            Tier 2 (LLM-generated tests + sandboxed Docker execution) requires a <Link to="/pricing" className="text-[#a99bff] underline hover:text-white">paid plan</Link> on the managed side — self-host runs it free with your own OpenRouter key.
          </motion.p>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-[600px] mx-auto"
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <GitBranch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a99bff]" />
                <input
                  type="text"
                  aria-label="Repository URL"
                  value={repoUrl}
                  onChange={(e) => { setRepoUrl(e.target.value); setError(''); }}
                  placeholder="https://github.com/owner/repo"
                  disabled={loading}
                  className="w-full h-[52px] pl-11 pr-4 bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl font-mono text-sm text-white placeholder:text-[#6B6B6B] focus:outline-none focus:border-[#574a7d] transition-all"
                />
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !repoUrl.trim()}
                className="h-[52px] px-8 bg-[#574a7d] text-white rounded-xl font-medium flex items-center gap-2 hover:bg-[#453a68] disabled:opacity-50 transition-all"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={16} />}
                {loading ? 'Analyzing...' : 'Run Analysis'}
              </button>
            </div>
            {error && (
              <div className="flex items-start gap-2 mt-4 p-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-lg text-left">
                <AlertCircle size={16} className="text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EF4444]">{error}</p>
              </div>
            )}
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-6 mt-10"
          >
            {[
              { icon: Container, text: 'Container-based execution' },
              { icon: Cloud, text: 'Zero setup required' },
              { icon: Shield, text: 'Secure sandboxed runs' },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-2 text-[#a99bff]/50 text-sm">
                <b.icon size={16} />
                <span>{b.text}</span>
              </div>
            ))}
          </motion.div>

          {/* Stage Progress */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 max-w-[600px] mx-auto"
            >
              <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 size={18} className="animate-spin text-[#a99bff]" />
                  <span className="text-white font-medium">{stages[Math.min(stageIndex, stages.length - 1)]}...</span>
                </div>
                <div className="space-y-2">
                  {stages.map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        i < stageIndex ? 'bg-[#574a7d]' : i === stageIndex ? 'bg-[#a99bff] animate-pulse' : 'bg-[#3A3A3A]'
                      }`} />
                      <span className={`text-xs ${i <= stageIndex ? 'text-[#a99bff]' : 'text-[#6B6B6B]'}`}>{s}</span>
                      {i <= stageIndex && i === stageIndex && (
                        <span className="text-[10px] text-[#574a7d] font-mono">running</span>
                      )}
                      {i < stageIndex && (
                        <span className="text-[10px] text-[#574a7d] font-mono">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Results */}
      {results && (
        <section className="px-6 lg:px-16 py-[80px] bg-[#F7F7FB]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-3">// ANALYSIS RESULTS</p>
              <h2 className="text-display-md text-[#12101A]">
                {results.repo?.split('/').pop()} — Analysis Complete
              </h2>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Files', value: results.codebase?.totalFiles },
                { label: 'Lines', value: results.codebase?.totalLines?.toLocaleString() },
                { label: 'Endpoints', value: results.codebase?.endpoints },
                { label: 'Dependencies', value: results.codebase?.dependencies },
                { label: 'Vision Score', value: `${results.vision?.score}/100` },
                { label: 'Scope Coverage', value: `${results.scope?.coverage}%` },
                { label: 'Stack Score', value: `${results.stack?.score}/100` },
                { label: 'A11y Score', value: `${results.accessibility?.score}/100` },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-[#D9D9D3] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#12101A]">{s.value ?? '—'}</div>
                  <div className="text-xs text-[#6B6B6B] mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Security Findings */}
            {results.security?.items?.length > 0 && (
              <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={18} className="text-[#574a7d]" />
                  <h3 className="font-semibold text-[#12101A]">Security Findings ({results.security.items.length})</h3>
                  <span className="ml-auto text-sm text-[#EF4444] font-medium">{results.security.critical} critical</span>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {results.security.items.slice(0, 10).map((f: { severity: string; title?: string; filePath?: string; lineNumber?: number; fixSuggestion?: string }, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 border border-[#D9D9D3] rounded-lg">
                      <SeverityBadge severity={f.severity} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#333333]">{f.title}</p>
                        <p className="text-xs text-[#9A9A9A] font-mono mt-0.5">{f.filePath}:{f.lineNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stack Analysis */}
            {results.stack?.strengths?.length > 0 && (
              <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-6">
                <h3 className="font-semibold text-[#12101A] mb-4">Stack Analysis — {results.stack.score}/100</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-mono text-[#574a7d] uppercase mb-2">Strengths</p>
                    {results.stack.strengths.slice(0, 4).map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm py-1"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" /><span className="text-[#333333]">{s}</span></div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-mono text-[#6B6B6B] uppercase mb-2">Recommendations</p>
                    {results.stack.recommendations?.slice(0, 4).map((r: string, i: number) => (
                      <div key={i} className="flex gap-2 text-sm py-1"><Zap size={14} className="text-[#EAB308] mt-0.5 flex-shrink-0" /><span className="text-[#6B6B6B]">{r}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full per-dimension breakdown — scores, bars, findings + fixes */}
            <div className="bg-white border border-[#D9D9D3] rounded-xl p-6 mt-8">
              <DimensionBreakdown groups={buildDimensionGroups(results)} />
            </div>

            {/* Tier 2 — Generate & Run (BYOK or paid) */}
            <div className="mt-8">
              <Tier2Section results={results} />
            </div>

            {/* CTA */}
            <div className="text-center mt-8">
              <Link
                to="/run-test"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#574a7d] text-white rounded-xl font-medium hover:bg-[#453a68] transition-colors"
              >
                Run Another Analysis <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features section (shown before analysis) */}
      {!results && !loading && (
        <section className="px-6 lg:px-16 py-[100px] bg-[#F7F7FB]">
          <div className="max-w-[1000px] mx-auto text-center mb-16">
            <p className="font-mono text-xs text-[#574a7d] uppercase tracking-wider mb-4">// WHAT YOU GET</p>
            <h2 className="text-display-md text-[#12101A] mb-4">Container-powered testing. Zero config.</h2>
            <p className="text-[#6B6B6B] max-w-[600px] mx-auto">
              Unlike MCP mode (which runs locally), Managed Testing spins up a secure container on our infrastructure to run intensive tests that need dedicated resources.
            </p>
          </div>

          <div className="max-w-[1000px] mx-auto grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Gauge,
                title: 'Load & Stress Testing',
                desc: 'Simulate thousands of concurrent users. Find breaking points before your users do. Container-based execution handles the heavy lifting.',
              },
              {
                icon: Container,
                title: 'Feature Matrix Testing',
                desc: 'Cross-reference documented features against implementation. Discover scope gaps and untested paths automatically.',
              },
              {
                icon: Server,
                title: 'Full Security Audit',
                desc: 'SAST + dependency scanning + OWASP checks. Container isolation ensures safe execution of untrusted code.',
              },
              {
                icon: BarChart3,
                title: 'Performance Profiling',
                desc: 'CPU, memory, and I/O profiling under load. Identify bottlenecks in your hottest code paths.',
              },
              {
                icon: Shield,
                title: 'Chaos Engineering',
                desc: 'Inject faults, kill services, simulate network partitions. See how your code handles real-world failures.',
              },
              {
                icon: Zap,
                title: 'Instant Reports',
                desc: 'Get a comprehensive PRD with severity-classified findings, fix suggestions, and remediation phases.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-white border border-[#D9D9D3] rounded-xl p-6 hover:border-[#a99bff] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#E8E5FF] flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-[#574a7d]" />
                </div>
                <h3 className="font-semibold text-[#12101A] mb-2">{f.title}</h3>
                <p className="text-sm text-[#6B6B6B] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MCP comparison */}
      <section className="px-6 lg:px-16 py-[80px] bg-[#12101A]">
        <div className="max-w-[800px] mx-auto text-center">
          <p className="font-mono text-xs text-[#a99bff] uppercase tracking-wider mb-4">// MANAGED VS MCP</p>
          <h2 className="text-display-md text-white mb-8">Which mode is right for you?</h2>
          <div className="grid md:grid-cols-2 gap-6 text-left">
            <div className="bg-[#1E1B2E] border border-[#3A3A3A] rounded-xl p-6">
              <div className="text-[#a99bff] font-mono text-xs uppercase mb-2">MCP Mode</div>
              <h3 className="text-white font-semibold mb-3">Runs on your machine</h3>
              <ul className="space-y-2 text-sm text-[#9A9A9A]">
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Code never leaves your system</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />IDE integration via MCP</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Instant results for local projects</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />No network dependency</li>
              </ul>
              <Link to="/mcp" className="inline-flex items-center gap-2 mt-4 text-sm text-[#a99bff] hover:text-white transition-colors">
                Set up MCP <ArrowRight size={14} />
              </Link>
            </div>
            <div className="bg-[#1E1B2E] border border-[#574a7d]/30 rounded-xl p-6 ring-1 ring-[#574a7d]/20">
              <div className="text-[#a99bff] font-mono text-xs uppercase mb-2">Managed Mode</div>
              <h3 className="text-white font-semibold mb-3">Runs on our containers</h3>
              <ul className="space-y-2 text-sm text-[#9A9A9A]">
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Zero setup — just a repo URL</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Load testing at scale</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Dedicated compute resources</li>
                <li className="flex gap-2"><Check size={14} className="text-[#574a7d] mt-0.5 flex-shrink-0" />Ideal for vibe coders & indie devs</li>
              </ul>
              <div className="inline-flex items-center gap-2 mt-4 text-sm text-[#a99bff]">
                You're already here <Check size={14} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
