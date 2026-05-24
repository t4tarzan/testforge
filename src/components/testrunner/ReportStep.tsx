import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import {
  Check, ChevronDown, ChevronUp, FileJson, FileText, FileDown,
  Target, Eye, Grid3X3, FlaskConical, Puzzle, Route, Gauge, Brain,
  Shield, Accessibility, CloudLightning, Dna, ArrowRight, CheckCircle2,
  RotateCcw
} from 'lucide-react';
import { SEED_TEST_RESULTS, SEED_REPORT, SEED_REPO } from '@/data/seedData';
import type { Finding } from '@/data/seedData';

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  scope: Target,
  vision: Eye,
  'feature-matrix': Grid3X3,
  unit: FlaskConical,
  integration: Puzzle,
  e2e: Route,
  load: Gauge,
  predictive: Brain,
  security: Shield,
  visual: Eye,
  accessibility: Accessibility,
  chaos: CloudLightning,
  mutation: Dna,
  property: Target,
  contract: CheckCircle2,
  'edge-cases': Brain,
};

const STATUS_COLORS = {
  passed: { dot: 'bg-[#C1A3FF]', text: 'text-[#C1A3FF]' },
  failed: { dot: 'bg-[#D4524A]', text: 'text-[#D4524A]' },
  warning: { dot: 'bg-[#E8A838]', text: 'text-[#E8A838]' },
};

const SEVERITY_CONFIG = {
  critical: { color: '#D4524A', bg: 'bg-[rgba(212,82,74,0.1)]', text: 'text-[#D4524A]', label: 'CRITICAL' },
  high: { color: '#E87D3A', bg: 'bg-[rgba(232,125,58,0.1)]', text: 'text-[#E87D3A]', label: 'HIGH' },
  medium: { color: '#E8A838', bg: 'bg-[rgba(232,168,56,0.1)]', text: 'text-[#E8A838]', label: 'MEDIUM' },
  low: { color: '#C1A3FF', bg: 'bg-[rgba(90,143,94,0.1)]', text: 'text-[#C1A3FF]', label: 'LOW' },
};

interface ReportStepProps {
  onRestart: () => void;
}

export default function ReportStep({ onRestart }: ReportStepProps) {
  const [expandedVuln, setExpandedVuln] = useState<number | null>(0);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState<string | null>(null);
  const [prdExpanded, setPrdExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'severity' | 'file'>('severity');

  const summary = SEED_REPORT.summary;
  const allFindings = useMemo(() => {
    const findings: (Finding & { stage: string; index: number })[] = [];
    SEED_TEST_RESULTS.forEach((result) => {
      result.findings.forEach((f, i) => findings.push({ ...f, stage: result.stage, index: i }));
    });
    // Sort: critical first
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }, []);

  const scoreColor = SEED_REPORT.overallScore >= 85 ? '#C1A3FF' : SEED_REPORT.overallScore >= 70 ? '#E8A838' : '#D4524A';
  const scoreLabel = SEED_REPORT.overallScore >= 85 ? 'EXCELLENT' : SEED_REPORT.overallScore >= 70 ? 'GOOD' : 'NEEDS IMPROVEMENT';

  // Score ring
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - SEED_REPORT.overallScore / 100);

  const handleExport = (type: string) => {
    setExporting(type);
    setTimeout(() => {
      setExporting(null);
      setExportDone(type);
      if (type === 'JSON') {
        const data = JSON.stringify({ report: SEED_REPORT, results: SEED_TEST_RESULTS }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `testforge-report-${SEED_REPORT.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (type === 'Markdown') {
        const md = generateMarkdownReport();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `testforge-report-${SEED_REPORT.id}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setTimeout(() => setExportDone(null), 2000);
    }, 1500);
  };

  const severityData = [
    { label: 'CRITICAL', count: summary.criticalVulns, color: '#D4524A' },
    { label: 'HIGH', count: summary.highVulns, color: '#E87D3A' },
    { label: 'MEDIUM', count: summary.mediumVulns, color: '#E8A838' },
    { label: 'LOW', count: summary.lowVulns, color: '#C1A3FF' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-[28px] font-medium text-[#1A1A1A] tracking-[-0.01em]">
          Test Report Generated
        </h2>
      </div>

      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="max-w-[400px] mx-auto rounded-2xl p-8 text-center"
        style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)' }}
      >
        {/* Score Circle */}
        <div className="relative w-[120px] h-[120px] mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <motion.circle
              cx="60" cy="60" r={ringRadius} fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              initial={{ strokeDashoffset: ringCircumference }}
              animate={{ strokeDashoffset: ringOffset }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <CountUp end={SEED_REPORT.overallScore} duration={1.5} className="font-heading text-[48px] font-bold text-white leading-none" />
            <span className="text-[16px] text-[#9A9A9A] font-heading">/100</span>
          </div>
        </div>

        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#9A9A9A] mb-3">
          Overall Score
        </div>

        <span
          className="inline-block px-4 py-1.5 rounded-full font-mono text-[13px] uppercase font-medium"
          style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
        >
          {scoreLabel}
        </span>

        <div className="mt-4 text-[14px] text-[#9A9A9A]">
          Completed in {formatDuration(SEED_REPORT.totalDuration)} &bull; {summary.totalStages} dimensions &bull; {summary.totalFindings} findings
        </div>
      </motion.div>

      {/* Severity Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="max-w-[600px] mx-auto"
      >
        {/* Severity bar */}
        <div className="flex h-3 rounded-full overflow-hidden mb-3">
          {severityData.map((s) => (
            <motion.div
              key={s.label}
              initial={{ width: 0 }}
              animate={{ width: `${(s.count / Math.max(summary.totalFindings, 1)) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="h-full"
              style={{ backgroundColor: s.color }}
            />
          ))}
        </div>

        {/* Severity cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {severityData.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
              className="bg-white border border-[#D9D9D3] rounded-xl p-5 text-center"
            >
              <CountUp end={s.count} duration={0.8} className="font-heading text-[36px] font-bold block" style={{ color: s.color } as React.CSSProperties} />
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#6B6B6B] mt-1">
                {s.label}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stage Summary Cards */}
      <div>
        <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium mb-4 text-center">
          Stage Summary
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {SEED_TEST_RESULTS.map((result, i) => {
            const IconComp = STATUS_ICONS[result.id] || Target;
            const colors = STATUS_COLORS[result.status];
            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * i }}
                className="bg-white border border-[#D9D9D3] rounded-lg p-3 text-center hover:shadow-md transition-shadow cursor-pointer"
              >
                <IconComp size={18} className="text-[#C1A3FF] mx-auto mb-1.5" />
                <div className="text-[12px] font-medium text-[#333333] truncate">{result.stage}</div>
                <div className={`w-2 h-2 rounded-full mx-auto mt-1.5 ${colors.dot}`} />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Vulnerability Detail Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium">
            Vulnerability Details
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('severity')}
              className={`font-mono text-[11px] uppercase px-2 py-1 rounded ${sortBy === 'severity' ? 'bg-[#F0EAFF] text-[#C1A3FF]' : 'text-[#9A9A9A]'}`}
            >
              Severity
            </button>
            <button
              onClick={() => setSortBy('file')}
              className={`font-mono text-[11px] uppercase px-2 py-1 rounded ${sortBy === 'file' ? 'bg-[#F0EAFF] text-[#C1A3FF]' : 'text-[#9A9A9A]'}`}
            >
              File
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {allFindings.map((finding, i) => {
            const sev = SEVERITY_CONFIG[finding.severity];
            const isExpanded = expandedVuln === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'border-[#C9B5FF] shadow-md' : 'border-[#D9D9D3] hover:border-[#C9B5FF]'
                } ${finding.severity === 'critical' ? 'border-l-[3px] border-l-[#D4524A]' : finding.severity === 'high' ? 'border-l-[3px] border-l-[#E87D3A]' : ''}`}
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedVuln(isExpanded ? null : i)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono uppercase font-medium flex-shrink-0 ${sev.bg} ${sev.text}`}>
                    {sev.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-[#333333] truncate">{finding.message}</div>
                    {finding.file && (
                      <div className="text-[12px] text-[#9A9A9A] font-mono">{finding.file}{finding.line ? `:${finding.line}` : ''}</div>
                    )}
                  </div>
                  {finding.cve && (
                    <span className="font-mono text-[11px] text-[#9A9A9A] flex-shrink-0 hidden sm:block">{finding.cve}</span>
                  )}
                  {isExpanded ? <ChevronUp size={16} className="text-[#9A9A9A]" /> : <ChevronDown size={16} className="text-[#9A9A9A]" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-[#D9D9D3] bg-[#F5F5F0] p-4"
                  >
                    {finding.exploitability && (
                      <div className="mb-2">
                        <span className="font-mono text-[11px] uppercase text-[#6B6B6B]">Exploitability: </span>
                        <span className="text-[13px] text-[#333333]">{finding.exploitability}</span>
                      </div>
                    )}
                    {finding.fix && (
                      <div>
                        <span className="font-mono text-[11px] uppercase text-[#C1A3FF] block mb-1">Suggested Fix</span>
                        <p className="text-[13px] text-[#333333]">{finding.fix}</p>
                      </div>
                    )}
                    <button className="mt-3 text-[13px] text-[#C1A3FF] hover:underline flex items-center gap-1">
                      View in PRD <ArrowRight size={12} />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* PRD Preview */}
      <div>
        <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium mb-4">
          Generated PRD
        </h3>
        <div className="bg-white border border-[#D9D9D3] rounded-xl overflow-hidden">
          {/* PRD Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9D9D3] bg-[#F5F5F0]">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#C1A3FF]" />
              <span className="font-mono text-[13px] text-[#333333] font-medium">
                {SEED_REPO.name}-test-report.md
              </span>
            </div>
            <span className="text-[12px] text-[#9A9A9A]">Generated just now</span>
          </div>

          {/* PRD Content */}
          <div className={`px-5 overflow-hidden transition-all duration-500 ${prdExpanded ? 'max-h-[800px] overflow-y-auto' : 'max-h-[250px]'}`}>
            <div className="py-5 space-y-4 text-[14px] text-[#333333] leading-[1.7]">
              <h4 className="font-heading text-[18px] font-medium">{SEED_REPORT.prd.title}</h4>

              <div className="bg-[#F5F5F0] rounded-lg p-4 font-mono text-[12px] space-y-1">
                <div><span className="text-[#6B6B6B]">Overall Score:</span> <span className="text-[#C1A3FF] font-medium">{SEED_REPORT.overallScore}/100</span></div>
                <div><span className="text-[#6B6B6B]">Status:</span> <span className="text-[#E8A838]">NEEDS IMPROVEMENT</span></div>
                <div><span className="text-[#6B6B6B]">Findings:</span> {summary.criticalVulns}C / {summary.highVulns}H / {summary.mediumVulns}M / {summary.lowVulns}L</div>
              </div>

              <div>
                <h5 className="font-heading text-[14px] font-medium mb-2">Problem Statement</h5>
                <p className="text-[13px] text-[#6B6B6B]">{SEED_REPORT.prd.problemStatement}</p>
              </div>

              <div>
                <h5 className="font-heading text-[14px] font-medium mb-2">Affected Components</h5>
                <div className="flex flex-wrap gap-1.5">
                  {SEED_REPORT.prd.affectedComponents.map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-[#F0EAFF] text-[#C1A3FF] font-mono text-[11px] rounded">{c}</span>
                  ))}
                </div>
              </div>

              {/* Phases */}
              {SEED_REPORT.prd.phases.map((phase) => (
                <div key={phase.phase}>
                  <h5 className="font-heading text-[14px] font-medium mb-2">
                    Phase {phase.phase}: {phase.name}
                  </h5>
                  <div className="space-y-2">
                    {phase.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#F5F5F0]">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-medium ${SEVERITY_CONFIG[item.severity].bg} ${SEVERITY_CONFIG[item.severity].text}`}>
                          {item.severity}
                        </span>
                        <span className="font-mono text-[11px] text-[#9A9A9A]">{item.id}</span>
                        <span className="flex-1 text-[13px]">{item.title}</span>
                        <span className="text-[11px] text-[#9A9A9A]">{item.effort}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PRD Footer */}
          <button
            onClick={() => setPrdExpanded(!prdExpanded)}
            className="w-full py-3 border-t border-[#D9D9D3] text-center font-mono text-[12px] text-[#C1A3FF] hover:bg-[#F5F5F0] transition-colors flex items-center justify-center gap-1"
          >
            {prdExpanded ? 'Show Less' : 'View Full PRD'}
            {prdExpanded ? <ChevronUp size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>
      </div>

      {/* Export Buttons */}
      <div>
        <h3 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium mb-4 text-center">
          Export Report
        </h3>
        <div className="flex flex-wrap justify-center gap-3">
          <ExportButton
            label="Export JSON"
            icon={<FileJson size={18} />}
            type="JSON"
            variant="primary"
            exporting={exporting === 'JSON'}
            done={exportDone === 'JSON'}
            onClick={() => handleExport('JSON')}
          />
          <ExportButton
            label="Export Markdown"
            icon={<FileText size={18} />}
            type="Markdown"
            variant="secondary"
            exporting={exporting === 'Markdown'}
            done={exportDone === 'Markdown'}
            onClick={() => handleExport('Markdown')}
          />
          <ExportButton
            label="Export PDF"
            icon={<FileDown size={18} />}
            type="PDF"
            variant="ghost"
            exporting={exporting === 'PDF'}
            done={exportDone === 'PDF'}
            onClick={() => {
              setExporting('PDF');
              setTimeout(() => {
                setExporting(null);
                setExportDone('PDF');
                alert('PDF export coming soon!');
                setTimeout(() => setExportDone(null), 2000);
              }, 1000);
            }}
          />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex justify-center pt-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onRestart}
          className="flex items-center gap-2 px-8 py-3.5 bg-[#C1A3FF] text-white rounded-lg font-body font-medium text-[16px] hover:bg-[#A07BDD] transition-colors"
        >
          <RotateCcw size={16} />
          Run Again
        </motion.button>
      </div>
    </motion.div>
  );
}

function ExportButton({
  label, icon, variant, exporting, done, onClick,
}: {
  label: string;
  icon: React.ReactNode;
  type: string;
  variant: 'primary' | 'secondary' | 'ghost';
  exporting: boolean;
  done: boolean;
  onClick: () => void;
}) {
  const baseClass = 'flex items-center gap-2 px-6 py-3.5 rounded-[10px] font-body font-medium text-[15px] transition-all';
  const variantClass = {
    primary: 'bg-[#C1A3FF] text-white hover:bg-[#A07BDD]',
    secondary: 'bg-[#1A1A1A] text-white hover:bg-[#333333]',
    ghost: 'border border-[#D9D9D3] text-[#333333] hover:bg-[#F0EAFF] hover:border-[#C9B5FF]',
  }[variant];

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      disabled={exporting}
      className={`${baseClass} ${variantClass} ${exporting ? 'opacity-70' : ''}`}
    >
      {exporting ? (
        <motion.div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : done ? (
        <Check size={18} strokeWidth={3} />
      ) : (
        icon
      )}
      {done ? 'Downloaded' : exporting ? 'Exporting...' : label}
    </motion.button>
  );
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function generateMarkdownReport(): string {
  return `# Test Report — ${SEED_REPO.name}
**Generated:** ${new Date().toISOString()}
**Repository:** ${SEED_REPO.owner}/${SEED_REPO.name}
**Branch:** ${SEED_REPORT.branch}
**Overall Score:** ${SEED_REPORT.overallScore}/100
**Status:** ${SEED_REPORT.overallScore >= 85 ? 'PASS' : 'NEEDS IMPROVEMENT'}

---

## Executive Summary

The test suite identified **${SEED_REPORT.summary.criticalVulns} critical**, **${SEED_REPORT.summary.highVulns} high**, **${SEED_REPORT.summary.mediumVulns} medium**, and **${SEED_REPORT.summary.lowVulns} low** severity issues across ${SEED_REPORT.summary.totalStages} testing dimensions.

### Key Recommendations
${SEED_TEST_RESULTS.flatMap((r) => r.findings.map((f) => `- **${f.severity.toUpperCase()}**: ${f.message}${f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : ''}`)).slice(0, 10).join('\n')}

---

## PRD: ${SEED_REPORT.prd.title}

${SEED_REPORT.prd.problemStatement}

### Implementation Phases
${SEED_REPORT.prd.phases.map((p) => `
#### Phase ${p.phase}: ${p.name} (${p.duration})
${p.items.map((item) => `- **${item.id}** [${item.severity.toUpperCase()}] ${item.title} — ${item.effort} (${item.component})`).join('\n')}
`).join('\n')}

---

*Generated by TestForge v2*
`;
}
