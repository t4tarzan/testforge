// Renders ONE real simulation result (load ramp + agent fleet + chaos) as
// charts. Fed by curated showcase JSON (src/data/simulationShowcase) — the
// genuine /simulate payload. When a dimension didn't run for real (ranReal
// false), it shows an honest "couldn't auto-run" note instead of faking a chart.
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { SimulationShowcase } from '@/data/simulationShowcase';

const C = {
  ink: '#12101A', sub: '#6B6B6B', border: '#D9D9D3', bg: '#F7F7FB',
  primary: '#574a7d', p99: '#E87D3A', rps: '#4A90D9', danger: '#D4524A', ok: '#3A9D5B',
};

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-xl p-4">
      <p className="font-heading font-bold text-[24px] leading-none mb-1" style={{ color: accent ?? C.ink }}>{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#6B6B6B]">{label}</p>
    </div>
  );
}

function ChartFrame({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D9D9D3] rounded-xl p-5">
      <h4 className="font-heading font-bold text-[15px] text-[#12101A]">{title}</h4>
      <p className="font-mono text-[11px] text-[#6B6B6B] mb-4">{sub}</p>
      {children}
    </div>
  );
}

const tooltipStyle = { fontFamily: 'monospace', fontSize: 11, borderRadius: 8, border: `1px solid ${C.border}` };
const axis = { fontSize: 11, fontFamily: 'monospace', fill: C.sub };

function NotRun({ what }: { what: string }) {
  return (
    <div className="bg-[#F7F7FB] border border-dashed border-[#D9D9D3] rounded-xl p-5">
      <p className="font-mono text-[12px] text-[#6B6B6B]">
        <span className="font-bold text-[#9A6B3A]">Couldn't auto-run {what}.</span> This repo couldn't be booted
        in the sandbox, so no live {what} measurement was taken (static analysis only).
      </p>
    </div>
  );
}

export default function SimulationReport({ sim }: { sim: SimulationShowcase }) {
  const { load, agent, chaos } = sim;
  const faultPct = Math.round((chaos.errorRateDuringFault ?? 0) * 100);
  const basePct = Math.round((chaos.baselineErrorRate ?? 0) * 100);

  return (
    <section className="bg-white border border-[#D9D9D3] rounded-2xl p-6 md:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-heading font-bold text-[20px] text-[#12101A]">{sim.repoName}</h3>
            <span className="inline-flex px-2 py-0.5 rounded-[4px] font-mono text-[10px] uppercase tracking-wider bg-[#EEEAF7] text-[#574a7d]">{sim.method}</span>
            <span className="inline-flex px-2 py-0.5 rounded-[4px] font-mono text-[10px] uppercase tracking-wider bg-[#E6F4EC] text-[#3A9D5B]">● real run</span>
          </div>
          <p className="font-mono text-[12px] text-[#6B6B6B] max-w-2xl">{sim.tagline}</p>
        </div>
        <a href={sim.repoUrl} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#574a7d] underline">repo ↗</a>
      </div>

      {/* ── Load ── */}
      <div className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Peak throughput" value={`${Math.round(load.rps).toLocaleString()} rps`} accent={C.primary} />
          <Stat label="p99 @ max load" value={`${load.p99} ms`} accent={C.p99} />
          <Stat label="Breaking point"
            value={load.breakingPointConcurrency ? `${load.breakingPointConcurrency} conc.` : 'none ≤ max'}
            accent={load.breakingPointConcurrency ? C.danger : C.ok} />
          <Stat label="Error rate" value={`${(load.errorRate * 100).toFixed(1)}%`} accent={load.errorRate > 0.05 ? C.danger : C.ok} />
        </div>
        {load.ranReal ? (
          <ChartFrame title="Load ramp — latency & throughput vs concurrency"
            sub={`autocannon against :${load.targetPort}${load.path}, ramping concurrent connections`}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={load.levels} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5FF" />
                <XAxis dataKey="concurrency" tick={axis} label={{ value: 'concurrency', position: 'insideBottom', offset: -2, fontSize: 10, fill: C.sub }} />
                <YAxis yAxisId="lat" tick={axis} label={{ value: 'latency (ms)', angle: -90, position: 'insideLeft', fontSize: 10, fill: C.sub }} />
                <YAxis yAxisId="rps" orientation="right" tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Line yAxisId="lat" type="monotone" dataKey="latencyP50" name="p50 ms" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="lat" type="monotone" dataKey="latencyP99" name="p99 ms" stroke={C.p99} strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="rps" type="monotone" dataKey="rps" name="req/s" stroke={C.rps} strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : <NotRun what="load test" />}
      </div>

      {/* ── Agent fleet ── */}
      <div className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Max healthy agents" value={agent.maxHealthyAgents ? `${agent.maxHealthyAgents}` : '—'} accent={C.primary} />
          <Stat label="Think-time / agent" value={`${agent.thinkTimeMs} ms`} />
          <Stat label="Degraded at" value={agent.degradedAtAgents ? `${agent.degradedAtAgents}` : 'never'} accent={agent.degradedAtAgents ? C.danger : C.ok} />
          <Stat label="Peak agent throughput" value={`${Math.round(agent.levels.at(-1)?.rps ?? 0).toLocaleString()} rps`} accent={C.rps} />
        </div>
        {agent.ranReal ? (
          <ChartFrame title="Agent fleet — throughput & latency vs concurrent agents"
            sub={`each agent issues ~${agent.reqsPerAgent} req/s with ${agent.thinkTimeMs}ms think-time`}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={agent.levels} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E5FF" />
                <XAxis dataKey="agents" tick={axis} label={{ value: 'concurrent agents', position: 'insideBottom', offset: -2, fontSize: 10, fill: C.sub }} />
                <YAxis yAxisId="rps" tick={axis} label={{ value: 'req/s', angle: -90, position: 'insideLeft', fontSize: 10, fill: C.sub }} />
                <YAxis yAxisId="lat" orientation="right" tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Line yAxisId="rps" type="monotone" dataKey="rps" name="req/s" stroke={C.primary} strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="lat" type="monotone" dataKey="latencyP99" name="p99 ms" stroke={C.p99} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : <NotRun what="agent simulation" />}
      </div>

      {/* ── Chaos ── */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Fault injected" value={chaos.faultType} accent={C.danger} />
          <Stat label="Errors during fault" value={`${faultPct}%`} accent={C.danger} />
          <Stat label="Recovery time" value={chaos.recoverySeconds != null ? `${chaos.recoverySeconds.toFixed(1)} s` : '—'} accent={C.primary} />
          <Stat label="Recovered" value={chaos.recovered ? 'yes' : 'no'} accent={chaos.recovered ? C.ok : C.danger} />
        </div>
        {chaos.ranReal ? (
          <ChartFrame title="Chaos — error spike under fault & recovery"
            sub={`held ${Math.round(chaos.baselineRps).toLocaleString()} rps at ${chaos.concurrency} concurrency, then injected a ${chaos.faultType}`}>
            <div className="space-y-3">
              {[
                { phase: 'baseline (healthy)', pct: basePct, color: C.ok },
                { phase: `during ${chaos.faultType}`, pct: faultPct, color: C.danger },
                { phase: 'after recovery', pct: basePct, color: C.ok },
              ].map((row) => (
                <div key={row.phase} className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#6B6B6B] w-40 shrink-0">{row.phase}</span>
                  <div className="flex-1 h-4 bg-[#F7F7FB] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, row.pct)}%`, backgroundColor: row.color }} />
                  </div>
                  <span className="font-mono text-[11px] w-12 text-right" style={{ color: row.color }}>{row.pct}%</span>
                </div>
              ))}
              <p className="font-mono text-[11px] text-[#6B6B6B] pt-1">
                request error-rate by phase — the app dropped {faultPct}% of traffic during the {chaos.faultType} and
                returned to baseline in {chaos.recoverySeconds?.toFixed(1)}s.
              </p>
            </div>
          </ChartFrame>
        ) : <NotRun what="chaos test" />}
      </div>
    </section>
  );
}
