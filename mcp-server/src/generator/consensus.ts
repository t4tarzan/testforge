// Source-grounded, multi-model consensus verification of TestForge findings.
//
// TestForge Tier-1 is static/heuristic and JS/TS-centric, so on polyglot repos
// many findings are false or mis-scoped. This re-checks each finding by feeding
// the ACTUAL source (route files for flow findings, manifests for dep findings)
// to two independent models and keeping only the ones BOTH confirm present.
//
// Reads source under projectPath directly (the analyzed tree is on this box).
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { generateText } from 'ai';
import { openrouter } from './llm-client.js';

const IGNORE_DIR = /^(node_modules|\.git|\.venv|venv|__pycache__|dist|build|\.next|coverage|\.tox|\.pytest_cache|vendor|\.turbo)$/;
const SRC_EXT = /\.(py|ts|tsx|js|jsx|mjs|cjs)$/;
const MAX_SOURCE_FILES = 2500;       // bound the walk (vendor already excluded)
const MAX_FILE_BYTES = 200_000;

export interface ConsensusFinding {
  title: string; description?: string; severity?: string; rule?: string;
  filePath?: string; lineNumber?: number; fixSuggestion?: string; dimension?: string;
}
export interface ModelVerdict { model: string; present: boolean | null; confidence: string; evidence: string; }
export interface FindingConsensus { finding: ConsensusFinding; verdicts: ModelVerdict[]; consensus: 'confirmed' | 'rejected' | 'split'; }

export function consensusModels(): string[] {
  const env = process.env.TESTFORGE_CONSENSUS_MODELS;
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return ['anthropic/claude-sonnet-4.6', 'qwen/qwen3.7-max'];
}

/* ── Source index (read the project's non-vendor source once per request) ── */
type SourceIndex = { rel: string; abs: string; content: string }[];
function buildSourceIndex(root: string): SourceIndex {
  const out: SourceIndex = [];
  const walk = (dir: string) => {
    if (out.length >= MAX_SOURCE_FILES) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (IGNORE_DIR.test(e)) continue;
      const abs = join(dir, e);
      let s; try { s = statSync(abs); } catch { continue; }
      if (s.isDirectory()) walk(abs);
      else if (SRC_EXT.test(e) && s.size <= MAX_FILE_BYTES) {
        if (out.length >= MAX_SOURCE_FILES) return;
        try { out.push({ rel: abs.slice(root.length + 1), abs, content: readFileSync(abs, 'utf8') }); } catch { /* skip */ }
      }
    }
  };
  walk(root);
  return out;
}

function keywords(f: ConsensusFinding): string[] {
  const stop = new Set(['this','that','with','from','have','your','should','detected','found','package','endpoints','particular','without','code','dependency','convention']);
  return [...new Set(`${f.title} ${f.rule || ''}`.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])]
    .filter((w) => !stop.has(w)).slice(0, 6);
}
function fileExcerpt(rel: string, content: string, kw: string[]): string {
  const lines = content.split('\n');
  const num = (a: number, b: number) => lines.slice(a, b).map((t, i) => `${a + i + 1}: ${t}`).join('\n');
  if (lines.length <= 220) return `--- ${rel} (full, ${lines.length} lines) ---\n${num(0, lines.length).slice(0, 7000)}`;
  const re = kw.length ? new RegExp(kw.join('|'), 'i') : null;
  const hits = re ? lines.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0).slice(0, 4) : [];
  if (!hits.length) return `--- ${rel} (head, ${lines.length} lines) ---\n${num(0, 120).slice(0, 6000)}`;
  return `--- ${rel} (match regions of ${lines.length} lines) ---\n${hits.map((h) => num(Math.max(0, h - 15), h + 16)).join('\n   …\n').slice(0, 7000)}`;
}
// Prioritized: for flow findings, surface the real route + limiter files.
const FLOW_RE = /auth|login|signin|signup|token|rate|limit|cors|header|cookie|session|csrf|inject|sql|ssrf|xss|brute|endpoint|caching/i;
const AUTH_ROUTE_RE = /@(router|app)\.(post|get|put|delete)|def\s+(login|signin|signup|register|authenticate)/;
const LIMITER_RE = /SlowAPIMiddleware|class\s+Limiter|ip_limit|enforce_ip_rate_limit|@limiter|core\.rate_limit|RateLimit|429|express-rate-limit/;
function relevantFiles(f: ConsensusFinding, idx: SourceIndex): SourceIndex {
  const picked: SourceIndex = [];
  const add = (arr: SourceIndex) => { for (const x of arr) if (!picked.includes(x)) picked.push(x); };
  if (FLOW_RE.test(`${f.title} ${f.rule || ''}`)) {
    add(idx.filter((x) => /auth/i.test(x.rel) && AUTH_ROUTE_RE.test(x.content)).slice(0, 2));
    add(idx.filter((x) => LIMITER_RE.test(x.content)).slice(0, 2));
  }
  const kw = keywords(f);
  if (kw.length) {
    const re = new RegExp(kw.join('|'), 'i');
    add(idx.filter((x) => re.test(x.content)).slice(0, 3));
  }
  return picked.slice(0, 5);
}
function manifests(root: string): string {
  const parts: string[] = [];
  for (const m of ['package.json', 'frontend/package.json', 'backend/pyproject.toml', 'backend/requirements.txt', 'pyproject.toml', 'requirements.txt']) {
    const p = join(root, m);
    if (existsSync(p)) { try { parts.push(`--- ${m} ---\n${readFileSync(p, 'utf8').slice(0, 1200)}`); } catch { /* skip */ } }
  }
  return parts.join('\n\n');
}
function evidenceFor(f: ConsensusFinding, root: string, idx: SourceIndex): { type: string; text: string } {
  const kw = keywords(f);
  // File-specific finding → window around the cited line.
  if (f.filePath) {
    const hit = idx.find((x) => x.abs === f.filePath || x.abs.endsWith(f.filePath!) || x.rel === f.filePath);
    if (hit) {
      const lines = hit.content.split('\n');
      const a = Math.max(0, (f.lineNumber || 1) - 41), b = Math.min(lines.length, (f.lineNumber || 1) + 40);
      return { type: `file ${hit.rel}`, text: lines.slice(a, b).map((t, i) => `${a + i + 1}: ${t}`).join('\n').slice(0, 12000) };
    }
  }
  // Project-level → manifests + the most relevant source files.
  const parts = [manifests(root), ...relevantFiles(f, idx).map((x) => fileExcerpt(x.rel, x.content, kw))];
  return { type: 'project-level', text: parts.filter(Boolean).join('\n\n').slice(0, 18000) };
}

/* ── Model verdict ── */
const SYS = `You are a precise, skeptical code auditor. You are given a STATIC-ANALYSIS finding and the ACTUAL code/context from the real repository. Many static findings are mis-scoped, wrong-language, or already mitigated. Decide ONLY from the evidence whether the described bug is genuinely present in THIS codebase. Respond with ONLY a JSON object: {"present": true|false, "confidence": "high"|"medium"|"low", "evidence": "one or two sentences citing specific lines/files or what is missing"}.`;
async function verdict(model: string, f: ConsensusFinding, ev: { type: string; text: string }): Promise<ModelVerdict> {
  const prompt = `FINDING\n- title: ${f.title}\n- dimension: ${f.dimension || ''}\n- severity: ${f.severity || ''}\n- rule: ${f.rule || ''}\n- description: ${f.description || ''}\n- suggested fix: ${f.fixSuggestion || ''}\n- cited path: ${f.filePath || '(project-level)'}\n\nEVIDENCE (${ev.type}) from the real repo:\n${ev.text || '(none)'}\n\nIs this bug genuinely present in THIS code? JSON only.`;
  try {
    const { text } = await generateText({ model: openrouter.chat(model), system: SYS, prompt, temperature: 0, maxRetries: 1 });
    let t = text.trim();
    const s = t.indexOf('{'), e = t.lastIndexOf('}');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    const v = JSON.parse(t);
    return { model, present: !!v.present, confidence: String(v.confidence || '?'), evidence: String(v.evidence || '').slice(0, 400) };
  } catch (err) {
    return { model, present: null, confidence: 'error', evidence: String((err as Error).message).slice(0, 160) };
  }
}

export async function runConsensus(projectPath: string, findings: ConsensusFinding[], modelsOverride?: string[]): Promise<FindingConsensus[]> {
  const models = (modelsOverride && modelsOverride.length ? modelsOverride : consensusModels()).slice(0, 4);
  const idx = buildSourceIndex(projectPath);
  const out: FindingConsensus[] = [];
  for (const f of findings) {
    const ev = evidenceFor(f, projectPath, idx);
    const verdicts = await Promise.all(models.map((m) => verdict(m, f, ev)));
    const yes = verdicts.filter((v) => v.present === true).length;
    const no = verdicts.filter((v) => v.present === false).length;
    const consensus = yes === verdicts.length ? 'confirmed' : (no === verdicts.length ? 'rejected' : 'split');
    out.push({ finding: f, verdicts, consensus });
  }
  return out;
}
