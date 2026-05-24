import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import CountUp from 'react-countup';
import {
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertTriangle,
  XCircle, FileDown, FileText, FileJson, Shield,
  Bug, GitBranch, Loader2
} from 'lucide-react';
import { SEED_REPORT } from '@/data/seedData';
import { getReport } from '@/lib/api';
import type { TestResult, Finding, TestStatus } from '@/data/seedData';

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

// ── Severity Config ────────────────────────────────────────────────────────
const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-[#D4524A]', bg: 'bg-[rgba(212,82,74,0.1)]', label: 'CRITICAL' },
  high: { color: 'text-[#E87D3A]', bg: 'bg-[rgba(232,125,58,0.1)]', label: 'HIGH' },
  medium: { color: 'text-[#E8A838]', bg: 'bg-[rgba(232,168,56,0.1)]', label: 'MEDIUM' },
  low: { color: 'text-[#C1A3FF]', bg: 'bg-[rgba(90,143,94,0.1)]', label: 'LOW' },
};

// ── Status Config ──────────────────────────────────────────────────────────
const statusConfig: Record<TestStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  passed: { icon: CheckCircle2, color: 'text-[#C1A3FF]', bg: 'bg-[rgba(90,143,94,0.1)]', label: 'PASSED' },
  failed: { icon: XCircle, color: 'text-[#D4524A]', bg: 'bg-[rgba(212,82,74,0.1)]', label: 'FAILED' },
  warning: { icon: AlertTriangle, color: 'text-[#E8A838]', bg: 'bg-[rgba(232,168,56,0.1)]', label: 'WARNING' },
};

// ── Animated Score Ring ────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#C1A3FF' : score >= 50 ? '#E8A838' : '#D4524A';

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#EBEBE5" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: easeOutExpo, delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading font-bold text-[28px] text-[#1A1A1A]">
          <CountUp end={score} duration={1.5} />
        </span>
        <span className="font-mono text-[10px] uppercase text-[#9A9A9A] tracking-[0.08em]">Score</span>
      </div>
    </div>
  );
}

// ── Severity Badge ─────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const c = severityConfig[severity] || severityConfig.low;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[4px] font-mono font-medium text-[11px] uppercase ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

// ── Log Entry ──────────────────────────────────────────────────────────────
function LogLine({ log }: { log: { level: string; time: string; message: string } }) {
  const colors: Record<string, string> = {
    info: 'text-[#6B6B6B]',
    pass: 'text-[#C1A3FF]',
    fail: 'text-[#D4524A]',
    warn: 'text-[#E8A838]',
  };
  return (
    <div className="flex gap-3 text-[13px] font-mono leading-relaxed">
      <span className="text-[#9A9A9A] flex-shrink-0">{log.time}</span>
      <span className={colors[log.level] || colors.info}>{log.message}</span>
    </div>
  );
}

// ── Finding Card ───────────────────────────────────────────────────────────
function FindingCard({ finding, index }: { finding: Finding; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="border border-[#D9D9D3] rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#F5F5F0] transition-colors"
      >
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-[#333333] font-body">{finding.message}</p>
          {finding.file && (
            <p className="text-[12px] text-[#9A9A9A] font-mono mt-0.5">
              {finding.file}{finding.line ? `:${finding.line}` : ''}
            </p>
          )}
        </div>
        {finding.fix ? (
          expanded ? <ChevronUp size={16} className="text-[#9A9A9A] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#9A9A9A] flex-shrink-0" />
        ) : null}
      </button>
      <AnimatePresence>
        {expanded && finding.fix && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 border-t border-[#D9D9D3] bg-[#F5F5F0] pt-3">
              <p className="text-[12px] text-[#6B6B6B] font-mono uppercase tracking-wider mb-1">Fix</p>
              <p className="text-[13px] text-[#333333] font-body">{finding.fix}</p>
              {finding.exploitability && (
                <p className="text-[12px] text-[#9A9A9A] font-body mt-1">
                  Exploitability: <span className="text-[#E87D3A]">{finding.exploitability}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Collapsible Stage Section ──────────────────────────────────────────────
function StageSection({ result, index }: { result: TestResult; index: number }) {
  const [open, setOpen] = useState(false);
  const config = statusConfig[result.status];
  const StatusIcon = config.icon;

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="border border-[#D9D9D3] rounded-[12px] overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[#F5F5F0] transition-colors"
      >
        <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
          <StatusIcon size={20} className={config.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-body font-medium text-[15px] text-[#1A1A1A]">{result.stage}</span>
            <span className={`font-mono font-medium text-[11px] uppercase px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-[12px] text-[#9A9A9A] font-body flex items-center gap-1">
              <Clock size={12} /> {formatDuration(result.duration)}
            </span>
            {result.findings.length > 0 && (
              <span className="text-[12px] text-[#E87D3A] font-body flex items-center gap-1">
                <Bug size={12} /> {result.findings.length} finding{result.findings.length > 1 ? 's' : ''}
              </span>
            )}
            {result.coverage !== undefined && (
              <span className="text-[12px] text-[#6B6B6B] font-body">
                Coverage: {result.coverage}%
              </span>
            )}
            {result.testsRun !== undefined && (
              <span className="text-[12px] text-[#6B6B6B] font-body">
                {result.testsRun} tests
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-[#9A9A9A]" /> : <ChevronDown size={18} className="text-[#9A9A9A]" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-4 border-t border-[#D9D9D3] pt-4 space-y-4">
              {/* Logs */}
              <div>
                <p className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A] tracking-wider mb-2">// Logs</p>
                <div className="bg-[#F5F5F0] rounded-lg p-4 space-y-1">
                  {result.logs.map((log, i) => (
                    <LogLine key={i} log={log} />
                  ))}
                </div>
              </div>

              {/* Findings */}
              {result.findings.length > 0 && (
                <div>
                  <p className="font-mono font-medium text-[11px] uppercase text-[#9A9A9A] tracking-wider mb-2">// Findings</p>
                  <div className="space-y-2">
                    {result.findings.map((f, i) => (
                      <FindingCard key={i} finding={f} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST REPORT PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function TestReport() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState(SEED_REPORT);
  const [loading, setLoading] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getReport(id)
      .then((apiReport) => {
        // Map API report to seed format
        setReport({
          id: apiReport.id,
          overallScore: apiReport.overallScore,
          repo: { owner: 'example', name: 'express-ecommerce-api' },
          branch: 'main',
          commit: 'a1b2c3d',
          startedAt: apiReport.generatedAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          totalDuration: 330000,
          status: 'completed',
          summary: {
            passed: 42,
            warning: apiReport.mediumCount + apiReport.lowCount,
            failed: apiReport.criticalCount + apiReport.highCount,
            criticalVulns: apiReport.criticalCount,
            highVulns: apiReport.highCount,
            mediumVulns: apiReport.mediumCount,
            lowVulns: apiReport.lowCount,
          },
          testResults: [],
          prd: {
            problemStatement: apiReport.title,
            affectedComponents: (apiReport.phases || []).flatMap(p => p.items.map(i => i.component || '')),
            phases: (apiReport.phases || []).map((p, pi) => ({
              phase: pi + 1,
              name: p.name,
              priority: p.priority,
              duration: p.effort,
              items: p.items.map(i => ({
                id: i.id,
                title: i.title,
                severity: i.severity as 'critical' | 'high' | 'medium' | 'low',
                effort: '1-2 days',
              })),
            })),
          },
        } as unknown as typeof SEED_REPORT);
      })
      .catch(() => {
        // Fallback to seed data
        setReport(SEED_REPORT);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleExport = (format: string) => {
    setExportToast(`Exporting ${format}...`);
    setTimeout(() => setExportToast(null), 2500);
  };

  const sevCounts = [
    { severity: 'critical', count: report.summary.criticalVulns, color: '#D4524A' },
    { severity: 'high', count: report.summary.highVulns, color: '#E87D3A' },
    { severity: 'medium', count: report.summary.mediumVulns, color: '#E8A838' },
    { severity: 'low', count: report.summary.lowVulns, color: '#C1A3FF' },
  ];

  const totalSev = sevCounts.reduce((s, c) => s + c.count, 0);

  return (
    <div className="min-h-[100dvh] bg-[#F5F5F0]">
      <div className="max-w-[1000px] mx-auto px-4 lg:px-8 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-[#C1A3FF]" />
          </div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
        >
          <div className="flex items-center gap-2 mb-2">
            <GitBranch size={16} className="text-[#C1A3FF]" />
            <span className="font-mono text-[13px] text-[#9A9A9A]">{report.repo.owner}/{report.repo.name}</span>
            <span className="text-[#D9D9D3]">|</span>
            <span className="font-mono text-[13px] text-[#9A9A9A]">{report.branch}</span>
            <span className="text-[#D9D9D3]">|</span>
            <span className="font-mono text-[13px] text-[#9A9A9A]">{report.commit}</span>
          </div>
          <h1 className="font-heading font-semibold text-[36px] text-[#1A1A1A] tracking-[-0.015em]">
            Test Report
          </h1>
          <p className="text-[16px] text-[#6B6B6B] font-body mt-1">
            Report ID: <span className="font-mono">{report.id}</span>
            {' · '}
            Completed: Jan 15, 2026 at 12:04 PM
          </p>
        </motion.div>

        {/* Score + Summary Row */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: easeOutExpo }}
          className="mt-8 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 bg-white border border-[#D9D9D3] rounded-[16px] p-8"
        >
          {/* Score Ring */}
          <div className="flex items-center justify-center md:justify-start">
            <ScoreRing score={report.overallScore} />
          </div>

          {/* Summary Stats */}
          <div className="space-y-5">
            {/* Stage counts */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { value: report.summary.passed, label: 'PASSED', color: 'text-[#C1A3FF]', bg: 'bg-[rgba(90,143,94,0.1)]' },
                { value: report.summary.warning, label: 'WARNINGS', color: 'text-[#E8A838]', bg: 'bg-[rgba(232,168,56,0.1)]' },
                { value: report.summary.failed, label: 'FAILED', color: 'text-[#D4524A]', bg: 'bg-[rgba(212,82,74,0.1)]' },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-lg p-4 text-center`}>
                  <div className={`font-heading font-bold text-[28px] ${s.color}`}>
                    <CountUp end={s.value} duration={1} />
                  </div>
                  <div className={`font-mono font-medium text-[11px] uppercase tracking-[0.08em] ${s.color} opacity-70`}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Severity bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-medium text-[12px] uppercase text-[#9A9A9A] tracking-wider">
                  SEVERITY BREAKDOWN
                </span>
                <span className="font-mono text-[12px] text-[#6B6B6B]">{totalSev} findings</span>
              </div>
              <div className="h-3 bg-[#EBEBE5] rounded-full overflow-hidden flex">
                {sevCounts.map((s) => (
                  <motion.div
                    key={s.severity}
                    initial={{ width: 0 }}
                    animate={{ width: totalSev > 0 ? `${(s.count / totalSev) * 100}%` : '0%' }}
                    transition={{ duration: 1, ease: easeOutExpo, delay: 0.5 }}
                    style={{ backgroundColor: s.color }}
                  />
                ))}
              </div>
              <div className="flex gap-4 mt-2">
                {sevCounts.map((s) => (
                  <div key={s.severity} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[12px] text-[#6B6B6B] font-body capitalize">{s.severity}</span>
                    <span className="text-[12px] text-[#9A9A9A] font-mono">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Export Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3 mt-6"
        >
          {[
            { format: 'JSON', icon: FileJson },
            { format: 'Markdown', icon: FileText },
            { format: 'PDF', icon: FileDown },
          ].map((btn) => (
            <button
              key={btn.format}
              onClick={() => handleExport(btn.format)}
              className="h-10 px-5 bg-white border border-[#D9D9D3] rounded-lg font-body font-medium text-[14px] text-[#333333] flex items-center gap-2 hover:bg-[#F5F5F0] hover:border-[#C9B5FF] transition-all duration-200"
            >
              <btn.icon size={16} /> Export {btn.format}
            </button>
          ))}
          <AnimatePresence>
            {exportToast && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="h-10 px-4 bg-[#F0EAFF] text-[#C1A3FF] rounded-lg font-body text-[14px] flex items-center"
              >
                <CheckCircle2 size={16} className="mr-2" /> {exportToast}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Test Stages */}
        <div className="mt-8">
          <h2 className="font-mono font-medium text-[12px] uppercase text-[#C1A3FF] tracking-[0.08em] mb-4">
            // TEST STAGES ({report.testResults.length})
          </h2>
          <div className="space-y-3">
            {report.testResults.map((result, i) => (
              <StageSection key={result.id} result={result} index={i} />
            ))}
          </div>
        </div>

        {/* PRD Preview */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-8 bg-white border border-[#D9D9D3] rounded-[16px] p-8 mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <Shield size={20} className="text-[#C1A3FF]" />
            <h2 className="font-heading font-medium text-[22px] text-[#1A1A1A]">Generated PRD</h2>
          </div>
          <p className="text-[15px] text-[#6B6B6B] font-body leading-relaxed mb-6">
            {report.prd.problemStatement}
          </p>

          <div className="flex flex-wrap gap-2 mb-6">
            <span className="font-mono text-[11px] uppercase text-[#9A9A9A]">Affected:</span>
            {report.prd.affectedComponents.map((c) => (
              <span key={c} className="px-2.5 py-1 bg-[#F5F5F0] rounded-full font-mono text-[11px] text-[#6B6B6B]">
                {c}
              </span>
            ))}
          </div>

          {/* Phases */}
          <div className="space-y-4">
            {report.prd.phases.map((phase) => (
              <div key={phase.phase} className="border border-[#D9D9D3] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#F5F5F0] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium text-[13px] text-[#C1A3FF]">Phase {phase.phase}</span>
                    <span className="font-body font-medium text-[14px] text-[#1A1A1A]">{phase.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase text-[#9A9A9A]">{phase.priority}</span>
                    <span className="font-mono text-[11px] text-[#9A9A9A]">{phase.duration}</span>
                  </div>
                </div>
                <div className="divide-y divide-[#D9D9D3]">
                  {phase.items.map((item) => (
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#F5F5F0] transition-colors">
                      <SeverityBadge severity={item.severity} />
                      <span className="font-mono text-[11px] text-[#9A9A9A] flex-shrink-0">{item.id}</span>
                      <span className="flex-1 text-[14px] text-[#333333] font-body">{item.title}</span>
                      <span className="font-mono text-[11px] text-[#9A9A9A]">{item.effort}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
