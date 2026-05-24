import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Play, Check, Server, Database, Key, CreditCard, FileCode, Globe, ChevronDown } from 'lucide-react';
import { SEED_REPO } from '@/data/seedData';

const CLONE_LINES = [
  { text: '$ git clone https://github.com/testforge-demo/express-ecommerce-api', color: 'text-white' },
  { text: "Cloning into 'express-ecommerce-api'...", color: 'text-[#9A9A9A]' },
  { text: 'remote: Enumerating objects: 1,247, done.', color: 'text-[#9A9A9A]' },
  { text: 'remote: Counting objects: 100% (1,247/1,247), done.', color: 'text-[#9A9A9A]' },
  { text: 'remote: Compressing objects: 100% (892/892), done.', color: 'text-[#9A9A9A]' },
  { text: 'Receiving objects: 100% (1,247/1,247), 2.4 MiB | 1.2 MiB/s, done.', color: 'text-[#9A9A9A]' },
  { text: 'Resolving deltas: 100% (412/412), done.', color: 'text-[#9A9A9A]' },
  { text: '', color: 'text-[#9A9A9A]' },
  { text: '$ cd express-ecommerce-api && npm install', color: 'text-white' },
  { text: 'added 147 packages in 2.3s', color: 'text-[#C9B5FF]' },
  { text: '', color: 'text-[#9A9A9A]' },
  { text: '$ testforge scan --detect', color: 'text-white' },
  { text: '[INFO] Detected: Node.js + Express.js application', color: 'text-[#9A9A9A]' },
  { text: '[INFO] Found 47 API endpoints across 6 route files', color: 'text-[#9A9A9A]' },
  { text: '[INFO] Found 12 middleware functions', color: 'text-[#9A9A9A]' },
  { text: '[INFO] Database: MongoDB (mongoose schemas detected)', color: 'text-[#9A9A9A]' },
  { text: '[INFO] Auth: JWT token-based authentication', color: 'text-[#9A9A9A]' },
  { text: '[SUCCESS] Repository connected and analyzed ✓', color: 'text-[#B48FFF]' },
];

const TECH_STACK = [
  { name: 'Node.js', icon: Globe },
  { name: 'Express', icon: Server },
  { name: 'TypeScript', icon: FileCode },
  { name: 'MongoDB', icon: Database },
  { name: 'JWT', icon: Key },
  { name: 'Stripe', icon: CreditCard },
];

const FILE_TREE = [
  'express-ecommerce-api/',
  '  src/',
  '    routes/     (7 files)',
  '    middleware/ (2 files)',
  '    models/     (2 files)',
  '    utils/      (1 file)',
  '  package.json',
  '  tsconfig.json',
];

interface ConnectStepProps {
  onComplete: () => void;
}

export default function ConnectStep({ onComplete }: ConnectStepProps) {
  const [repoUrl, setRepoUrl] = useState(SEED_REPO.url);
  const [branch, setBranch] = useState('main');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [cloneComplete, setCloneComplete] = useState(false);
  const [showFileTree, setShowFileTree] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Simulate clone progress
  useEffect(() => {
    if (!isCloning) return;

    const progressSteps = [0, 25, 60, 85, 100];
    let step = 0;
    const interval = setInterval(() => {
      if (step < progressSteps.length) {
        setCloneProgress(progressSteps[step]);
        step++;
      }
      if (step >= progressSteps.length) {
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isCloning]);

  // Terminal typing animation
  useEffect(() => {
    if (!showTerminal) return;

    let line = 0;
    const interval = setInterval(() => {
      if (line < CLONE_LINES.length) {
        setVisibleLines(line + 1);
        line++;
        // Auto-scroll terminal
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setCloneComplete(true);
          setShowFileTree(true);
        }, 600);
      }
    }, 180);

    return () => clearInterval(interval);
  }, [showTerminal]);

  // Auto-advance after clone complete
  useEffect(() => {
    if (cloneComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cloneComplete, onComplete]);

  const handleConnect = useCallback(() => {
    if (!repoUrl.trim()) return;
    setIsCloning(true);
    setShowTerminal(true);
  }, [repoUrl]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
    >
      {/* Hero Headline */}
      <div className="text-center mb-8">
        <h2 className="font-heading text-[28px] font-medium text-[#1A1A1A] tracking-[-0.01em]">
          Connect Your Repository
        </h2>
        <p className="text-[16px] text-[#6B6B6B] font-body mt-3 max-w-[480px] mx-auto">
          Enter a public Git repository URL. We'll clone it, analyze the codebase, and detect your technology stack automatically.
        </p>
      </div>

      {/* Repo URL Input */}
      <div className="max-w-[600px] mx-auto space-y-5">
        <div>
          <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-2">
            Repository URL
          </label>
          <div className="relative">
            <GitBranch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#C1A3FF]" />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isCloning}
              className="w-full h-12 pl-11 pr-4 bg-[#F5F5F0] border border-[#D9D9D3] rounded-lg font-mono text-[14px] text-[#1A1A1A] focus:outline-none focus:border-[#C1A3FF] focus:ring-[3px] focus:ring-[rgba(90,143,94,0.1)] transition-all disabled:opacity-60"
            />
          </div>
        </div>

        {/* Branch Selector */}
        <div>
          <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-2">
            Branch
          </label>
          <div className="relative">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={isCloning}
              className="w-full h-12 pl-4 pr-10 bg-[#F5F5F0] border border-[#D9D9D3] rounded-lg font-mono text-[13px] text-[#1A1A1A] focus:outline-none focus:border-[#C1A3FF] focus:ring-[3px] focus:ring-[rgba(90,143,94,0.1)] transition-all appearance-none disabled:opacity-60"
            >
              {SEED_REPO.branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
          </div>
        </div>

        {/* Auto-detected stack */}
        <div>
          <label className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#C1A3FF] font-medium block mb-3">
            Auto-Detected Stack
          </label>
          <div className="flex flex-wrap gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech.name}
                className="inline-flex items-center gap-1.5 bg-[#F0EAFF] border border-[#C9B5FF] rounded-md px-3.5 py-2 font-mono text-[12px] text-[#C1A3FF] font-medium"
              >
                <tech.icon size={14} className="text-[#C1A3FF]" />
                {tech.name}
              </span>
            ))}
          </div>
        </div>

        {/* Connect Button */}
        <button
          onClick={handleConnect}
          disabled={isCloning || !repoUrl.trim()}
          className="w-full h-[52px] bg-[#C1A3FF] text-white rounded-lg font-body font-medium text-[16px] flex items-center justify-center gap-2 hover:bg-[#A07BDD] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isCloning ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Cloning repository...
            </>
          ) : (
            <>
              <Play size={16} />
              Connect Repository
            </>
          )}
        </button>

        {/* Clone Progress */}
        <AnimatePresence>
          {isCloning && !showTerminal && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="h-2 bg-[#EBEBE5] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#C1A3FF] rounded-full"
                  style={{ width: `${cloneProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-center text-[13px] text-[#6B6B6B] font-mono mt-2">{cloneProgress}%</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal Output */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-[600px] mx-auto mt-6"
          >
            <div
              ref={terminalRef}
              className="bg-[#1A1A1A] rounded-xl p-5 font-mono text-[13px] leading-[1.8] h-[220px] overflow-y-auto"
            >
              {CLONE_LINES.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1 }}
                  className={line.color}
                >
                  {line.text || ' '}
                </motion.div>
              ))}
              {visibleLines < CLONE_LINES.length && (
                <motion.span
                  className="inline-block w-2 h-4 bg-[#C1A3FF] ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </div>

            {/* File Tree */}
            <AnimatePresence>
              {showFileTree && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                  className="mt-4 bg-white border border-[#D9D9D3] rounded-xl p-5"
                >
                  <div className="font-mono text-[13px] text-[#333333] leading-[1.8]">
                    {FILE_TREE.map((line, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={line.includes('(') ? 'text-[#6B6B6B]' : line.includes('/') ? 'text-[#1A1A1A] font-medium' : ''}
                      >
                        {line}
                      </motion.div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#D9D9D3]">
                    <div className="text-center">
                      <div className="font-heading text-[24px] font-bold text-[#C1A3FF]">47</div>
                      <div className="font-mono text-[11px] uppercase text-[#6B6B6B] tracking-[0.06em]">Endpoints</div>
                    </div>
                    <div className="text-center">
                      <div className="font-heading text-[24px] font-bold text-[#C1A3FF]">12</div>
                      <div className="font-mono text-[11px] uppercase text-[#6B6B6B] tracking-[0.06em]">Middleware</div>
                    </div>
                    <div className="text-center">
                      <div className="font-heading text-[24px] font-bold text-[#C1A3FF]">34</div>
                      <div className="font-mono text-[11px] uppercase text-[#6B6B6B] tracking-[0.06em]">Dependencies</div>
                    </div>
                  </div>

                  {/* Success + Continue */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-4 flex items-center justify-center gap-2 text-[#C1A3FF]"
                  >
                    <Check size={16} strokeWidth={3} />
                    <span className="font-mono text-[13px] font-medium">Repository connected successfully</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
