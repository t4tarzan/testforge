import { useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Play, Loader2, AlertCircle } from 'lucide-react';

// Defaults to the managed cloud MCP. Override at build time with VITE_MCP_URL
// (e.g. '' for same-origin when self-hosting the web app in front of a local
// mcp-server). Production/Vercel builds leave it unset → cloud default unchanged.
const MCP_URL = import.meta.env.VITE_MCP_URL ?? 'https://mcp.testforge.run';

interface ConnectStepProps {
  // Receives the analyzer's full result object — dynamic shape, see ReportStep.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onComplete: (results: any) => void;
}

export default function ConnectStep({ onComplete }: ConnectStepProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');

  const handleConnect = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError('');
    setProgress('Cloning repository...');

    try {
      const res = await fetch(`${MCP_URL}/clone-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: repoUrl.trim(), branch }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      setProgress('Analysis complete!');
      setTimeout(() => onComplete(data), 500);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to analyze repository');
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="text-center mb-8">
        <h2 className="font-heading text-[28px] font-medium text-[#12101A] tracking-[-0.01em]">
          Connect Your Repository
        </h2>
        <p className="text-[16px] text-[#6B6B6B] font-body mt-3 max-w-[480px] mx-auto">
          Enter any public Git repository URL. We'll clone, scan, and analyze it across multiple dimensions.
        </p>
      </div>

      <div className="max-w-[600px] mx-auto space-y-5">
        <div>
          <label htmlFor="connect-repo-url" className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-2">
            Repository URL
          </label>
          <div className="relative">
            <GitBranch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#574a7d]" />
            <input
              id="connect-repo-url"
              type="text"
              value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError(''); }}
              placeholder="https://github.com/owner/repo"
              disabled={loading}
              className="w-full h-12 pl-11 pr-4 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg font-mono text-[14px] text-[#12101A] focus:outline-none focus:border-[#574a7d] focus:ring-[3px] focus:ring-[rgba(90,143,94,0.1)] transition-all disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="connect-branch" className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#6B6B6B] font-medium block mb-2">Branch</label>
          <input
            id="connect-branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            disabled={loading}
            className="w-full h-12 px-4 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg font-mono text-[13px] text-[#12101A] focus:outline-none focus:border-[#574a7d] disabled:opacity-60"
          />
        </div>

        <button
          onClick={handleConnect}
          disabled={loading || !repoUrl.trim()}
          className="w-full h-[52px] bg-[#574a7d] text-white rounded-lg font-body font-medium text-[16px] flex items-center justify-center gap-2 hover:bg-[#4a3d6b] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {progress}
            </>
          ) : (
            <>
              <Play size={16} />
              Analyze Repository
            </>
          )}
        </button>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-3 p-4 bg-[#FFF0F0] border border-[#FFD0D0] rounded-lg"
          >
            <AlertCircle size={18} className="text-[#D4524A] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#D4524A]">Analysis Failed</p>
              <p className="text-sm text-[#6B6B6B] mt-1">{error}</p>
              <p className="text-xs text-[#9A9A9A] mt-2">Tip: Try a smaller repo or check the URL is correct and public.</p>
            </div>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#12101A] rounded-xl p-5 font-mono text-[13px] leading-[1.8] h-[180px] overflow-y-auto"
          >
            <div className="text-[#a39fd4]">$ testforge analyze {repoUrl}</div>
            <div className="text-[#9A9A9A]">Cloning into /tmp/testforge-repos...</div>
            <div className="text-[#9A9A9A]">Scanning codebase structure...</div>
            <div className="text-[#9A9A9A]">Running security analysis...</div>
            <div className="text-[#9A9A9A]">Running unit test analysis...</div>
            <div className="text-[#9A9A9A]">Running load analysis...</div>
            <div className="text-[#9A9A9A]">Running accessibility analysis...</div>
            <motion.span
              className="inline-block w-2 h-4 bg-[#574a7d] ml-0.5"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </motion.div>
        )}

        {/* Example repos */}
        {!loading && !repoUrl && (
          <div className="mt-4">
            <p className="font-mono text-[11px] uppercase text-[#9A9A9A] mb-3">Try these examples:</p>
            <div className="space-y-2">
              {[
                'https://github.com/tinyhttp/malibu',
                'https://github.com/expressjs/express',
              ].map((url) => (
                <button
                  key={url}
                  onClick={() => setRepoUrl(url)}
                  className="w-full text-left px-4 py-2.5 bg-[#F7F7FB] border border-[#D9D9D3] rounded-lg font-mono text-[13px] text-[#6B6B6B] hover:border-[#574a7d] hover:text-[#12101A] transition-all truncate"
                >
                  {url}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
