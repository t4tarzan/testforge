// Approach C — "wired unit" testing. The /simulate engine already BUILDS the
// app image (deps installed, real module resolution) and boots it. This reuses
// that image to run tests against the user's REAL code: a generated test
// dynamic-imports the actual module by its in-container path and exercises the
// flagged behavior. Node's built-in test runner (node:test, Node ≥18) means we
// need NO framework injected into the app image, and the run stays --network
// none — third-party deps resolve from the image's own node_modules.
//
// Mechanism (proven): docker create (entrypoint → `node --test`), docker cp the
// test in, docker start -a, parse the TAP output, docker rm. v1 is Node/JS-TS +
// single-container (Dockerfile) apps; compose / other stacks fall back.
import { spawn } from 'child_process';
import { writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateObject } from 'ai';
import { z } from 'zod';
import { providerFor, PRIMARY_MODEL, FALLBACK_MODEL } from '../generator/llm-client.js';
import type { LlmOverride } from '../generator/generate-tests.js';

const RUN_TIMEOUT_MS = Number(process.env.TESTFORGE_WIRED_TIMEOUT_MS) || 60_000;
const JS_EXT = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/i;

export interface WiredFindingInput {
  title: string;
  description: string;
  filePath: string;       // absolute path under the cloned repo root
  lineNumber: number;
  fixSuggestion?: string;
  severity?: string;
  codeContext?: string;
}

export interface WiredCaseResult {
  finding: string;
  file: string;            // in-container module path the test imported
  total: number;
  passed: number;
  failed: number;
  status: 'passed' | 'failed' | 'errored' | 'skipped';
  detail?: string;         // failure tail / skip reason
}

export interface WiredResult {
  ranReal: boolean;
  method: 'node-test-in-app-image';
  reason?: string;
  workdir?: string;
  nodeMajor?: number;
  results: WiredCaseResult[];
}

function docker(args: string[], timeoutMs: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const killer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, timeoutMs);
    proc.on('error', (e: Error) => { clearTimeout(killer); resolve({ code: -1, stdout: '', stderr: e.message }); });
    proc.stdout.on('data', (b) => { out += b.toString(); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('close', (code) => { clearTimeout(killer); resolve({ code: code ?? -1, stdout: out, stderr: err }); });
  });
}

async function imageWorkdir(image: string): Promise<string> {
  const r = await docker(['inspect', '--format', '{{.Config.WorkingDir}}', image], 15_000);
  return (r.code === 0 && r.stdout.trim()) || '/app';
}

async function imageNodeMajor(image: string): Promise<number> {
  const r = await docker(['run', '--rm', '--entrypoint', 'node', image, '--version'], 20_000);
  const m = r.stdout.match(/v(\d+)\./);
  return m ? Number(m[1]) : 0;
}

async function fileExistsInImage(image: string, path: string): Promise<boolean> {
  // `test -f` via a shell entrypoint; non-zero exit ⇒ not present (or no shell).
  const r = await docker(['run', '--rm', '--entrypoint', 'sh', image, '-c', `test -f "${path}"`], 15_000);
  return r.code === 0;
}

/** Parse `node --test --test-reporter=tap` output into counts + failure tail. */
function parseTap(tap: string): { total: number; passed: number; failed: number; failTail?: string } {
  const num = (re: RegExp) => { const m = tap.match(re); return m ? Number(m[1]) : 0; };
  const total = num(/^#\s*tests\s+(\d+)/m);
  const passed = num(/^#\s*pass\s+(\d+)/m);
  const failed = num(/^#\s*fail\s+(\d+)/m);
  let failTail: string | undefined;
  if (failed > 0) {
    const lines = tap.split('\n');
    const idx = lines.findIndex((l) => /^not ok\b/.test(l));
    if (idx >= 0) failTail = lines.slice(idx, idx + 12).join('\n').slice(0, 800);
  }
  return { total, passed, failed, failTail };
}

const WIRED_SYSTEM = `You are a senior test author writing tests with Node's built-in test runner.
You get a static-analysis finding and the in-container path of the REAL module it came from.
Output ONE test file as JSON: { filename, content, reasoning }.
Hard requirements for content:
- ESM module syntax. \`import { test } from "node:test"\` and \`import assert from "node:assert/strict"\`.
- Load the real module with a dynamic import of the ABSOLUTE path given, handling both CJS and ESM:
    const mod = await import("<ABSOLUTE_PATH>"); const api = mod.default ?? mod;
  Then call the module's ACTUAL exported functions via \`api\`. Do NOT recreate, redefine, or mock them.
- Only call exports the module actually has; if the needed symbol isn't exported, test the observable behavior of what is. Import nothing else from the project.
- ≥2 test() blocks: one drives the input that triggers the finding's failure mode, one asserts correct/safe behavior. Wrap each assertion-bearing call so an unrelated throw (e.g. a missing DB) surfaces as a clear failure, not an unhandled rejection.
- No network calls you control; no fs writes; no time-based flakiness.
- filename: kebab-case, ends in .test.mjs`;

const schema = z.object({
  filename: z.string().describe('kebab-case filename ending in .test.mjs'),
  content: z.string().describe('Full Node test-runner (node:test) ESM file source.'),
  reasoning: z.string().describe('One short sentence on what the test exercises.'),
});

async function generateWiredTest(
  finding: WiredFindingInput, importPath: string, override?: LlmOverride,
): Promise<{ content: string } | null> {
  const provider = providerFor(override);
  const prompt = `Finding: ${finding.title}
Severity: ${finding.severity ?? 'medium'}
File: ${finding.filePath}:${finding.lineNumber}
Description: ${finding.description}
Suggested fix: ${finding.fixSuggestion ?? ''}
${finding.codeContext ? `\nActual code (\`>\` marks the flagged line):\n\`\`\`\n${finding.codeContext}\n\`\`\`\n` : ''}
The REAL module is importable INSIDE the container at this absolute path: "${importPath}"
Write a node:test file that \`await import("${importPath}")\` and exercises the real exports.`;
  for (const model of [override?.primaryModel || PRIMARY_MODEL, override?.fallbackModel || FALLBACK_MODEL]) {
    if (!model) continue;
    try {
      const { object } = await generateObject({ model: provider.chat(model), schema, system: WIRED_SYSTEM, prompt, temperature: 0.2, maxRetries: 1 });
      // Ensure the absolute import path is present even if the model paraphrased it.
      const content = object.content.includes(importPath) ? object.content : object.content.replace(/await import\((['"])[^'"]*\1\)/, `await import("${importPath}")`);
      return { content };
    } catch { /* try next model */ }
  }
  return null;
}

async function runOneWired(image: string, content: string, base: string): Promise<{ tap: string } | { error: string }> {
  const inPath = `/tmp/${base}.test.mjs`;
  const create = await docker([
    'create', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--pids-limit', '256', '--memory', '512m', '--cpus', '1',
    '--entrypoint', 'node', image, '--test', '--test-reporter=tap', inPath,
  ], 30_000);
  if (create.code !== 0) return { error: `container create failed: ${create.stderr.trim().slice(-200)}` };
  const cid = create.stdout.trim();
  const hostTmp = join(tmpdir(), `tfwired-${base}-${cid.slice(0, 8)}.mjs`);
  try {
    writeFileSync(hostTmp, content, 'utf8');
    const cp = await docker(['cp', hostTmp, `${cid}:${inPath}`], 20_000);
    if (cp.code !== 0) return { error: `docker cp failed: ${cp.stderr.trim().slice(-200)}` };
    const run = await docker(['start', '-a', cid], RUN_TIMEOUT_MS);
    return { tap: `${run.stdout}\n${run.stderr}` };
  } finally {
    try { rmSync(hostTmp, { force: true }); } catch { /* ignore */ }
    await docker(['rm', '-f', cid], 15_000);
  }
}

export interface RunWiredOptions {
  image: string;
  projectPath: string;          // cloned repo root (to relativize finding paths)
  findings: WiredFindingInput[];
  maxFindings?: number;
  override?: LlmOverride;
  onProgress?: (detail: string) => void;
}

/**
 * Run wired-unit tests against the booted app's image. Returns ranReal=false
 * (with a reason) when the image isn't a Node app, Node is too old, or no
 * finding's source file can be located in the image.
 */
export async function runWiredUnit(opts: RunWiredOptions): Promise<WiredResult> {
  const { image, projectPath, findings, onProgress } = opts;
  const max = Math.min(opts.maxFindings ?? 3, 5);
  const base: WiredResult = { ranReal: false, method: 'node-test-in-app-image', results: [] };

  const nodeMajor = await imageNodeMajor(image);
  base.nodeMajor = nodeMajor;
  if (nodeMajor < 18) {
    return { ...base, reason: nodeMajor === 0 ? 'App image has no Node runtime (wired-unit v1 supports Node apps).' : `App image Node ${nodeMajor} lacks the built-in test runner (need ≥18).` };
  }
  const workdir = (await imageWorkdir(image)).replace(/\/+$/, '') || '/app';
  base.workdir = workdir;

  // Only JS/TS findings with a locatable source file under the image workdir.
  const candidates = findings.filter((f) => f.filePath && JS_EXT.test(f.filePath)).slice(0, max * 2);
  let used = 0;
  for (const f of candidates) {
    if (used >= max) break;
    const rel = f.filePath.startsWith(projectPath)
      ? f.filePath.slice(projectPath.length).replace(/^[/\\]+/, '')
      : f.filePath.replace(/^[/\\]+/, '');
    const inContainer = `${workdir}/${rel}`.replace(/\\/g, '/');
    if (!(await fileExistsInImage(image, inContainer))) continue; // COPY layout differs → skip honestly

    used++;
    onProgress?.(`Wiring real code: ${rel}`);
    const gen = await generateWiredTest(f, inContainer, opts.override);
    if (!gen) { base.results.push({ finding: f.title, file: inContainer, total: 0, passed: 0, failed: 0, status: 'errored', detail: 'generation failed' }); continue; }

    const slug = (rel.replace(/[^a-z0-9]+/gi, '-') + '-l' + f.lineNumber).toLowerCase().replace(/^-+|-+$/g, '').slice(0, 80) || 'wired';
    const run = await runOneWired(image, gen.content, slug);
    if ('error' in run) { base.results.push({ finding: f.title, file: inContainer, total: 0, passed: 0, failed: 0, status: 'errored', detail: run.error }); continue; }
    const { total, passed, failed, failTail } = parseTap(run.tap);
    base.results.push({
      finding: f.title, file: inContainer, total, passed, failed,
      status: total === 0 ? 'errored' : failed > 0 ? 'failed' : 'passed',
      detail: total === 0 ? run.tap.trim().split('\n').slice(-10).join('\n').slice(-600) : failTail,
    });
  }

  if (base.results.length === 0) {
    return { ...base, reason: 'No finding had a source file locatable in the app image (non-standard COPY layout, or no JS/TS code findings).' };
  }
  base.ranReal = base.results.some((r) => r.total > 0);
  return base;
}
