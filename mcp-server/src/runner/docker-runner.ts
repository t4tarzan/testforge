// Tier-2 sandbox runner — polyglot since v0.29.0. Takes the generated test
// files, groups them by language, and runs each group inside its matching
// pre-baked sandbox image (node/vitest · python/pytest · go/test), all with
// --network=none. Parses each framework's machine-readable output into a
// uniform RunResult, then destroys the ephemeral host dir.
//
// Host-path note: Colima/virtiofs only mounts /Users/* by default — runs live
// under ~/.testforge/runs/ so the bind-mount shows up inside the container.
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { GeneratedTestFile, TestLanguage } from '../generator/generate-tests.js';

// Where generated test files are written before being bind-mounted into the
// runner. Env-overridable because managed Tier-2 runs the MCP in a container
// talking to the HOST docker (via socket-proxy): the mount source must be a
// path the host daemon can see, so the VPS sets TESTFORGE_RUNS_DIR to a dir
// that's bind-mounted into the MCP container at the SAME path.
const RUNS_DIR = process.env.TESTFORGE_RUNS_DIR || join(homedir(), '.testforge', 'runs');
const RUNNER_TIMEOUT_MS = 120_000;

// Per-language sandbox images. Defaults are the public GHCR images so a fresh
// `npx` install only needs Docker. Override any with env to point at a local
// build (e.g. on the managed box).
const IMAGES: Record<TestLanguage, string> = {
  js: process.env.TESTFORGE_RUNNER_IMAGE || 'ghcr.io/t4tarzan/testforge-runner:latest',
  python: process.env.TESTFORGE_RUNNER_IMAGE_PYTHON || 'ghcr.io/t4tarzan/testforge-runner-python:latest',
  go: process.env.TESTFORGE_RUNNER_IMAGE_GO || 'ghcr.io/t4tarzan/testforge-runner-go:latest',
};

const EXT: Record<TestLanguage, string> = { js: '.test.ts', python: '_test.py', go: '_test.go' };

export interface RunFileResult {
  filename: string;
  status: 'passed' | 'failed' | 'errored';
  numPassed: number;
  numFailed: number;
  failureMessages: string[];
}

export interface RunResult {
  runId: string;
  success: boolean;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  durationMs: number;
  files: RunFileResult[];
  rawJson?: string;
  containerError?: string;
}

const imagePullAttempted = new Set<string>();
async function ensureImage(image: string): Promise<string | null> {
  // Local builds (no registry host or :local tag) are never pulled.
  if (!image.includes('/') || image.endsWith(':local')) return null;
  if (imagePullAttempted.has(image)) return null;
  imagePullAttempted.add(image);
  return new Promise((resolve) => {
    const inspect = spawn('docker', ['image', 'inspect', image], { stdio: 'ignore' });
    inspect.on('close', (code) => {
      if (code === 0) return resolve(null);
      const pull = spawn('docker', ['pull', image], { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      pull.stderr.on('data', (b) => { err += b.toString(); });
      pull.on('close', (pc) => {
        if (pc === 0) return resolve(null);
        imagePullAttempted.delete(image); // allow retry
        resolve(err.trim() || `docker pull ${image} exited ${pc}`);
      });
    });
  });
}

async function dockerRun(image: string, hostMountDir: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    // Hardened sandbox for untrusted LLM-generated code: no network, all caps
    // dropped, no privilege escalation, bounded pids/memory/cpu, ephemeral
    // (--rm), and the only writable space is a tmpfs /tmp (exec for go/vitest
    // build artifacts). The test files come in read-only.
    const args = [
      'run', '--rm',
      '--network', 'none',
      '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges',
      '--pids-limit', '512',
      '--memory', '512m',
      '--cpus', '1',
      '--tmpfs', '/tmp:rw,exec,size=512m',
      '-v', `${hostMountDir}:/runner/tests:ro`,
      image,
    ];
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, RUNNER_TIMEOUT_MS);
    proc.stdout.on('data', (b) => { out += b.toString(); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('close', (code) => { clearTimeout(killer); resolve({ stdout: out, stderr: err, code: code ?? -1 }); });
  });
}

interface ParsedGroup { total: number; passed: number; failed: number; files: RunFileResult[] }

function erroredGroup(files: GeneratedTestFile[], msg: string): ParsedGroup {
  return { total: 0, passed: 0, failed: 0, files: files.map((f) => ({ filename: f.filename, status: 'errored', numPassed: 0, numFailed: 0, failureMessages: [msg] })) };
}

// ── Vitest JSON reporter ───────────────────────────────────────────────────
function parseVitest(raw: string, files: GeneratedTestFile[]): ParsedGroup {
  const start = raw.trim().indexOf('{');
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(start >= 0 ? raw.trim().slice(start) : raw.trim()); }
  catch { return erroredGroup(files, 'Could not parse vitest JSON output'); }
  const testResults = (obj.testResults as Array<Record<string, unknown>> | undefined) ?? [];
  const fileResults: RunFileResult[] = testResults.map((tr) => {
    const filename = String(tr.name ?? '').split('/').pop() ?? 'unknown.test.ts';
    const a = (tr.assertionResults as Array<Record<string, unknown>> | undefined) ?? [];
    const passed = a.filter((x) => x.status === 'passed').length;
    const failed = a.filter((x) => x.status === 'failed').length;
    const failureMessages = a.filter((x) => x.status === 'failed').flatMap((x) => (x.failureMessages as string[] | undefined) ?? []);
    return { filename, status: tr.status === 'passed' ? 'passed' : tr.status === 'failed' ? 'failed' : 'errored', numPassed: passed, numFailed: failed, failureMessages };
  });
  return { total: Number(obj.numTotalTests ?? 0), passed: Number(obj.numPassedTests ?? 0), failed: Number(obj.numFailedTests ?? 0), files: fileResults };
}

// ── pytest-json-report ─────────────────────────────────────────────────────
function parsePytest(raw: string, files: GeneratedTestFile[]): ParsedGroup {
  const start = raw.trim().indexOf('{');
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(start >= 0 ? raw.trim().slice(start) : raw.trim()); }
  catch { return erroredGroup(files, 'Could not parse pytest JSON output'); }
  const tests = (obj.tests as Array<Record<string, unknown>> | undefined) ?? [];
  const byFile = new Map<string, RunFileResult>();
  for (const t of tests) {
    const nodeid = String(t.nodeid ?? '');
    const filename = (nodeid.split('::')[0] || 'unknown_test.py').split('/').pop()!;
    const outcome = String(t.outcome ?? '');
    const r = byFile.get(filename) ?? { filename, status: 'passed', numPassed: 0, numFailed: 0, failureMessages: [] };
    if (outcome === 'passed') r.numPassed++;
    else { r.numFailed++; r.status = 'failed';
      const call = (t.call as Record<string, unknown> | undefined);
      const longrepr = String(call?.longrepr ?? t.longrepr ?? '').slice(0, 1200);
      if (longrepr) r.failureMessages.push(longrepr);
    }
    byFile.set(filename, r);
  }
  const summary = (obj.summary as Record<string, number> | undefined) ?? {};
  const passed = Number(summary.passed ?? 0);
  const failed = Number(summary.failed ?? 0) + Number(summary.error ?? 0);
  return { total: Number(summary.total ?? passed + failed), passed, failed, files: [...byFile.values()] };
}

// ── go test -json (one JSON object per line) ───────────────────────────────
function parseGoTest(raw: string, files: GeneratedTestFile[]): ParsedGroup {
  const status = new Map<string, 'pass' | 'fail'>();
  const output = new Map<string, string[]>();
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(s); } catch { continue; }
    const test = ev.Test as string | undefined;
    if (!test) continue; // package-level event
    const action = ev.Action as string;
    if (action === 'pass' || action === 'fail') status.set(test, action);
    else if (action === 'output') {
      const arr = output.get(test) ?? []; arr.push(String(ev.Output ?? '')); output.set(test, arr);
    }
  }
  let passed = 0, failed = 0;
  const failureMessages: string[] = [];
  for (const [test, st] of status) {
    if (st === 'pass') passed++;
    else { failed++; failureMessages.push((output.get(test) ?? []).join('').slice(0, 1200)); }
  }
  // go test -json doesn't map tests→files; report at the group (file-set) level.
  const filename = files.map((f) => f.filename).join(', ') || 'go tests';
  const total = passed + failed;
  return { total, passed, failed, files: [{ filename, status: failed > 0 ? 'failed' : total > 0 ? 'passed' : 'errored', numPassed: passed, numFailed: failed, failureMessages }] };
}

const PARSERS: Record<TestLanguage, (raw: string, files: GeneratedTestFile[]) => ParsedGroup> = {
  js: parseVitest, python: parsePytest, go: parseGoTest,
};

function safeName(f: GeneratedTestFile): string {
  const ext = EXT[f.language];
  const base = f.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  return base.endsWith(ext) ? base : `${base}${ext}`;
}

export async function runGeneratedTests(files: GeneratedTestFile[]): Promise<RunResult> {
  const runId = 'run_' + Date.now().toString(36);
  const t0 = Date.now();

  // Group by language; each language runs in its own sandbox image.
  const groups = new Map<TestLanguage, GeneratedTestFile[]>();
  for (const f of files) {
    const lang: TestLanguage = f.language ?? 'js';
    (groups.get(lang) ?? groups.set(lang, []).get(lang)!).push(f);
  }

  const allFiles: RunFileResult[] = [];
  let total = 0, passed = 0, failed = 0;
  let containerError: string | undefined;

  for (const [lang, groupFiles] of groups) {
    const image = IMAGES[lang];
    const pullErr = await ensureImage(image);
    if (pullErr) {
      containerError = `Could not pull ${image}: ${pullErr}`;
      allFiles.push(...erroredGroup(groupFiles, containerError).files);
      continue;
    }
    const mountDir = join(RUNS_DIR, `${runId}_${lang}`);
    mkdirSync(mountDir, { recursive: true });
    try {
      for (const f of groupFiles) writeFileSync(join(mountDir, safeName(f)), f.content, 'utf8');
      const { stdout, stderr, code } = await dockerRun(image, mountDir);
      let parsed: ParsedGroup;
      if (code !== 0 && !stdout.trim()) parsed = erroredGroup(groupFiles, stderr.trim() || `${lang} runner exited ${code}`);
      else parsed = PARSERS[lang](stdout, groupFiles);
      total += parsed.total; passed += parsed.passed; failed += parsed.failed;
      allFiles.push(...parsed.files);
    } finally {
      try { rmSync(mountDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  return {
    runId,
    success: failed === 0 && total > 0,
    numTotalTests: total,
    numPassedTests: passed,
    numFailedTests: failed,
    durationMs: Date.now() - t0,
    files: allFiles,
    containerError,
  };
}
