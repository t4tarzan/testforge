// In development, proxy through Vite. In production, use same-origin /api (Vercel functions)
const API_BASE = '/api';

// Generic fetch wrapper with error handling
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    console.warn(`API call failed for ${path}:`, err);
    throw err;
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    plan: string;
    creditsUsed: number;
    creditsTotal: number;
    testsRun: number;
    passRate: number;
    repos: number;
  };
}

export async function loginUser(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// ─── Health ───────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  database: string;
  features: Record<string, boolean>;
}

export async function checkHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}

// ─── Projects ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  repoUrl: string | null;
  localPath: string;
  branch: string;
  techStack: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return apiFetch<Project>(`/projects?id=${id}`);
}

// ─── Test Runs ────────────────────────────────────────────────────────────

export interface TestRun {
  id: string;
  projectId: string;
  branch: string;
  commitHash: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  overallScore: number | null;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  startedAt: string | null;
  completedAt: string | null;
  config: Record<string, unknown>;
  findings?: Finding[];
  results?: TestResult[];
  reports?: Report[];
}

export interface Finding {
  id: string;
  testRunId: string;
  dimension: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string | null;
  filePath: string | null;
  lineNumber: number | null;
  cveId: string | null;
  fixSuggestion: string | null;
  status: 'open' | 'fixed' | 'ignored';
  createdAt: string;
}

export interface TestResult {
  id: string;
  testRunId: string;
  dimension: string;
  dimensionLabel: string | null;
  status: 'passed' | 'failed' | 'warning' | 'pending';
  durationMs: number | null;
  metrics: Record<string, number> | null;
  logs: unknown[] | null;
}

export interface Report {
  id: string;
  testRunId: string;
  title: string;
  content: Record<string, unknown>;
  format: string;
  createdAt: string;
}

export async function getTestRuns(projectId?: string): Promise<TestRun[]> {
  const query = projectId ? `?projectId=${projectId}` : '';
  return apiFetch<TestRun[]>(`/test-runs${query}`);
}

export async function getTestRun(id: string): Promise<TestRun> {
  return apiFetch<TestRun>(`/test-runs?id=${id}`);
}

// ─── Reports ──────────────────────────────────────────────────────────────

export interface ReportDetail {
  id: string;
  title: string;
  overallScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  phases: ReportPhase[];
  generatedAt: string;
  testRun?: TestRun;
  findings?: Finding[];
}

export interface ReportPhase {
  name: string;
  priority: string;
  effort: string;
  items: ReportItem[];
}

export interface ReportItem {
  id: string;
  title: string;
  severity: string;
  component?: string;
  finding?: string;
}

export async function getReport(id: string): Promise<ReportDetail> {
  return apiFetch<ReportDetail>(`/reports/${id}`);
}

// ─── Helper: Check if API is available ────────────────────────────────────

let apiAvailable: boolean | null = null;

export async function isApiAvailable(): Promise<boolean> {
  if (apiAvailable !== null) return apiAvailable;
  try {
    const health = await checkHealth();
    apiAvailable = health.status === 'ok';
  } catch {
    apiAvailable = false;
  }
  return apiAvailable;
}
