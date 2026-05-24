import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, AlertTriangle, ChevronDown,
  SkipForward, Play, Pause
} from 'lucide-react';
import { SEED_TEST_RESULTS, SEED_REPO } from '@/data/seedData';
import type { TestResult, LogEntry, Finding } from '@/data/seedData';

const STATUS_CONFIG = {
  passed: { color: '#5A8F5E', bg: 'bg-[#5A8F5E]', border: 'border-l-[#5A8F5E]', label: 'PASS', icon: Check },
  failed: { color: '#D4524A', bg: 'bg-[#D4524A]', border: 'border-l-[#D4524A]', label: 'FAIL', icon: X },
  warning: { color: '#E8A838', bg: 'bg-[#E8A838]', border: 'border-l-[#E8A838]', label: 'WARN', icon: AlertTriangle },
};

const LOG_COLORS: Record<string, string> = {
  info: 'text-[#9A9A9A]',
  pass: 'text-[#7AAF7E]',
  fail: 'text-[#D4524A]',
  warn: 'text-[#E8A838]',
};

const SEVERITY_CONFIG = {
  critical: { color: '#D4524A', bg: 'bg-[rgba(212,82,74,0.1)]', text: 'text-[#D4524A]' },
  high: { color: '#E87D3A', bg: 'bg-[rgba(232,125,58,0.1)]', text: 'text-[#E87D3A]' },
  medium: { color: '#E8A838', bg: 'bg-[rgba(232,168,56,0.1)]', text: 'text-[#E8A838]' },
  low: { color: '#5A8F5E', bg: 'bg-[rgba(90,143,94,0.1)]', text: 'text-[#5A8F5E]' },
};

type SimStage = {
  result: TestResult;
  status: 'pending' | 'running' | 'completed';
  progress: number;
  visibleLogs: number;
  expanded: boolean;
};

interface ExecuteStepProps {
  onComplete: () => void;
}

const SPEED_MULTIPLIERS: Record<string, number> = {
  '1x': 1,
  '2x': 2,
  '4x': 4,
};

export default function ExecuteStep({ onComplete }: ExecuteStepProps) {
  const [stages, setStages] = useState<SimStage[]>(
    SEED_TEST_RESULTS.map((r) => ({
      result: r,
      status: 'pending' as const,
      progress: 0,
      visibleLogs: 0,
      expanded: false,
    }))
  );
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<'1x' | '2x' | '4x'>('1x');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const stageListRef = useRef<HTMLDivElement>(null);
  const intervalRefs = useRef<ReturnType<typeof setInterval>[]>([]);

  const speedMult = SPEED_MULTIPLIERS[speed];

  // Add a terminal line
  const addTerminalLine = useCallback((line: string) => {
    setTerminalLines((prev) => [...prev, line]);
  }, []);

  // Scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Scroll active stage into view
  useEffect(() => {
    if (stageListRef.current && currentStageIndex >= 0) {
      const el = stageListRef.current.children[currentStageIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentStageIndex]);

  // Elapsed timer
  useEffect(() => {
    if (!isRunning || isPaused) return;
    const timer = setInterval(() => {
      setElapsedTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, isPaused]);

  // Run the simulation
  useEffect(() => {
    if (!isRunning || isPaused) return;

    if (currentStageIndex < 0) {
      setCurrentStageIndex(0);
      return;
    }

    if (currentStageIndex >= stages.length) {
      setIsRunning(false);
      setTimeout(() => onComplete(), 1500);
      return;
    }

    const stage = stages[currentStageIndex];
    if (!stage || stage.status === 'completed') return;

    // Start running this stage
    setStages((prev) => {
      const next = [...prev];
      next[currentStageIndex] = { ...next[currentStageIndex], status: 'running', expanded: true };
      return next;
    });

    // Add stage start to terminal
    addTerminalLine(`\n─── ${stage.result.stage} ───`);

    const result = stage.result;
    const logs = result.logs;
    const duration = result.duration;
    const logIntervalMs = Math.max(80, (duration / (logs.length || 1)) / speedMult);

    let logIndex = 0;
    const logTimer = setInterval(() => {
      if (logIndex < logs.length) {
        const log = logs[logIndex];
        const line = `[${log.level.toUpperCase()}] ${log.time} ${log.message}`;
        addTerminalLine(line);
        setStages((prev) => {
          const next = [...prev];
          next[currentStageIndex] = { ...next[currentStageIndex], visibleLogs: logIndex + 1 };
          return next;
        });
        logIndex++;
      } else {
        clearInterval(logTimer);
      }
    }, logIntervalMs);
    intervalRefs.current.push(logTimer);

    // Progress animation
    const progressInterval = setInterval(() => {
      setStages((prev) => {
        const s = prev[currentStageIndex];
        if (!s || s.status === 'completed') return prev;
        const newProgress = Math.min(100, s.progress + (2 * speedMult));
        const next = [...prev];
        next[currentStageIndex] = { ...s, progress: newProgress };
        return next;
      });
    }, 50);
    intervalRefs.current.push(progressInterval);

    // Complete the stage after duration
    const completeTimer = setTimeout(
      () => {
        clearInterval(progressInterval);
        const finalStatus = result.status;
        setStages((prev) => {
          const next = [...prev];
          next[currentStageIndex] = {
            ...next[currentStageIndex],
            status: 'completed',
            progress: 100,
            visibleLogs: logs.length,
          };
          return next;
        });
        addTerminalLine(`[${finalStatus === 'passed' ? 'PASS' : finalStatus === 'failed' ? 'FAIL' : 'WARN'}] ${stage.result.stage} — ${finalStatus.toUpperCase()}`);

        // Update overall progress
        setOverallProgress(((currentStageIndex + 1) / stages.length) * 100);

        // Move to next stage
        setTimeout(() => {
          setCurrentStageIndex((i) => i + 1);
        }, 300);
      },
      Math.max(800, duration / speedMult)
    );
    intervalRefs.current.push(completeTimer as unknown as ReturnType<typeof setInterval>);

    return () => {
      intervalRefs.current.forEach(clearInterval);
      intervalRefs.current = [];
    };
  }, [currentStageIndex, isRunning, isPaused, speedMult, stages.length, addTerminalLine, onComplete]);

  // Auto-start on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsRunning(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(clearInterval);
    };
  }, []);

  const toggleExpand = (index: number) => {
    setStages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], expanded: !next[index].expanded };
      return next;
    });
  };

  const skipToEnd = () => {
    setSpeed('4x');
    // Mark all as completed
    setStages((prev) =>
      prev.map((s) => ({
        ...s,
        status: 'completed' as const,
        progress: 100,
        visibleLogs: s.result.logs.length,
      }))
    );
    setCurrentStageIndex(stages.length);
    setOverallProgress(100);
    setIsRunning(false);
    // Add all terminal lines
    SEED_TEST_RESULTS.forEach((result) => {
      result.logs.forEach((log) => {
        setTerminalLines((prev) => [...prev, `[${log.level.toUpperCase()}] ${log.time} ${log.message}`]);
      });
    });
    setTimeout(() => onComplete(), 800);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const currentStage = currentStageIndex >= 0 && currentStageIndex < stages.length ? stages[currentStageIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="font-heading text-[28px] font-medium text-[#1A1A1A] tracking-[-0.01em]">
          Executing Test Suite
        </h2>
        <p className="text-[14px] text-[#6B6B6B] font-mono mt-1">
          {SEED_REPO.owner}/{SEED_REPO.name} &bull; main branch
        </p>
      </div>

      {/* Top bar: progress, timer, controls */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] text-[#6B6B6B]">
            Elapsed: {formatTime(elapsedTime)}
          </span>
          <motion.span
            key={completedCount}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className="font-mono text-[13px] text-[#5A8F5E] font-medium"
          >
            {completedCount}/{stages.length} stages
          </motion.span>
        </div>
        <div className="flex items-center gap-2">
          {/* Speed toggle */}
          <div className="flex bg-[#F5F5F0] rounded-lg p-0.5">
            {(['1x', '2x', '4x'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1 rounded-md font-mono text-[12px] font-medium transition-all ${
                  speed === s ? 'bg-[#5A8F5E] text-white' : 'text-[#6B6B6B] hover:text-[#333333]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-2 rounded-lg border border-[#D9D9D3] hover:bg-[#F5F5F0] transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            onClick={skipToEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9D9D3] text-[#6B6B6B] hover:bg-[#F5F5F0] font-mono text-[12px] transition-colors"
          >
            <SkipForward size={12} />
            Skip
          </button>
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="h-2 bg-[#EBEBE5] rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-[#5A8F5E] rounded-full"
          style={{ width: `${overallProgress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left panel: Stage cards */}
        <div
          ref={stageListRef}
          className="lg:w-[40%] space-y-2 max-h-[500px] overflow-y-auto pr-1"
        >
          {stages.map((stage, index) => {
            const config = STATUS_CONFIG[stage.result.status as keyof typeof STATUS_CONFIG];
            const isRunning = stage.status === 'running';
            const isActive = currentStageIndex === index;
            const StatusIcon = config.icon;

            return (
              <motion.div
                key={stage.result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`
                  bg-white border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer
                  ${isActive && stage.status === 'running' ? 'border-[#E8A838] shadow-[0_0_0_3px_rgba(232,168,56,0.1)]' : 'border-[#D9D9D3]'}
                  ${stage.status === 'completed' ? `${config.border} border-l-[3px]` : ''}
                  ${isActive && stage.status === 'running' ? 'border-l-[3px] border-l-[#E8A838]' : ''}
                `}
                onClick={() => toggleExpand(index)}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 p-4">
                  {/* Status dot */}
                  <div className="flex-shrink-0">
                    {stage.status === 'pending' && (
                      <div className="w-3 h-3 rounded-full bg-[#D9D9D3]" />
                    )}
                    {isRunning && (
                      <motion.div
                        className="w-3 h-3 rounded-full bg-[#E8A838]"
                        animate={{ boxShadow: ['0 0 0 0 rgba(232,168,56,0.4)', '0 0 0 8px rgba(232,168,56,0)'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                    {stage.status === 'completed' && (
                      <div className={`w-3 h-3 rounded-full ${config.bg}`}>
                        <StatusIcon size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  {/* Stage name */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[#333333]">{stage.result.stage}</div>
                    <div className="text-[13px] text-[#6B6B6B]">
                      {isRunning ? 'Running...' : stage.status === 'completed' ? config.label : 'Pending'}
                    </div>
                  </div>

                  {/* Mini progress */}
                  <div className="w-[80px] flex-shrink-0 hidden sm:block">
                    <div className="h-1 bg-[#EBEBE5] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${stage.progress}%`,
                          backgroundColor: isRunning ? '#E8A838' : config.color,
                        }}
                      />
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <motion.div
                    animate={{ rotate: stage.expanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={16} className="text-[#9A9A9A]" />
                  </motion.div>
                </div>

                {/* Expanded mini terminal */}
                <AnimatePresence>
                  {stage.expanded && stage.visibleLogs > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-[#1A1A1A] rounded-b-xl p-3 font-mono text-[11px] leading-[1.7] max-h-[140px] overflow-y-auto">
                        {stage.result.logs.slice(0, stage.visibleLogs).map((log: LogEntry, i: number) => (
                          <div key={i} className={LOG_COLORS[log.level as keyof typeof LOG_COLORS]}>
                            [{log.level.toUpperCase()}] {log.message}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Right panel: Terminal + active stage detail */}
        <div className="lg:w-[60%] space-y-4">
          {/* Active stage detail */}
          {currentStage && (
            <motion.div
              key={currentStage.result.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#D9D9D3] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-mono text-[11px] uppercase text-[#9A9A9A]">
                    Currently Running
                  </span>
                  <h3 className="text-[16px] font-medium text-[#1A1A1A]">
                    {currentStage.result.stage}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {currentStage.status === 'running' && (
                    <span className="px-3 py-1 rounded-full bg-[rgba(232,168,56,0.1)] text-[#E8A838] font-mono text-[11px] uppercase font-medium animate-pulse">
                      Running
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics for the current stage */}
              <div className="grid grid-cols-3 gap-3">
                {currentStage.result.endpoints !== undefined && (
                  <MetricCard label="Endpoints" value={String(currentStage.result.endpoints)} />
                )}
                {currentStage.result.middleware !== undefined && (
                  <MetricCard label="Middleware" value={String(currentStage.result.middleware)} />
                )}
                {currentStage.result.testsRun !== undefined && (
                  <MetricCard label="Tests" value={`${currentStage.result.passed}/${currentStage.result.testsRun}`} />
                )}
                {currentStage.result.vulnerabilities !== undefined && (
                  <MetricCard label="Vulns" value={String(currentStage.result.vulnerabilities)} />
                )}
                {currentStage.result.critical !== undefined && (
                  <MetricCard label="Critical" value={String(currentStage.result.critical)} color="#D4524A" />
                )}
                {currentStage.result.riskScore !== undefined && (
                  <MetricCard label="Risk Score" value={String(currentStage.result.riskScore)} color="#E8A838" />
                )}
                {currentStage.result.flowsTested !== undefined && (
                  <MetricCard label="Flows" value={String(currentStage.result.flowsTested)} />
                )}
                {currentStage.result.mutationScore !== undefined && (
                  <MetricCard label="Mutation %" value={`${currentStage.result.mutationScore}%`} color="#D4524A" />
                )}
                {currentStage.result.rps !== undefined && (
                  <MetricCard label="RPS" value={String(currentStage.result.rps)} />
                )}
              </div>
            </motion.div>
          )}

          {/* Live Terminal */}
          <div className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3A3A3A]">
              <span className="font-mono text-[11px] uppercase text-[#9A9A9A] tracking-wider">
                Live Logs
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D4524A]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E8A838]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#5A8F5E]" />
              </div>
            </div>
            <div
              ref={terminalRef}
              className="p-4 font-mono text-[12px] leading-[1.8] h-[280px] overflow-y-auto"
            >
              {terminalLines.length === 0 ? (
                <div className="text-[#6B6B6B] italic">Waiting to start...</div>
              ) : (
                terminalLines.map((line, i) => {
                  const levelMatch = line.match(/\[(INFO|PASS|FAIL|WARN)\]/);
                  const level = levelMatch ? levelMatch[1].toLowerCase() : 'info';
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.05 }}
                      className={LOG_COLORS[level] || 'text-[#9A9A9A]'}
                    >
                      {line}
                    </motion.div>
                  );
                })
              )}
              {isRunning && !isPaused && (
                <motion.span
                  className="inline-block w-2 h-4 bg-[#5A8F5E] ml-1"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
            </div>
          </div>

          {/* Findings panel */}
          {currentStage && currentStage.result.findings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#D9D9D3] rounded-xl p-4"
            >
              <h4 className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium mb-3">
                Findings ({currentStage.result.findings.length})
              </h4>
              <div className="space-y-2">
                {currentStage.result.findings.map((finding: Finding, i: number) => {
                  const sev = SEVERITY_CONFIG[finding.severity as keyof typeof SEVERITY_CONFIG];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-[#F5F5F0] border border-[#D9D9D3] cursor-pointer hover:border-[#A3C9A5] transition-colors"
                      onClick={() => setActiveFinding(activeFinding === finding ? null : finding)}
                    >
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-medium flex-shrink-0 ${sev.bg} ${sev.text}`}>
                        {finding.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#333333] font-medium">{finding.message}</div>
                        {finding.file && (
                          <div className="text-[11px] text-[#9A9A9A] font-mono mt-0.5">
                            {finding.file}{finding.line ? `:${finding.line}` : ''}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ label, value, color = '#5A8F5E' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#F5F5F0] rounded-lg p-3 text-center">
      <div className="font-heading text-[20px] font-bold" style={{ color }}>
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#6B6B6B] mt-0.5">
        {label}
      </div>
    </div>
  );
}


