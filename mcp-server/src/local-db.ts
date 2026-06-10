import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DB_DIR = join(homedir(), '.testforge');
const DB_PATH = join(DB_DIR, 'history.db');

type DB = ReturnType<typeof Database>;

export interface ReportRow {
  id: string;
  source: string;
  type: string;
  overall_score: number;
  total_files: number;
  total_lines: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  agentic_score: number | null;
  agentic_max_agents: number | null;
  agentic_bottleneck?: string | null;
  tech_stack?: string;
  full_data?: string | Record<string, unknown>;
  created_at: string;
}

let db: DB | undefined;

export function getLocalDb(): DB {
  if (db) return db;
  if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
  db = Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      type TEXT DEFAULT 'local',
      overall_score INTEGER,
      total_files INTEGER,
      total_lines INTEGER,
      total_findings INTEGER,
      critical_count INTEGER DEFAULT 0,
      high_count INTEGER DEFAULT 0,
      medium_count INTEGER DEFAULT 0,
      low_count INTEGER DEFAULT 0,
      tech_stack TEXT,
      agentic_score INTEGER,
      agentic_max_agents INTEGER,
      agentic_bottleneck TEXT,
      full_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

    -- Tier 2 generation runs (LLM produced tests + sandbox results).
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      cluster TEXT,
      provider_primary TEXT,
      provider_fallback TEXT,
      requested_findings INTEGER DEFAULT 0,
      processed INTEGER DEFAULT 0,
      generation_ms INTEGER DEFAULT 0,
      run_ms INTEGER DEFAULT 0,
      success INTEGER DEFAULT 0,
      num_total_tests INTEGER DEFAULT 0,
      num_passed_tests INTEGER DEFAULT 0,
      num_failed_tests INTEGER DEFAULT 0,
      full_data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);

    -- Simulate baselines: one row per run, keyed by repo+branch+dimensions, so a
    -- later run can diff its metrics against the previous one (regression deltas).
    CREATE TABLE IF NOT EXISTS sim_baselines (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      repo TEXT,
      branch TEXT,
      base_ref TEXT,
      dimensions TEXT,
      metrics_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sim_baselines_key ON sim_baselines(key, created_at DESC);

    -- Coherence snapshots: per-surface behavior fingerprint (pages + journeys)
    -- per run, keyed like baselines, so a later run can diff for output divergence.
    CREATE TABLE IF NOT EXISTS coherence_snapshots (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      repo TEXT,
      branch TEXT,
      base_ref TEXT,
      snapshot_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_coherence_key ON coherence_snapshots(key, created_at DESC);
  `);
  
  console.log(`📁 Local DB: ${DB_PATH}`);
  return db;
}

export function saveReport(data: Record<string, unknown>, source: string): string {
  const d = getLocalDb();
  const id = 'local_' + Date.now().toString(36);
  const c = (data.codebase as Record<string, unknown>) || {};
  const s = (data.security as Record<string, unknown>) || {};
  const a = (data.agentic as Record<string, unknown>) || {};
  
  const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback);
  const stack = (data.stack as Record<string, unknown>) || {};
  const unit = (data.unit as Record<string, unknown>) || {};
  const accessibility = (data.accessibility as Record<string, unknown>) || {};
  const dora = (data.dora as Record<string, unknown>) || {};

  const overall = Math.round(
    (num(a.score, 50) * 0.2 + num(stack.score, 60) * 0.15 +
     num(unit.coverage, 50) * 0.15 + Math.max(0, 100 - num(s.critical, 0) * 20) * 0.3 +
     num(accessibility.score, 70) * 0.1 + num(dora.score, 50) * 0.1)
  );

  d.prepare(`INSERT INTO reports (id, source, type, overall_score, total_files, total_lines, total_findings, critical_count, high_count, medium_count, low_count, tech_stack, agentic_score, agentic_max_agents, agentic_bottleneck, full_data) VALUES (?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, source, overall, num(c.totalFiles, 0), num(c.totalLines, 0),
    num(s.findings, 0), num(s.critical, 0), num(s.high, 0), num(s.medium, 0), num(s.low, 0),
    JSON.stringify(c.techStack || []), num(a.score, 0), num(a.maxPredictedAgents, 0),
    (a.predictedBottleneck as string) || '', JSON.stringify(data)
  );

  return id;
}

export function getReports(limit = 20): ReportRow[] {
  const d = getLocalDb();
  return d.prepare('SELECT id, source, type, overall_score, total_files, total_lines, total_findings, critical_count, high_count, medium_count, low_count, agentic_score, agentic_max_agents, created_at FROM reports ORDER BY created_at DESC LIMIT ?').all(limit) as unknown as ReportRow[];
}

export function getReport(id: string): ReportRow | null {
  const d = getLocalDb();
  const row = d.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRow | undefined;
  if (row && typeof row.full_data === 'string') {
    row.full_data = JSON.parse(row.full_data);
  }
  return row ?? null;
}

// ─── Tier 2 generations ────────────────────────────────────────────────
export interface GenerationRow {
  id: string;
  cluster: string;
  provider_primary: string;
  provider_fallback: string;
  requested_findings: number;
  processed: number;
  generation_ms: number;
  run_ms: number;
  success: number;
  num_total_tests: number;
  num_passed_tests: number;
  num_failed_tests: number;
  full_data: string | Record<string, unknown>;
  created_at: string;
}

export interface SaveGenerationInput {
  id: string;
  cluster: string;
  providerPrimary: string;
  providerFallback: string;
  requestedFindings: number;
  processed: number;
  generationMs: number;
  runMs: number;
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  fullData: unknown;
}

export function saveGeneration(input: SaveGenerationInput): void {
  const d = getLocalDb();
  d.prepare(
    `INSERT INTO generations (
      id, cluster, provider_primary, provider_fallback,
      requested_findings, processed, generation_ms, run_ms,
      success, num_total_tests, num_passed_tests, num_failed_tests, full_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id, input.cluster, input.providerPrimary, input.providerFallback,
    input.requestedFindings, input.processed, input.generationMs, input.runMs,
    input.success ? 1 : 0,
    input.numTotalTests, input.numPassedTests, input.numFailedTests,
    JSON.stringify(input.fullData)
  );
}

export function getGenerations(limit = 20): GenerationRow[] {
  const d = getLocalDb();
  return d.prepare(
    `SELECT id, cluster, provider_primary, provider_fallback,
            requested_findings, processed, generation_ms, run_ms,
            success, num_total_tests, num_passed_tests, num_failed_tests,
            created_at
     FROM generations ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as unknown as GenerationRow[];
}

export function getGeneration(id: string): GenerationRow | null {
  const d = getLocalDb();
  const row = d.prepare('SELECT * FROM generations WHERE id = ?').get(id) as GenerationRow | undefined;
  if (row && typeof row.full_data === 'string') {
    row.full_data = JSON.parse(row.full_data);
  }
  return row ?? null;
}

// ─── Simulate baselines ────────────────────────────────────────────────
export interface SaveSimBaselineInput {
  id: string;
  key: string;
  repo: string;
  branch?: string;
  baseRef?: string;
  dimensions: string[];
  metrics: unknown;
}

export interface SimBaselineRow {
  id: string;
  key: string;
  repo: string;
  branch: string;
  base_ref: string | null;
  dimensions: string;
  metrics: unknown;
  created_at: string;
}

export function saveSimBaseline(input: SaveSimBaselineInput): void {
  const d = getLocalDb();
  d.prepare(
    `INSERT INTO sim_baselines (id, key, repo, branch, base_ref, dimensions, metrics_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id, input.key, input.repo, input.branch || 'default', input.baseRef || null,
    JSON.stringify(input.dimensions), JSON.stringify(input.metrics)
  );
}

/** Most recent baseline for a key (e.g. the previous run, to diff against). */
export function getLatestSimBaseline(key: string): SimBaselineRow | null {
  const d = getLocalDb();
  const row = d.prepare(
    `SELECT id, key, repo, branch, base_ref, dimensions, metrics_json, created_at
     FROM sim_baselines WHERE key = ? ORDER BY created_at DESC, id DESC LIMIT 1`
  ).get(key) as (Omit<SimBaselineRow, 'metrics'> & { metrics_json: string }) | undefined;
  if (!row) return null;
  const { metrics_json, ...rest } = row;
  return { ...rest, metrics: JSON.parse(metrics_json) };
}

// ─── Coherence snapshots ────────────────────────────────────────────────
export interface SaveCoherenceInput {
  id: string;
  key: string;
  repo: string;
  branch?: string;
  baseRef?: string;
  snapshot: unknown;
}

export interface CoherenceSnapshotRow {
  id: string;
  key: string;
  repo: string;
  branch: string;
  base_ref: string | null;
  snapshot: unknown;
  created_at: string;
}

export function saveCoherenceSnapshot(input: SaveCoherenceInput): void {
  const d = getLocalDb();
  d.prepare(
    `INSERT INTO coherence_snapshots (id, key, repo, branch, base_ref, snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(input.id, input.key, input.repo, input.branch || 'default', input.baseRef || null, JSON.stringify(input.snapshot));
}

/** Most recent coherence snapshot for a key (the previous run, to diff against). */
export function getLatestCoherenceSnapshot(key: string): CoherenceSnapshotRow | null {
  const d = getLocalDb();
  const row = d.prepare(
    `SELECT id, key, repo, branch, base_ref, snapshot_json, created_at
     FROM coherence_snapshots WHERE key = ? ORDER BY created_at DESC, id DESC LIMIT 1`
  ).get(key) as (Omit<CoherenceSnapshotRow, 'snapshot'> & { snapshot_json: string }) | undefined;
  if (!row) return null;
  const { snapshot_json, ...rest } = row;
  return { ...rest, snapshot: JSON.parse(snapshot_json) };
}
