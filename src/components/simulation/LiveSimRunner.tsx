// Wraps a showcase SimulationReport with a "Run live" control: POSTs to the
// guarded /api/simulate proxy (allowlisted by slug, bearer injected server-side),
// polls the async job through its phases, and swaps the snapshot for the FRESH
// result when it finishes. Until then (or if a run fails) the curated snapshot
// stays visible.
import { useEffect, useRef, useState } from 'react';
import { Play, Loader2, RotateCw, AlertTriangle } from 'lucide-react';
import SimulationReport from './SimulationReport';
import type { SimulationShowcase, SimLoad, SimAgent, SimChaos } from '@/data/simulationShowcase';

// Shape of the /simulate result payload we read (a superset; only these fields
// are rendered).
interface LiveResult {
  runnable?: { method?: 'dockerfile' | 'compose' };
  simulatedAt?: string;
  load?: SimLoad;
  agent?: SimAgent;
  chaos?: SimChaos;
}

type Phase = 'idle' | 'running' | 'done' | 'error';

// Friendly labels for the upstream job phases.
const PHASE_LABEL: Record<string, string> = {
  queued: 'Queued…',
  cloning: 'Cloning the repo…',
  detecting: 'Detecting how to boot it…',
  building: 'Building & booting the app…',
  booting: 'Waiting for the app to come up…',
  load: 'Driving load…',
  agent: 'Scaling a fleet of agents…',
  chaos: 'Crashing it mid-load…',
  done: 'Done',
};

// Map the raw /simulate result onto the showcase shape SimulationReport renders.
function mapLive(snapshot: SimulationShowcase, result: LiveResult | undefined): SimulationShowcase {
  return {
    ...snapshot,
    method: result?.runnable?.method ?? snapshot.method,
    simulatedAt: result?.simulatedAt ?? snapshot.simulatedAt,
    load: result?.load ?? snapshot.load,
    agent: result?.agent ?? snapshot.agent,
    chaos: result?.chaos ?? snapshot.chaos,
  };
}

export default function LiveSimRunner({ sim }: { sim: SimulationShowcase }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [detail, setDetail] = useState('');
  const [live, setLive] = useState<SimulationShowcase | null>(null);
  const [error, setError] = useState('');
  const cancelled = useRef(false);

  useEffect(() => () => { cancelled.current = true; }, []);

  async function run() {
    setPhase('running'); setError(''); setDetail('Starting…');
    try {
      const startRes = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: sim.slug }),
      });
      const start = await startRes.json();
      if (!startRes.ok || !start.jobId) {
        setPhase('error');
        setError(start.error || `Couldn't start the run (HTTP ${startRes.status}).`);
        return;
      }
      // Poll the async job. Bounded so a stuck job can't spin forever.
      for (let i = 0; i < 80 && !cancelled.current; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelled.current) return;
        const jRes = await fetch(`/api/simulate?jobId=${encodeURIComponent(start.jobId)}`);
        const job = await jRes.json();
        if (!jRes.ok) { setPhase('error'); setError(job.error || 'Lost the run.'); return; }
        setDetail(PHASE_LABEL[job.phase] || job.detail || job.phase || '…');
        if (job.status === 'done') { setLive(mapLive(sim, job.result)); setPhase('done'); return; }
        if (job.status === 'error') { setPhase('error'); setError(job.error || 'The simulation failed.'); return; }
      }
      if (!cancelled.current) { setPhase('error'); setError('Timed out waiting for the run.'); }
    } catch (e) {
      setPhase('error');
      setError((e as Error).message || 'Network error.');
    }
  }

  return (
    <div>
      {/* control bar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="font-mono text-[11px] text-[#6B6B6B]">
          {phase === 'done' && <span className="inline-flex items-center gap-1.5 text-[#3A9D5B]">● fresh live result</span>}
          {phase === 'idle' && <span>showing a saved run — or run it live now</span>}
        </div>
        {phase === 'running' ? (
          <span className="inline-flex items-center gap-2 font-mono text-[12px] text-[#574a7d]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {detail}
          </span>
        ) : (
          <button
            onClick={run}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#574a7d] text-white font-mono text-[12px] hover:bg-[#473c68] transition-colors"
          >
            {phase === 'done' ? <RotateCw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {phase === 'done' ? 'Run again' : 'Run this live'}
          </button>
        )}
      </div>

      {phase === 'error' && (
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-[#FBEEEC] border border-[#E8C5C0]">
          <AlertTriangle className="w-4 h-4 text-[#D4524A] mt-0.5 shrink-0" />
          <p className="font-mono text-[11px] text-[#9A3B33]">{error} <span className="text-[#6B6B6B]">— showing the saved run below.</span></p>
        </div>
      )}

      <SimulationReport sim={live ?? sim} />
    </div>
  );
}
