import { useState, useEffect, useRef, memo } from 'react';
import type { Stage } from './stagesData';

const logColors: Record<string, string> = {
  INFO: '#9A9A9A',
  PASS: '#574a7d',
  FAIL: '#D4524A',
  WARN: '#E8A838',
};

interface LiveLogsProps {
  stage: Stage;
  isRunning: boolean;
}

const LiveLogs = memo(function LiveLogs({ stage, isRunning }: LiveLogsProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset when stage changes
  useEffect(() => {
    setDisplayedLines([]);
    setCurrentLineIndex(0);
  }, [stage.id]);

  // Typing animation
  useEffect(() => {
    if (!isRunning || currentLineIndex >= stage.logs.length) return;

    const timer = setTimeout(() => {
      setDisplayedLines((prev) => [...prev, stage.logs[currentLineIndex]]);
      setCurrentLineIndex((prev) => prev + 1);
    }, 80);

    return () => clearTimeout(timer);
  }, [isRunning, currentLineIndex, stage.logs, stage.id]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLines]);

  const getLineColor = (line: string): string => {
    if (line.includes('[PASS]')) return logColors.PASS;
    if (line.includes('[FAIL]')) return logColors.FAIL;
    if (line.includes('[WARN]')) return logColors.WARN;
    return logColors.INFO;
  };

  const linesToShow = displayedLines.length > 0 ? displayedLines : stage.logs.slice(0, 1);

  return (
    <div className="bg-[#12101A] rounded-lg p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full bg-[#D4524A]" />
        <div className="w-3 h-3 rounded-full bg-[#E8A838]" />
        <div className="w-3 h-3 rounded-full bg-[#574a7d]" />
        <span className="font-mono text-[11px] text-[#9A9A9A] uppercase tracking-wider ml-2">
          {stage.name} — Live Output
        </span>
      </div>

      {/* Log lines */}
      <div
        ref={scrollRef}
        className="font-mono text-[13px] leading-[1.7] overflow-y-auto max-h-[280px] scrollbar-thin"
      >
        {linesToShow.map((line, i) => (
          <div key={`${stage.id}-${i}`} className="flex gap-3">
            <span className="text-[#6B6B6B] select-none shrink-0 w-[28px] text-right">
              {(i + 1).toString().padStart(2, '0')}
            </span>
            <span style={{ color: getLineColor(line) }} className="break-all">
              {line}
            </span>
          </div>
        ))}
        {isRunning && currentLineIndex < stage.logs.length && (
          <div className="flex gap-3 animate-pulse">
            <span className="text-[#6B6B6B] select-none shrink-0 w-[28px] text-right">
              {(linesToShow.length + 1).toString().padStart(2, '0')}
            </span>
            <span className="text-[#9A9A9A]">_</span>
          </div>
        )}
        {!isRunning && displayedLines.length === 0 && (
          <div className="flex gap-3">
            <span className="text-[#6B6B6B] select-none shrink-0 w-[28px] text-right">01</span>
            <span className="text-[#9A9A9A]">Waiting to start...</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default LiveLogs;
