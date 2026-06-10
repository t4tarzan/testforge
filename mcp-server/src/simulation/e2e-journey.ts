// E2E Phase 2 — LLM-authored user journeys. Capture the booted app's interaction
// surface (snapshot.mjs), ask the model to author N realistic journeys as a
// constrained STEP DSL (not raw code), then execute each deterministically in
// the Playwright container (journey.mjs). The model decides *what* to test; a
// fixed executor decides *how* — so there's no arbitrary LLM code in the browser.
import { spawn } from 'child_process';
import { generateObject } from 'ai';
import { z } from 'zod';
import { providerFor, PRIMARY_MODEL, FALLBACK_MODEL } from '../generator/llm-client.js';
import type { LlmOverride } from '../generator/generate-tests.js';
import { E2E_IMAGE } from './e2e-crawl.js';
import type { Sandbox } from './sandbox.js';

const STEP_TIMEOUT_MS = Number(process.env.TESTFORGE_E2E_TIMEOUT_MS) || 180_000;

export interface JourneyStepResult { action: string; target?: string; ok: boolean; error?: string }
export interface JourneyResult { name: string; ok: boolean; steps: JourneyStepResult[]; reason?: string }
export interface E2EJourneysResult {
  ranReal: boolean;
  reason?: string;
  journeysRun?: number;
  journeysPassed?: number;
  journeys?: JourneyResult[];
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

function lastJson(s: string): unknown {
  const line = s.trim().split('\n').filter(Boolean).pop() || '';
  return JSON.parse(line);
}

const stepSchema = z.object({
  action: z.enum(['goto', 'click', 'fill', 'expectText', 'expectUrl']),
  path: z.string().optional().describe('for goto: path relative to base, e.g. "/login"'),
  text: z.string().optional().describe('for click: visible text of the element'),
  selector: z.string().optional().describe('for click/fill: a CSS selector (prefer text for click)'),
  value: z.string().optional().describe('for fill: the value to type'),
  contains: z.string().optional().describe('for expectUrl: substring the URL should contain'),
});
const journeysSchema = z.object({
  journeys: z.array(z.object({
    name: z.string().describe('short human name for the journey'),
    steps: z.array(stepSchema).min(2).max(12),
  })).min(1).max(5),
});

const SYSTEM = `You are a QA engineer authoring end-to-end user journeys for a web app.
You are given the app's real interaction surface (title, headings, links, buttons, forms).
Output journeys as JSON using ONLY this step DSL (no code):
- { action:"goto", path } — navigate to a path relative to the site root.
- { action:"click", text } — click the element with this visible text (prefer this); or { action:"click", selector } with a CSS selector.
- { action:"fill", selector, value } — type value into the input matched by selector.
- { action:"expectText", text } — assert the page contains this text.
- { action:"expectUrl", contains } — assert the current URL contains this substring.
Rules:
- Use ONLY links/buttons/inputs that appear in the surface — do not invent routes or fields.
- Each journey starts with a goto and ends with at least one expectText or expectUrl.
- Keep journeys short (2–8 steps) and realistic (what a real user would do).`;

async function captureSurface(sb: Sandbox): Promise<Record<string, unknown> | null> {
  const target = `http://${sb.appHost}:${sb.targetPort}/`;
  const r = await docker(['run', '--rm', '--network', sb.netName, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '2g', '--shm-size', '512m', E2E_IMAGE, 'node', '/e2e/snapshot.mjs', target], STEP_TIMEOUT_MS);
  try { const j = lastJson(r.stdout) as { ok: boolean; surface: Record<string, unknown> }; return j.ok ? j.surface : null; } catch { return null; }
}

async function runOneJourney(sb: Sandbox, steps: unknown[]): Promise<{ ok: boolean; results: JourneyStepResult[] }> {
  const target = `http://${sb.appHost}:${sb.targetPort}/`;
  const b64 = Buffer.from(JSON.stringify(steps), 'utf8').toString('base64');
  const r = await docker(['run', '--rm', '--network', sb.netName, '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '2g', '--shm-size', '512m', E2E_IMAGE, 'node', '/e2e/journey.mjs', target, b64], STEP_TIMEOUT_MS);
  try { return lastJson(r.stdout) as { ok: boolean; results: JourneyStepResult[] }; } catch { return { ok: false, results: [{ action: 'run', ok: false, error: (r.stderr.trim() || 'no output').slice(-180) }] }; }
}

export interface RunJourneysOptions {
  count?: number;
  override?: LlmOverride;
  onProgress?: (detail: string) => void;
  /** Recently-changed files (change-driven QA) — bias journeys toward what changed. */
  changedHint?: string[];
}

/** Render the changed-files hint appended to the author prompt (empty when none). */
export function changedHintBlock(changedHint?: string[]): string {
  if (!changedHint?.length) return '';
  const list = changedHint.slice(0, 40).map((f) => `- ${f}`).join('\n');
  return `\n\nThese files changed recently — PRIORITIZE journeys that exercise the user-facing functionality they affect (skip ones unrelated to the change):\n${list}`;
}

/** Capture surface → LLM authors journeys → execute each. ranReal=false (reason) if surface capture or generation yields nothing. */
export async function runE2EJourneys(sb: Sandbox, opts: RunJourneysOptions = {}): Promise<E2EJourneysResult> {
  const count = Math.min(Math.max(opts.count ?? 2, 1), 5);
  opts.onProgress?.('Capturing the app surface for journeys');
  const surface = await captureSurface(sb);
  if (!surface) return { ranReal: false, reason: 'could not capture the app surface (page did not load).' };

  opts.onProgress?.('Authoring user journeys');
  let journeys: { name: string; steps: unknown[] }[] = [];
  const provider = providerFor(opts.override);
  for (const model of [opts.override?.primaryModel || PRIMARY_MODEL, opts.override?.fallbackModel || FALLBACK_MODEL]) {
    if (!model) continue;
    try {
      const { object } = await generateObject({
        model: provider.chat(model), schema: journeysSchema, system: SYSTEM,
        prompt: `App interaction surface:\n${JSON.stringify(surface, null, 2)}\n\nAuthor ${count} realistic user journey(s).${changedHintBlock(opts.changedHint)}`,
        temperature: 0.3, maxRetries: 1,
      });
      journeys = object.journeys.slice(0, count);
      break;
    } catch { /* try fallback */ }
  }
  if (journeys.length === 0) return { ranReal: false, reason: 'journey generation failed.' };

  const results: JourneyResult[] = [];
  for (const j of journeys) {
    opts.onProgress?.(`Running journey: ${j.name}`);
    const run = await runOneJourney(sb, j.steps);
    results.push({ name: j.name, ok: run.ok, steps: run.results });
  }
  return {
    ranReal: true,
    journeysRun: results.length,
    journeysPassed: results.filter((r) => r.ok).length,
    journeys: results,
  };
}
