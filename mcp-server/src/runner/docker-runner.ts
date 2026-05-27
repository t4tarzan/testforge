// Tier-2 sandbox runner. Takes the test files that came out of the generator,
// drops them into an ephemeral host directory, runs them inside the pre-baked
// `testforge-runner:local` container, parses the JSON reporter output, and
// destroys the host directory on completion.
//
// Why local Docker (not Fly Machines yet):
// - Colima is already running on the hub, no infra to provision
// - Cold start is ~1-3s vs Fly's 5-15s
// - Same `docker run` interface — Day 3 swaps the spawn step for a Fly
//   Machines API call without changing the public route shape
//
// Host-path note: Colima/virtiofs only mounts /Users/* by default — we write
// runs under ~/.testforge/runs/ rather than /tmp so the bind-mount actually
// shows up inside the container.
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { GeneratedTestFile } from '../generator/generate-tests.js';

const RUNS_DIR = join(homedir(), '.testforge', 'runs');
const IMAGE = process.env.TESTFORGE_RUNNER_IMAGE || 'testforge-runner:local';
const RUNNER_TIMEOUT_MS = 120_000;

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

async function dockerRun(hostMountDir: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    // --rm so the container is gone the moment it exits. Bind-mount is
    // read-only — generated tests should not need to write to disk.
    const args = [
      'run',
      '--rm',
      '--network', 'none', // no outbound — LLM-generated code is untrusted
      '-v', `${hostMountDir}:/runner/tests:ro`,
      IMAGE,
    ];
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const killer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    }, RUNNER_TIMEOUT_MS);
    proc.stdout.on('data', (b) => { out += b.toString(); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('close', (code) => {
      clearTimeout(killer);
      resolve({ stdout: out, stderr: err, code: code ?? -1 });
    });
  });
}

function parseVitestJson(raw: string, files: GeneratedTestFile[]): {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  success: boolean;
  fileResults: RunFileResult[];
} {
  const trimmed = raw.trim();
  // Vitest may emit non-JSON warnings before the report; the report itself
  // is one top-level JSON object. Find the FIRST `{` (not the last — that
  // grabs an inner nested object and parsing fails) and parse from there.
  const start = trimmed.indexOf('{');
  const candidate = start >= 0 ? trimmed.slice(start) : trimmed;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return {
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      success: false,
      fileResults: files.map((f) => ({
        filename: f.filename,
        status: 'errored',
        numPassed: 0,
        numFailed: 0,
        failureMessages: ['Could not parse vitest JSON output'],
      })),
    };
  }
  const testResults = (obj.testResults as Array<Record<string, unknown>> | undefined) ?? [];
  const fileResults: RunFileResult[] = testResults.map((tr) => {
    const filename = String(tr.name ?? '').split('/').pop() ?? 'unknown.test.ts';
    const assertion = (tr.assertionResults as Array<Record<string, unknown>> | undefined) ?? [];
    const passed = assertion.filter((a) => a.status === 'passed').length;
    const failed = assertion.filter((a) => a.status === 'failed').length;
    const failureMessages: string[] = assertion
      .filter((a) => a.status === 'failed')
      .flatMap((a) => (a.failureMessages as string[] | undefined) ?? []);
    return {
      filename,
      status: tr.status === 'passed' ? 'passed' : tr.status === 'failed' ? 'failed' : 'errored',
      numPassed: passed,
      numFailed: failed,
      failureMessages,
    };
  });
  return {
    numTotalTests: Number(obj.numTotalTests ?? 0),
    numPassedTests: Number(obj.numPassedTests ?? 0),
    numFailedTests: Number(obj.numFailedTests ?? 0),
    success: Boolean(obj.success),
    fileResults,
  };
}

export async function runGeneratedTests(files: GeneratedTestFile[]): Promise<RunResult> {
  const runId = 'run_' + Date.now().toString(36);
  const mountDir = join(RUNS_DIR, runId);
  mkdirSync(mountDir, { recursive: true });

  // Drop the generated test files in. Sanitize filenames so a model can't
  // path-traverse out of the mount dir.
  for (const f of files) {
    const safe = f.filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const finalName = safe.endsWith('.test.ts') ? safe : `${safe}.test.ts`;
    writeFileSync(join(mountDir, finalName), f.content, 'utf8');
  }

  const t0 = Date.now();
  let containerError: string | undefined;
  let rawJson = '';
  try {
    const { stdout, stderr, code } = await dockerRun(mountDir);
    rawJson = stdout;
    if (code !== 0 && !stdout.trim().startsWith('{')) {
      containerError = stderr.trim() || `docker exited with code ${code}`;
    }
  } finally {
    // Always clean up the host mount dir
    try { rmSync(mountDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  const durationMs = Date.now() - t0;

  const parsed = parseVitestJson(rawJson, files);

  return {
    runId,
    success: parsed.success,
    numTotalTests: parsed.numTotalTests,
    numPassedTests: parsed.numPassedTests,
    numFailedTests: parsed.numFailedTests,
    durationMs,
    files: parsed.fileResults,
    containerError,
  };
}
