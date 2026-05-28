// Simulation showcase — REAL load/agent/chaos simulation runs against known
// public repos, produced by the MCP `/simulate` engine (boot the app in an
// isolated sandbox → drive live traffic → measure). Each JSON is the genuine
// result payload, slimmed for the bundle. The glob below auto-discovers new
// ones at build time — drop a `<slug>.json` here and commit it.
//
// These are real measurements, not heuristics: ranReal:true means we booted the
// app and hit it with autocannon. (The static load/chaos *analysis* dimensions
// still exist for repos that can't be auto-booted.)

export interface SimLoadLevel {
  concurrency: number;
  rps: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  errorRate: number;
  totalRequests: number;
}

export interface SimAgentLevel {
  agents: number;
  rps: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  errorRate: number;
  totalRequests: number;
}

export interface SimLoad {
  ranReal: boolean;
  targetPort: number;
  path: string;
  /** Headline latency (ms) + throughput from the top level reached. */
  p50: number;
  p90: number;
  p99: number;
  rps: number;
  errorRate: number;
  /** Concurrency at which error-rate crossed the threshold; null = never broke. */
  breakingPointConcurrency: number | null;
  levels: SimLoadLevel[];
}

export interface SimAgent {
  ranReal: boolean;
  /** Requests/sec each agent issues (think-time ≈ 1000/reqsPerAgent ms). */
  reqsPerAgent: number;
  thinkTimeMs: number;
  /** Largest fleet that stayed healthy; null if even the smallest degraded. */
  maxHealthyAgents: number | null;
  degradedAtAgents: number | null;
  levels: SimAgentLevel[];
}

export interface SimChaos {
  ranReal: boolean;
  faultType: string;
  /** Sustained concurrency held across the fault. */
  concurrency: number;
  baselineRps: number;
  baselineErrorRate: number;
  /** Error rate measured while the fault was active (0..1). */
  errorRateDuringFault: number;
  /** Seconds from fault-cleared to serving at ~baseline again. */
  recoverySeconds: number | null;
  recovered: boolean;
}

export interface SimulationShowcase {
  slug: string;
  repoUrl: string;
  repoName: string;
  tagline: string;
  method: 'dockerfile' | 'compose';
  simulatedAt: string;
  load: SimLoad;
  agent: SimAgent;
  chaos: SimChaos;
}

// Vite glob import — eager so each JSON ships in the bundle.
const modules = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const simulationShowcase: SimulationShowcase[] = Object.entries(modules)
  .map(([path, value]) => {
    const sim = value as SimulationShowcase;
    const filenameSlug = path.replace(/^\.\//, '').replace(/\.json$/, '');
    if (sim.slug !== filenameSlug) {
      // eslint-disable-next-line no-console
      console.warn(`simulation showcase ${path} slug mismatch: ${sim.slug} vs ${filenameSlug}`);
    }
    return sim;
  })
  .sort((a, b) => a.repoName.localeCompare(b.repoName));

export function getSimulationShowcase(slug: string): SimulationShowcase | undefined {
  return simulationShowcase.find((s) => s.slug === slug);
}
