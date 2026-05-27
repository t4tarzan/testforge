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
