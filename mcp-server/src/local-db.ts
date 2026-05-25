import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DB_DIR = join(homedir(), '.testforge');
const DB_PATH = join(DB_DIR, 'history.db');

let db: any;

export function getLocalDb(): any {
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
  `);
  
  console.log(`📁 Local DB: ${DB_PATH}`);
  return db;
}

export function saveReport(data: any, source: string): string {
  const d = getLocalDb();
  const id = 'local_' + Date.now().toString(36);
  const c = data.codebase || {};
  const s = data.security || {};
  const a = data.agentic || {};
  
  const overall = Math.round(
    ((a.score || 50) * 0.2 + (data.stack?.score || 60) * 0.15 + 
     (data.unit?.coverage || 50) * 0.15 + Math.max(0, 100 - (s.critical || 0) * 20) * 0.3 + 
     (data.accessibility?.score || 70) * 0.1 + (data.dora?.score || 50) * 0.1)
  );
  
  d.prepare(`INSERT INTO reports (id, source, type, overall_score, total_files, total_lines, total_findings, critical_count, high_count, medium_count, low_count, tech_stack, agentic_score, agentic_max_agents, agentic_bottleneck, full_data) VALUES (?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, source, overall, c.totalFiles || 0, c.totalLines || 0,
    s.findings || 0, s.critical || 0, s.high || 0, s.medium || 0, s.low || 0,
    JSON.stringify(c.techStack || []), a.score || 0, a.maxPredictedAgents || 0,
    a.predictedBottleneck || '', JSON.stringify(data)
  );
  
  return id;
}

export function getReports(limit = 20): any[] {
  const d = getLocalDb();
  return d.prepare('SELECT id, source, type, overall_score, total_files, total_lines, total_findings, critical_count, high_count, medium_count, low_count, agentic_score, agentic_max_agents, created_at FROM reports ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function getReport(id: string): any {
  const d = getLocalDb();
  const row = d.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
  if (row) {
    row.full_data = JSON.parse(row.full_data);
  }
  return row;
}
