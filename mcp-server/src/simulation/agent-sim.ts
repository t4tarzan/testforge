// Agent-pattern load — Phase 3 of the simulation engine (SIMULATION_ENGINE_PLAN.md).
//
// A flavor of load aimed at the "agentic scale" dimension: instead of hammering
// at raw max throughput, it models a growing fleet of concurrent AI/agent
// clients, each issuing requests with realistic THINK-TIME between calls (an
// agent reasons, then calls a tool, then reasons again — it doesn't spin). We
// ramp the fleet size and find how many agents the app sustains before it
// degrades — a real, measured answer to the otherwise-static agentic-scale
// prediction.
//
// Mechanics: autocannon with -R (per-connection request rate). N connections at
// R req/s/connection ≈ N agents pausing ~1/R s between calls.
import { type Sandbox, type LoadLevelResult, runAutocannon, warmup } from './sandbox.js';

const DEFAULT_AGENT_LEVELS = [25, 50, 100, 200, 400];
const DEFAULT_DURATION_SEC = 8;
// Each agent issues this many requests/sec → think-time ≈ 1/rate. 2 ⇒ ~500ms.
const DEFAULT_REQS_PER_AGENT = 2;
// An agent level "degrades" once this share of requests fail.
const DEGRADE_ERROR_RATE = 0.05;

export interface AgentLevelResult extends LoadLevelResult {
  /** Concurrent agents at this step (= autocannon connections). */
  agents: number;
  thinkTimeMs: number;
}

export interface AgentSimResult {
  ranReal: boolean;
  method: 'dockerfile' | 'compose';
  targetPort: number;
  path: string;
  reqsPerAgent: number;
  thinkTimeMs: number;
  /** Highest fleet size that stayed under the error threshold; null if even the
   *  smallest level degraded. This is the measured "max concurrent agents". */
  maxHealthyAgents: number | null;
  /** First fleet size that crossed the error threshold; null if none did. */
  degradedAtAgents: number | null;
  levels: AgentLevelResult[];
  durationMs: number;
  reason?: string;
}

export interface AgentSimOptions {
  paths?: string[];
  /** Fleet sizes to ramp through. */
  agentLevels?: number[];
  durationPerLevelSec?: number;
  /** Requests/sec each agent issues (think-time = 1/this). */
  reqsPerAgent?: number;
  onProgress?: (detail: string) => void;
}

export async function runAgentLoad(sb: Sandbox, opts: AgentSimOptions = {}): Promise<AgentSimResult> {
  const t0 = Date.now();
  const levels = opts.agentLevels?.length ? opts.agentLevels : DEFAULT_AGENT_LEVELS;
  const durationSec = opts.durationPerLevelSec ?? DEFAULT_DURATION_SEC;
  const reqsPerAgent = opts.reqsPerAgent ?? DEFAULT_REQS_PER_AGENT;
  const thinkTimeMs = Math.round(1000 / reqsPerAgent);
  const path = (opts.paths && opts.paths.length ? opts.paths[0] : '/') || '/';
  const progress = opts.onProgress ?? (() => undefined);
  const method = sb.kind === 'compose' ? 'compose' : 'dockerfile';

  progress('Warming up the app');
  await warmup(sb, path);

  const results: AgentLevelResult[] = [];
  let degradedAtAgents: number | null = null;
  for (const agents of levels) {
    progress(`Simulating ${agents} concurrent agents (~${thinkTimeMs}ms think-time) for ${durationSec}s`);
    // Aggregate rate = agents × per-agent rate, spread across `agents` connections.
    const lvl = await runAutocannon(sb, path, agents, durationSec, agents * reqsPerAgent);
    if (!lvl) { degradedAtAgents = agents; break; }
    results.push({ ...lvl, agents, thinkTimeMs });
    if (lvl.errorRate > DEGRADE_ERROR_RATE) { degradedAtAgents = agents; break; }
  }

  const healthy = results.filter((r) => r.errorRate <= DEGRADE_ERROR_RATE).map((r) => r.agents);
  return {
    ranReal: true,
    method,
    targetPort: sb.targetPort,
    path,
    reqsPerAgent,
    thinkTimeMs,
    maxHealthyAgents: healthy.length ? Math.max(...healthy) : null,
    degradedAtAgents,
    levels: results,
    durationMs: Date.now() - t0,
    reason: results.length === 0 ? 'Agent load driver produced no usable results.' : undefined,
  };
}
