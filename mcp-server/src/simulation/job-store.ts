// In-memory job store for async simulations.
//
// Real sims run minutes (boot + multi-level load ramp + later chaos), which
// would blow past nginx's ~300s proxy_read_timeout on the mcp vhost if served
// in one HTTP request. So /simulate is async: POST creates a job and returns a
// jobId immediately; the sim runs in the background and updates the job through
// its phases; the client polls GET /simulate/:jobId until it's done.
//
// In-memory is intentional for Phase 1: a single MCP container, sims are
// ephemeral, and a restart losing in-flight jobs is acceptable. (Durable
// persistence in history.db is a later follow-up if we want jobs to survive
// restarts.)

export type SimStatus = 'queued' | 'running' | 'done' | 'error';
export type SimPhase = 'queued' | 'cloning' | 'detecting' | 'building' | 'booting' | 'load' | 'agent' | 'chaos' | 'done' | 'error';

export interface SimJob {
  jobId: string;
  status: SimStatus;
  phase: SimPhase;
  /** Human-readable note about what the current phase is doing. */
  detail?: string;
  repo: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Final /simulate response payload once status=done. */
  result?: unknown;
  /** Populated when status=error. */
  error?: string;
}

// Keep the most-recent N jobs; evict oldest beyond that so a long-lived server
// doesn't grow unbounded. Sims are minutes apart, so this is generous.
const MAX_JOBS = 200;
const jobs = new Map<string, SimJob>();

function nowIso(createdAtMs?: number): string {
  // Date.now() is fine in the server runtime (only the workflow sandbox forbids
  // it). Kept in one helper so the timestamp source is easy to find.
  return new Date(createdAtMs ?? Date.now()).toISOString();
}

function evictIfNeeded(): void {
  if (jobs.size <= MAX_JOBS) return;
  // Map preserves insertion order; delete oldest finished jobs first.
  for (const [id, job] of jobs) {
    if (jobs.size <= MAX_JOBS) break;
    if (job.status === 'done' || job.status === 'error') jobs.delete(id);
  }
  // If still over (all running — unlikely), drop oldest regardless.
  while (jobs.size > MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    if (oldest === undefined) break;
    jobs.delete(oldest);
  }
}

export function createJob(jobId: string, repo: string, branch?: string): SimJob {
  const ts = nowIso();
  const job: SimJob = {
    jobId, status: 'queued', phase: 'queued',
    repo, branch, createdAt: ts, updatedAt: ts,
  };
  jobs.set(jobId, job);
  evictIfNeeded();
  return job;
}

export function getJob(jobId: string): SimJob | undefined {
  return jobs.get(jobId);
}

export function listJobs(limit = 20): Omit<SimJob, 'result'>[] {
  // Most-recent first; omit the bulky `result` blob from the list view.
  return [...jobs.values()].reverse().slice(0, limit).map((job) => {
    const copy: SimJob = { ...job };
    delete copy.result;
    return copy;
  });
}

/** Patch a job in place. No-op if the job was already evicted. */
export function updateJob(jobId: string, patch: Partial<SimJob>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: nowIso() });
}
