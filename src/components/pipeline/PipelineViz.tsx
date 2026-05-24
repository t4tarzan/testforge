import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import CountUp from 'react-countup';
import { stages as initialStages, statusColors, severityColors, type Stage, type StageStatus } from './stagesData';
import LiveLogs from './LiveLogs';

/* ------------------------------------------------------------------ */
/*  Status badge                                                      */
/* ------------------------------------------------------------------ */

const StatusBadge = memo(function StatusBadge({ status, size = 'sm' }: { status: StageStatus; size?: 'sm' | 'lg' }) {
  const labels: Record<StageStatus, string> = {
    pending: 'Pending',
    running: 'Running',
    passed: 'Passed',
    failed: 'Failed',
  };
  const c = statusColors[status];
  const sizeClasses = size === 'lg' ? 'text-[13px] px-4 py-[6px]' : 'text-[11px] px-3 py-[4px]';

  return (
    <span className={`font-mono font-medium uppercase tracking-wider rounded ${sizeClasses} ${c.bg} ${c.text}`}>
      {labels[status]}
    </span>
  );
});

/* ------------------------------------------------------------------ */
/*  Stage list item                                                   */
/* ------------------------------------------------------------------ */

const StageListItem = memo(function StageListItem({
  stage,
  isSelected,
  onClick,
}: {
  stage: Stage;
  isSelected: boolean;
  onClick: () => void;
}) {
  const c = statusColors[stage.status];
  return (
    <motion.button
      onClick={onClick}
      layout="position"
      className={`w-full text-left px-5 py-4 border-b border-[#D9D9D3] transition-colors duration-200 relative
        ${isSelected ? 'bg-[#E8E5FF]' : 'bg-white hover:bg-[#F7F7FB]'}
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300 ${c.bar}`} />

      <div className="flex items-center justify-between pl-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-[#574a7d]">{stage.number} //</span>
          <span className="font-body font-medium text-[15px] text-[#333333]">{stage.name}</span>
        </div>
        <StatusBadge status={stage.status} />
      </div>

      <div className="mt-2 pl-2 flex items-center gap-3">
        <div className="flex-1 h-[3px] bg-[#ECEBF5] rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${c.bar}`}
            initial={{ width: '0%' }}
            animate={{
              width: stage.status === 'passed' ? '100%' : stage.status === 'running' ? '60%' : stage.status === 'failed' ? '80%' : '0%',
            }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
          />
        </div>
        <span className="font-mono text-[11px] text-[#9A9A9A] shrink-0">
          {stage.metrics.duration}
        </span>
      </div>
    </motion.button>
  );
});

/* ------------------------------------------------------------------ */
/*  Metric card                                                       */
/* ------------------------------------------------------------------ */

const MetricCard = memo(function MetricCard({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-xl p-4 text-center">
      <div className="font-heading font-bold text-[28px] sm:text-[36px] lg:text-[40px] text-[#574a7d] leading-none">
        <CountUp end={value} duration={1.2} suffix={suffix} />
      </div>
      <div className="font-mono font-medium text-[11px] uppercase tracking-[0.08em] text-[#6B6B6B] mt-2">
        {label}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Finding item (separate component for useState)                    */
/* ------------------------------------------------------------------ */

const FindingItem = memo(function FindingItem({
  finding,
}: {
  finding: Stage['findings'][0];
}) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityColors[finding.severity];

  return (
    <div className="border border-[#D9D9D3] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-[#F7F7FB] transition-colors duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`font-mono font-medium text-[11px] uppercase tracking-wider px-3 py-[4px] rounded shrink-0 ${sev.bg} ${sev.text}`}>
            {finding.severity}
          </span>
          <span className="font-body text-[14px] text-[#333333] truncate">
            {finding.description}
          </span>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 ml-2"
        >
          <ChevronDown size={18} className="text-[#9A9A9A]" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <p className="font-body text-[14px] leading-[1.6] text-[#6B6B6B] pl-[88px]">
                {finding.detail}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Main Pipeline Visualization                                       */
/* ------------------------------------------------------------------ */

export default function PipelineViz() {
  const [selectedStage, setSelectedStage] = useState<Stage>(initialStages[0]);
  const [runningStageIndex, setRunningStageIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [localStages, setLocalStages] = useState<Stage[]>(initialStages.map((s) => ({ ...s })));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stagesRef = useRef(localStages);
  stagesRef.current = localStages;

  const passedCount = localStages.filter((s) => s.status === 'passed').length;
  const progressPercent = (passedCount / localStages.length) * 100;

  const runStage = useCallback((index: number) => {
    if (index >= stagesRef.current.length) {
      setIsPlaying(false);
      setRunningStageIndex(-1);
      return;
    }

    setRunningStageIndex(index);
    setSelectedStage(stagesRef.current[index]);

    setLocalStages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], status: 'running' };
      return next;
    });

    const delay = 2000 / stagesRef.current[index].id; // varying speed per stage
    timeoutRef.current = setTimeout(() => {
      setLocalStages((prev) => {
        const next = [...prev];
        const finalStatus = index === 6 ? 'failed' : 'passed';
        next[index] = { ...next[index], status: finalStatus };
        return next;
      });

      timeoutRef.current = setTimeout(() => {
        runStage(index + 1);
      }, 400);
    }, delay);
  }, []);

  const handlePlay = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    const currentStages = stagesRef.current;
    const firstPending = currentStages.findIndex((s) => s.status === 'pending');
    const startIndex = firstPending === -1 ? 0 : firstPending;

    if (startIndex === 0) {
      setLocalStages(initialStages.map((s) => ({ ...s })));
    } else {
      setLocalStages((prev) =>
        prev.map((s, i) => (i >= startIndex ? { ...s, status: 'pending' as StageStatus } : s))
      );
    }

    setTimeout(() => runStage(startIndex), 150);
  }, [isPlaying, runStage]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLocalStages((prev) =>
      prev.map((s, i) => (i === runningStageIndex && s.status === 'running' ? { ...s, status: 'pending' as StageStatus } : s))
    );
    setRunningStageIndex(-1);
  }, [runningStageIndex]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRunningStageIndex(-1);
    const reset = initialStages.map((s) => ({ ...s }));
    setLocalStages(reset);
    setSelectedStage(reset[0]);
  }, []);

  // Sync selected stage
  useEffect(() => {
    const updated = localStages.find((s) => s.id === selectedStage.id);
    if (updated) {
      setSelectedStage(updated);
    }
  }, [localStages]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const currentStageIndex = localStages.findIndex((s) => s.id === selectedStage.id) + 1;

  return (
    <section
      id="pipeline-viz"
      className="relative bg-[#F7F7FB] py-20 lg:py-24 px-6 sm:px-12 lg:px-16"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(163,201,165,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(163,201,165,0.15) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.span
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="font-mono font-medium text-[13px] uppercase tracking-[0.08em] text-[#574a7d] mb-4 block"
        >
          // INTERACTIVE PIPELINE
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-heading font-semibold text-[36px] sm:text-[42px] lg:text-[52px] leading-[1.1] tracking-[-0.025em] text-[#333333] mb-4"
        >
          21 dimensions. <span className="text-[#574a7d]">One pipeline.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-body text-[18px] leading-[1.65] text-[#6B6B6B] max-w-[640px] mb-12"
        >
          Watch tests flow through every stage. Click any stage to inspect live logs, metrics, and findings in real-time.
        </motion.p>

        {/* Control Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-white border border-[#D9D9D3] rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <span className="font-mono text-[12px] uppercase tracking-wider text-[#6B6B6B] shrink-0">
              Progress
            </span>
            <div className="w-full sm:w-[160px] h-[4px] bg-[#ECEBF5] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#574a7d] rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
              />
            </div>
            <span className="font-mono text-[12px] text-[#574a7d] shrink-0">
              {Math.round(progressPercent)}%
            </span>
          </div>

          <div className="font-mono text-[13px] text-[#6B6B6B]">
            Stage {currentStageIndex} of {localStages.length} — {selectedStage.name}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePlay}
              disabled={isPlaying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#574a7d] text-white font-body font-medium text-[14px] hover:bg-[#4a3d6b] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Play size={14} />
              Run All
            </button>
            <button
              onClick={handlePause}
              disabled={!isPlaying}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-[14px] hover:bg-[#F7F7FB] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Pause size={14} />
              Pause
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#D9D9D3] text-[#333333] font-body font-medium text-[14px] hover:bg-[#F7F7FB] transition-all duration-200"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <div className="flex items-center border border-[#D9D9D3] rounded-lg overflow-hidden ml-1">
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-3 py-2 font-mono text-[12px] transition-colors duration-200 ${
                    speed === s ? 'bg-[#574a7d] text-white' : 'text-[#6B6B6B] hover:bg-[#F7F7FB]'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Two-pane layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left pane */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full lg:w-[380px] shrink-0 bg-white border border-[#D9D9D3] rounded-xl overflow-hidden max-h-[720px] overflow-y-auto"
          >
            {localStages.map((stage) => (
              <StageListItem
                key={stage.id}
                stage={stage}
                isSelected={selectedStage.id === stage.id}
                onClick={() => setSelectedStage(stage)}
              />
            ))}
          </motion.div>

          {/* Right pane */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedStage.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Stage header */}
                <div className="bg-white border border-[#D9D9D3] rounded-xl p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div>
                      <div className="font-mono text-[48px] font-normal text-[#574a7d] leading-none mb-2">
                        {selectedStage.number}
                      </div>
                      <h3 className="font-heading font-medium text-[28px] sm:text-[36px] lg:text-[42px] leading-[1.15] tracking-[-0.02em] text-[#333333]">
                        {selectedStage.name}
                      </h3>
                    </div>
                    <StatusBadge status={selectedStage.status} size="lg" />
                  </div>
                  <p className="font-body text-[16px] leading-[1.6] text-[#6B6B6B] max-w-[600px]">
                    {selectedStage.subtitle}. {selectedStage.description}
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="Tests Run" value={selectedStage.metrics.testsRun} />
                  <MetricCard label="Failures" value={selectedStage.metrics.failures} />
                  <MetricCard label="Coverage" value={selectedStage.metrics.coverage} suffix="%" />
                  <div className="bg-white border border-[#D9D9D3] rounded-xl p-4 text-center flex flex-col items-center justify-center">
                    <div className="font-heading font-bold text-[28px] sm:text-[36px] lg:text-[40px] text-[#574a7d] leading-none">
                      {selectedStage.metrics.duration}
                    </div>
                    <div className="font-mono font-medium text-[11px] uppercase tracking-[0.08em] text-[#6B6B6B] mt-2">
                      Duration
                    </div>
                  </div>
                </div>

                {/* Live logs */}
                <LiveLogs
                  stage={selectedStage}
                  isRunning={runningStageIndex === selectedStage.id - 1 && isPlaying}
                />

                {/* Findings */}
                {selectedStage.findings.length > 0 && (
                  <div className="bg-white border border-[#D9D9D3] rounded-xl p-6">
                    <h4 className="font-heading font-medium text-[18px] text-[#333333] mb-4">
                      Findings
                    </h4>
                    <div className="space-y-3">
                      {selectedStage.findings.map((finding, i) => (
                        <FindingItem key={i} finding={finding} />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
