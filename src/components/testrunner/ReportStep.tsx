import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, FileJson, FileText, FileDown, Shield,
  RotateCcw, Eye, Target, Layers, Sparkles, TrendingUp
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts';

/** Shape of a finding rendered in the report. Optional fields because
 *  not every analyzer dimension fills every slot. */
type FindingShape = {
  severity: string;
  title: string;
  description?: string;
  filePath?: string;
  lineNumber?: number;
  fixSuggestion?: string;
  category?: string;
};

// The analysis result is a dynamic blob — the analyzer's full output
// shape isn't pinned down with a schema yet, and individual dimensions
// evolve independently across versions. Pinning it precisely would
// require a coordinated schema rollout. Until then, keep it as a
// `Record<string, any>` so existing optional-chaining call sites work
// — and explicitly disable the rule here, not site-by-site.
// TODO(testforge): replace with a proper AnalysisResults type when
// the analyzer output is locked.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalysisResults = Record<string, any>;

interface ReportStepProps {
  results: AnalysisResults;
  onRestart: () => void;
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, string> = {
    critical: 'bg-[rgba(212,82,74,0.1)] text-[#D4524A]',
    high: 'bg-[rgba(232,125,58,0.1)] text-[#E87D3A]',
    medium: 'bg-[rgba(232,168,56,0.1)] text-[#E8A838]',
    low: 'bg-[rgba(90,143,94,0.1)] text-[#574a7d]',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-medium uppercase ${config[severity] || config.low}`}>
      {severity}
    </span>
  );
}

// Collect the highest-severity findings across all dimensions for Tier-2.
function collectFindings(results: AnalysisResults): FindingShape[] {
  const out: FindingShape[] = [];
  const push = (f: any, cat: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!f || !f.title) return;
    out.push({ severity: f.severity || 'medium', title: f.title, description: f.description, filePath: f.filePath, lineNumber: f.lineNumber, fixSuggestion: f.fixSuggestion || f.suggestion, category: f.category || cat });
  };
  (results.security?.items || []).forEach((f: FindingShape) => push(f, 'Security'));
  ['edgeCases', 'predictive', 'contract', 'supplyChain', 'kubernetes', 'nPlusOne', 'agentic', 'vision', 'chaos', 'dora', 'license'].forEach((k) => {
    (results[k]?.findings || []).forEach((f: FindingShape) => push(f, k));
  });
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return out.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
}

export function Tier2Section({ results }: { results: AnalysisResults }) {
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [err, setErr] = useState<any>(null);
  const findings = collectFindings(results);

  const run = async () => {
    setBusy(true); setErr(null); setData(null);
    try {
      const res = await fetch('/api/generate-and-run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings: findings.slice(0, 3), maxFindings: 3, cluster: 'mixed-top-severity' }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) setErr({ type: 'auth' });
      else if (res.status === 402) setErr({ type: 'quota', reason: d.reason });
      else if (!res.ok || d.error) setErr({ type: 'error', message: d.error || `HTTP ${res.status}` });
      else setData(d);
    } catch { setErr({ type: 'error', message: 'Network error — please retry.' }); }
    setBusy(false);
  };

  if (findings.length === 0) return null;
  const run0 = data?.run;
  const dockerMissing = run0?.dockerUnavailable;

  return (
    <div className="bg-white border border-[#a39fd4] rounded-[12px] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h3 className="font-heading font-medium text-[18px] text-[#12101A]">🤖 Tier 2 — Generate &amp; Run</h3>
          <p className="text-[13px] text-[#6B6B6B] font-body mt-0.5">An LLM writes real tests for your top findings and runs them in a sandbox.</p>
        </div>
        <button onClick={run} disabled={busy} className="h-10 px-5 bg-[#574a7d] text-white rounded-lg font-body font-medium text-[14px] hover:bg-[#4a3d6b] transition-colors disabled:opacity-50">
          {busy ? 'Generating…' : 'Generate Tests (Tier 2)'}
        </button>
      </div>

      {err?.type === 'auth' && (
        <div className="mt-3 text-[13px] text-[#b91c1c] font-body">Please <a href="#/login" className="underline">sign in</a> to run Tier-2.</div>
      )}
      {err?.type === 'quota' && (
        <div className="mt-3 p-3 bg-[rgba(234,168,56,0.1)] border border-[rgba(234,168,56,0.35)] rounded-lg text-[13px] font-body text-[#9a6b15]">
          {err.reason || 'Tier-2 requires a key or a paid plan.'}{' '}
          <a href="#/account" className="text-[#574a7d] font-medium underline">Add your OpenRouter key (BYOK)</a> or <a href="#/pricing" className="text-[#574a7d] font-medium underline">upgrade</a>.
        </div>
      )}
      {err?.type === 'error' && (
        <div className="mt-3 text-[13px] text-[#b91c1c] font-body">Tier-2 failed: {err.message}</div>
      )}

      {data && (
        <div className="mt-4">
          <p className="text-[12px] text-[#6B6B6B] font-mono mb-3">
            {data.provider?.byok ? 'your key' : data.provider?.primary} · generation {((data.generationMs || 0) / 1000).toFixed(1)}s{data.runMs ? ` · sandbox ${data.runMs}ms` : ''}
          </p>
          {dockerMissing ? (
            <div className="p-3 bg-[rgba(234,168,56,0.1)] border border-[rgba(234,168,56,0.35)] rounded-lg text-[13px] text-[#9a6b15] mb-3">
              🐳 {dockerMissing.reason} — tests generated but not run. {dockerMissing.help}
            </div>
          ) : run0 && (
            <div className={`inline-block px-3 py-1.5 rounded-md text-[13px] font-medium mb-3 ${run0.success ? 'bg-[#E8F5EE] text-[#1c7a4d]' : 'bg-[rgba(239,68,68,0.1)] text-[#b91c1c]'}`}>
              {run0.success ? '✓' : '✗'} {run0.numPassedTests}/{run0.numTotalTests} tests passed{run0.numFailedTests > 0 ? ` · ${run0.numFailedTests} failed` : ''}
            </div>
          )}
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(data.results || []).map((r: any, i: number) => {
              const fr = run0?.files?.[i];
              return (
                <div key={i} className="border border-[#E8E5FF] bg-[rgba(87,74,125,0.04)] rounded-lg p-3">
                  <div className="font-mono text-[13px] text-[#12101A]">📝 {r.file ? r.file.filename : '(no file produced)'}</div>
                  <div className="text-[12px] text-[#6B6B6B] mt-0.5">For: {r.finding?.title}</div>
                  {fr?.status === 'skipped'
                    ? <div className="text-[12px] text-[#E8A838] mt-1">→ GENERATED · not run (Docker required)</div>
                    : fr && <div className={`text-[12px] mt-1 ${fr.status === 'passed' ? 'text-[#1c7a4d]' : 'text-[#b91c1c]'}`}>→ {fr.status.toUpperCase()} · {fr.numPassed} passed, {fr.numFailed} failed</div>}
                  {fr && (fr.status === 'errored' || fr.status === 'failed') && fr.failureMessages?.[0] && (
                    <pre className="mt-1.5 text-[11px] text-[#b91c1c] bg-[#fbeaea] rounded p-2 whitespace-pre-wrap overflow-x-auto max-h-[140px]">{fr.failureMessages[0]}</pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportStep({ results, onRestart }: ReportStepProps) {
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Save results to Neon DB
  useEffect(() => {
    if (!results || saved) return;
    fetch('/api/save-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    }).then(r => r.json()).then(d => {
      if (d.saved) setSaved(true);
    }).catch(() => {});
  }, [results]);

  if (!results) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6B6B6B]">No analysis results available.</p>
        <button onClick={onRestart} className="mt-4 text-[#574a7d] font-medium">Try again</button>
      </div>
    );
  }

  const { codebase = {}, security = {}, unit = {}, load = {}, accessibility = {}, vision = {}, scope = {}, stack = {} } = results;
  
  // Build dimension scores for radar chart
  const dimScores = [
    { dimension: 'Security', score: Math.max(0, 100 - (security.critical || 0) * 20 - (security.high || 0) * 5), fullMark: 100 },
    { dimension: 'Unit Tests', score: unit.coverage || 0, fullMark: 100 },
    { dimension: 'Load/Perf', score: load.maxUsers > 100 ? 90 : load.maxUsers > 50 ? 70 : 40, fullMark: 100 },
    { dimension: 'Accessibility', score: accessibility.score || 0, fullMark: 100 },
    { dimension: 'Vision', score: vision.score || 0, fullMark: 100 },
    { dimension: 'Scope', score: scope.coverage || 0, fullMark: 100 },
    { dimension: 'Stack', score: stack.score || 0, fullMark: 100 },
    { dimension: 'Contract', score: results.contract?.score || 0, fullMark: 100 },
    { dimension: 'Visual Reg.', score: results.visualRegression?.score || 0, fullMark: 100 },
    { dimension: 'Edge Cases', score: results.edgeCases?.score || 0, fullMark: 100 },
    { dimension: 'Property', score: results.propertyBased?.score || 0, fullMark: 100 },
    { dimension: 'Chaos', score: results.chaos?.score || 0, fullMark: 100 },
    { dimension: 'Mutation', score: results.mutation?.score || 0, fullMark: 100 },
    { dimension: 'Predictive', score: results.predictive?.score || 0, fullMark: 100 },
  ];

  // Top 3 risks
  const allFindings = (security.items || []).slice(0, 3);
  const estimatedFixDays = (security.critical || 0) * 2 + (security.high || 0) * 1 + (security.medium || 0) * 0.5;
  const overallScore = Math.round(
    (accessibility.score || 70) * 0.10 +
    Math.max(0, 100 - (security.critical || 0) * 20 - (security.high || 0) * 5) * 0.15 +
    Math.max(0, 100 - (load.maxUsers < 50 ? 30 : 0)) * 0.10 +
    (unit.coverage || 50) * 0.10 +
    (vision.score || 50) * 0.25 +
    (scope.coverage || 30) * 0.15 +
    (stack.score || 60) * 0.15
  );

  const scoreColor = overallScore >= 80 ? '#574a7d' : overallScore >= 50 ? '#E8A838' : '#D4524A';

  const handleExport = (format: string) => {
    setExportFormat(format);
    let content = '';
    const filename = `testforge-report.${format === 'json' ? 'json' : format === 'pdf' ? 'html' : 'md'}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(results, null, 2);
      mimeType = 'application/json';
    } else if (format === 'pdf') {
      // Generate printable HTML report
      const secItems = (security.items || []).map((f: FindingShape) =>
        `<div style="margin:8px 0;padding:10px;border-left:3px solid ${f.severity==='critical'?'#D4524A':f.severity==='high'?'#E87D3A':'#E8A838'}">
          <strong>[${f.severity.toUpperCase()}]</strong> ${f.title}<br/>
          <code>${f.filePath || ''}${f.lineNumber?':'+f.lineNumber:''}</code><br/>
          ${f.fixSuggestion ? '<em>Fix: '+f.fixSuggestion+'</em>' : ''}
        </div>`
      ).join('');
      
      content = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>TestForge Report</title>
        <style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;color:#333;line-height:1.6}
        h1{color:#574a7d;border-bottom:2px solid #574a7d;padding-bottom:10px}
        h2{color:#12101A;margin-top:30px}.stat{display:inline-block;padding:10px 20px;margin:5px;background:#f5f5f0;border-radius:8px}
        .stat b{display:block;font-size:24px;color:#574a7d}
        @media print{body{margin:20px}}</style></head><body>
        <h1>🧪 TestForge Analysis Report</h1>
        <p><strong>Repo:</strong> ${results.repo || 'Unknown'} · <strong>Branch:</strong> ${results.branch || 'main'}</p>
        <p><strong>Analyzed:</strong> ${results.analyzedAt || new Date().toISOString()}</p>
        <div>${[
          {l:'Files',v:codebase.totalFiles},{l:'Lines',v:codebase.totalLines},{l:'Endpoints',v:codebase.endpoints},
          {l:'Vision',v:vision.score+'/100'},{l:'Scope',v:scope.coverage+'%'},{l:'Stack',v:stack.score+'/100'},
          {l:'Security',v:security.findings},{l:'Coverage',v:(unit.coverage||0)+'%'},{l:'A11y',v:(accessibility.score||0)+'/100'}
        ].map(s=>'<div class="stat"><b>'+s.v+'</b>'+s.l+'</div>').join('')}</div>
        <h2>🔒 Security Findings (${security.findings || 0})</h2>${secItems}
        <h2>👁️ Vision & Alignment: ${vision.score || '—'}/100</h2><p>${vision.summary || ''}</p>
        <h2>📦 Stack Analysis: ${stack.score || '—'}/100</h2>
        ${(stack.strengths||[]).map((s:string)=>'<p>✓ '+s+'</p>').join('')}
        ${(stack.recommendations||[]).map((r:string)=>'<p>💡 '+r+'</p>').join('')}
        <p style="margin-top:30px;color:#9A9A9A;font-size:12px">Generated by TestForge AI</p>
        </body></html>`;
      mimeType = 'text/html';
      
      // Open in new window for print-to-PDF
      const w = window.open('', '_blank', 'width=900,height=700');
      if (w) { w.document.write(content); w.document.close(); }
      setExportFormat(null);
      return;
    } else if (format === 'markdown') {
      content = `# TestForge Analysis Report\n\n`;
      content += `**Repo:** ${results.repo || 'Unknown'}\n`;
      content += `**Branch:** ${results.branch || 'main'}\n`;
      content += `**Analyzed:** ${results.analyzedAt || new Date().toISOString()}\n\n`;
      content += `## Codebase\n- **Files:** ${codebase.totalFiles}\n- **Lines:** ${codebase.totalLines}\n- **Endpoints:** ${codebase.endpoints}\n- **Tech Stack:** ${(codebase.techStack || []).join(', ')}\n\n`;
      content += `## Security (${security.findings} findings)\n`;
      (security.items || []).forEach((f: FindingShape) => {
        content += `- **[${f.severity.toUpperCase()}]** ${f.title} — \`${f.filePath}:${f.lineNumber}\`\n`;
        if (f.fixSuggestion) content += `  - Fix: ${f.fixSuggestion}\n`;
      });
      content += `\n## Unit Tests\n- Coverage: ${unit.coverage}%\n- Test Files: ${unit.testFiles}\n- Frameworks: ${(unit.frameworks || []).join(', ')}\n\n`;
      content += `## Load Analysis\n- Max Users: ${load.maxUsers}\n- Rate Limiting: ${load.rateLimiting ? 'Yes' : 'No'}\n- Caching: ${load.caching ? 'Yes' : 'No'}\n\n`;
      content += `## Accessibility\n- Score: ${accessibility.score}/100\n- Issues: ${accessibility.issues}\n\n`;
      content += `---\n*Generated by TestForge AI*`;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setExportFormat(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[800px] mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#E8E5FF] rounded-full mb-4">
          <CheckCircle2 size={16} className="text-[#574a7d]" />
          <span className="font-mono text-xs text-[#574a7d] font-medium">ANALYSIS COMPLETE</span>
        </div>
        <h2 className="font-heading text-[28px] font-medium text-[#12101A]">Test Report</h2>
        <p className="text-[#6B6B6B] mt-2">
          {results.repo && <span className="font-mono text-sm">{results.repo}</span>}
          {' · '}{codebase.totalFiles} files · {codebase.totalLines} lines
        </p>
      </div>

      {/* Executive Summary + Radar Chart */}
      <div className="grid lg:grid-cols-[1fr_400px] gap-6 mb-6">
        {/* Executive Summary */}
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-[#574a7d]" />
            <h3 className="font-semibold text-[#12101A]">Executive Summary</h3>
          </div>
          <p className="text-sm text-[#6B6B6B] mb-4">
            {overallScore >= 80 ? '🟢 Strong codebase. ' : overallScore >= 50 ? '🟡 Needs attention. ' : '🔴 Critical issues. '}
            {security.critical || 0} critical, {security.high || 0} high findings. 
            {vision.score < 50 ? 'Missing observability. ' : ''}
            {scope.coverage < 30 ? 'Low scope coverage. ' : ''}
            Estimated fix time: <strong>{estimatedFixDays.toFixed(1)} days</strong>.
          </p>
          
          {/* Top Risks */}
          {allFindings.length > 0 && (
            <div>
              <p className="text-xs font-mono text-[#EF4444] uppercase mb-2">Top Risks</p>
              {allFindings.map((f: FindingShape, i: number) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[#ECEBF5] last:border-0">
                  <span className="text-xs text-[#9A9A9A] font-mono w-5">{i+1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#333333]">{f.title}</p>
                    {f.filePath && <p className="text-[11px] text-[#9A9A9A] font-mono">{f.filePath}:{f.lineNumber}</p>}
                  </div>
                  <SeverityBadge severity={f.severity} />
                </div>
              ))}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#ECEBF5]">
            {[
              { label: 'Fix Est.', value: `${estimatedFixDays.toFixed(1)}d` },
              { label: 'Dimensions', value: '14' },
              { label: 'Files', value: codebase.totalFiles },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-lg font-bold text-[#12101A]">{s.value}</div>
                <div className="text-[10px] text-[#6B6B6B]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Radar Chart */}
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6">
          <h3 className="font-semibold text-[#12101A] mb-2 text-center">Dimension Scores</h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={dimScores} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="#ECEBF5" />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#6B6B6B' }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#9A9A9A' }} />
              <Radar name="Score" dataKey="score" stroke="#574a7d" fill="#574a7d" fillOpacity={0.2} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score Card */}
      <div className="bg-white border border-[#D9D9D3] rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-8">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#ECEBF5" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={2 * Math.PI * 42}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{ strokeDashoffset: (2 * Math.PI * 42) * (1 - overallScore / 100) }}
                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading font-bold text-2xl" style={{ color: scoreColor }}>{overallScore}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
            {[
              { label: 'Files', value: codebase.totalFiles },
              { label: 'Endpoints', value: codebase.endpoints },
              { label: 'Vision', value: `${vision.score || '—'}/100`, sub: vision.score < 50 ? 'Needs work' : '' },
              { label: 'Scope', value: `${scope.coverage || 0}%` },
              { label: 'Security', value: security.findings, sub: `${security.critical || 0} critical` },
              { label: 'Test Cov.', value: `${unit.coverage || 0}%` },
              { label: 'Stack', value: `${stack.score || '—'}/100` },
              { label: 'A11y', value: `${accessibility.score || 0}/100` },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-[#12101A]">{stat.value}</div>
                <div className="text-xs text-[#6B6B6B]">{stat.label}</div>
                {stat.sub && <div className="text-[11px] text-[#D4524A]">{stat.sub}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Findings */}
      {security.items && security.items.length > 0 && (
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-[#574a7d]" />
            <h3 className="font-semibold text-[#12101A]">Security Findings ({security.items.length})</h3>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {security.items.slice(0, 15).map((finding: FindingShape, i: number) => (
              <div key={i} className="border border-[#D9D9D3] rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#F7F7FB] transition-colors"
                >
                  <SeverityBadge severity={finding.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#333333]">{finding.title}</p>
                    <p className="text-xs text-[#9A9A9A] font-mono mt-0.5">
                      {finding.filePath}{finding.lineNumber ? `:${finding.lineNumber}` : ''}
                    </p>
                  </div>
                </button>
                {expandedFinding === i && finding.fixSuggestion && (
                  <div className="px-4 pb-3 border-t border-[#D9D9D3] bg-[#F7F7FB] pt-3">
                    <p className="text-xs text-[#6B6B6B] font-mono uppercase mb-1">Fix</p>
                    <p className="text-sm text-[#333333]">{finding.fixSuggestion}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vision & Goal Alignment — unique differentiator */}
      {vision.score !== undefined && (
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={18} className="text-[#4A90D9]" />
            <h3 className="font-semibold text-[#12101A]">Vision & Goal Alignment</h3>
            <span className={`ml-auto font-mono text-sm font-bold ${vision.score >= 70 ? 'text-[#574a7d]' : vision.score >= 40 ? 'text-[#E8A838]' : 'text-[#D4524A]'}`}>{vision.score}/100</span>
          </div>
          <p className="text-sm text-[#6B6B6B] mb-3">{vision.summary}</p>
          {vision.findings?.map((f: FindingShape, i: number) => (
            <div key={i} className="flex items-start gap-2 text-sm py-1.5">
              <SeverityBadge severity={f.severity} />
              <span className="text-[#333333]">{f.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Scope Coverage */}
      {scope.coverage !== undefined && (
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} className="text-[#E8A838]" />
            <h3 className="font-semibold text-[#12101A]">Scope Coverage</h3>
            <span className="ml-auto font-mono text-sm font-bold text-[#574a7d]">{scope.coverage}%</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div className="bg-[#F7F7FB] rounded-lg p-3">
              <div className="text-xl font-bold text-[#12101A]">{scope.documentedFeatures}</div>
              <div className="text-[11px] text-[#6B6B6B]">Documented</div>
            </div>
            <div className="bg-[#E8E5FF] rounded-lg p-3">
              <div className="text-xl font-bold text-[#574a7d]">{scope.implementedFeatures}</div>
              <div className="text-[11px] text-[#6B6B6B]">Implemented</div>
            </div>
            <div className="bg-[#FFF0F0] rounded-lg p-3">
              <div className="text-xl font-bold text-[#D4524A]">{scope.missingFeatures?.length || 0}</div>
              <div className="text-[11px] text-[#6B6B6B]">Missing</div>
            </div>
          </div>
        </div>
      )}

      {/* Stack Analysis */}
      {stack.score !== undefined && (
        <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={18} className="text-[#574a7d]" />
            <h3 className="font-semibold text-[#12101A]">Stack Choice Analysis</h3>
            <span className={`ml-auto font-mono text-sm font-bold ${stack.score >= 70 ? 'text-[#574a7d]' : 'text-[#E8A838]'}`}>{stack.score}/100</span>
          </div>
          {stack.strengths?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-mono text-[#574a7d] uppercase mb-2">Strengths</p>
              {stack.strengths.slice(0, 4).map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm py-1">
                  <span className="text-[#574a7d] mt-0.5">✓</span>
                  <span className="text-[#333333]">{s}</span>
                </div>
              ))}
            </div>
          )}
          {stack.weaknesses?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-mono text-[#D4524A] uppercase mb-2">Weaknesses</p>
              {stack.weaknesses.map((w: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm py-1">
                  <span className="text-[#D4524A] mt-0.5">✗</span>
                  <span className="text-[#333333]">{w}</span>
                </div>
              ))}
            </div>
          )}
          {stack.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-mono text-[#6B6B6B] uppercase mb-2">Recommendations</p>
              {stack.recommendations.slice(0, 3).map((r: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm py-1">
                  <Sparkles size={14} className="text-[#4A90D9] mt-0.5 flex-shrink-0" />
                  <span className="text-[#6B6B6B]">{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tech Stack */}
      <div className="bg-white border border-[#D9D9D3] rounded-2xl p-6 mb-4">
        <h3 className="font-semibold text-[#12101A] mb-3">Detected Tech Stack</h3>
        <div className="flex flex-wrap gap-2">
          {(codebase.techStack || ['Node.js']).map((tech: string) => (
            <span key={tech} className="px-3 py-1.5 bg-[#E8E5FF] border border-[#a39fd4] rounded-md font-mono text-xs text-[#574a7d]">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Tier 2 — Generate & Run (BYOK or paid) */}
      <Tier2Section results={results} />

      {/* Export + Restart */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {[
            { format: 'json', label: 'Export JSON', icon: FileJson },
            { format: 'markdown', label: 'Export Markdown', icon: FileText },
            { format: 'pdf', label: 'Export PDF', icon: FileDown },
          ].map((btn) => (
            <button
              key={btn.format}
              onClick={() => handleExport(btn.format)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D9D9D3] text-sm font-medium text-[#333333] hover:bg-[#F7F7FB] hover:border-[#a39fd4] transition-all"
            >
              <btn.icon size={16} />
              {exportFormat === btn.format ? 'Exported!' : btn.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRestart}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B6B6B] hover:text-[#12101A] transition-colors"
        >
          <RotateCcw size={16} />
          Test Another Repo
        </button>
      </div>
    </motion.div>
  );
}
