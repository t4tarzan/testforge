#!/usr/bin/env node
// TestForge Flywheel — one L0 cycle (the orchestrator hermes schedules).
//
// Pipeline (Flywheel.md §The L0 cycle):
//   1. GATHER   — run scan.mjs → findings.json (self + rotating showcase repo)
//   2. TRIAGE   — optional cheap local-model pass (TESTFORGE_TRIAGE command) to
//                 dedupe/cluster/drop noise; skipped if unset.
//   3. PROPOSE  — feed proposer-prompt + findings + ledger + recent changelog
//                 (+ roadmap/signals if present) to the brain (claude -p) → plan.
//   4. EMIT     — append the brain's "Ledger entries" to the ledger, save the
//                 full plan, and print the Telegram digest to STDOUT.
//
// stdout is *only* the digest, so hermes can drive this with
// `--no-agent --deliver telegram` (script stdout delivered verbatim). Everything
// else (logs, the full plan) goes to stderr / state files. A quiet cycle is a
// success — if the brain proposes nothing, the digest says so.
//
// Usage:
//   node hermes/cycle.mjs            # full cycle (scan → brain → ledger → digest)
//   node hermes/cycle.mjs --dry      # scan + assemble the brain bundle, but DON'T call the brain
//   node hermes/cycle.mjs --no-scan  # reuse the existing state/findings.json
//   node hermes/cycle.mjs --self-only
//
// Env:
//   TESTFORGE_BRAIN   brain command (default "claude -p"); receives the bundle on stdin
//   TESTFORGE_LEDGER  ledger path (default hermes/ledger.md; in prod point at the Obsidian note)
//   TESTFORGE_TRIAGE  optional triage command; receives findings.json on stdin, returns filtered JSON
//   TESTFORGE_MCP     analyzer base url (default http://localhost:33221)

import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STATE = path.join(__dirname, 'state');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const DRY = has('--dry');
const NO_SCAN = has('--no-scan');
const SELF_ONLY = has('--self-only');

const PROMPT_FILE = path.join(REPO_ROOT, 'docs', 'flywheel', 'proposer-prompt.md');
const FINDINGS = path.join(STATE, 'findings.json');
const LEDGER = process.env.TESTFORGE_LEDGER || path.join(__dirname, 'ledger.md');
const CHANGELOG = path.join(REPO_ROOT, 'src', 'data', 'changelog.ts');
const BRAIN = process.env.TESTFORGE_BRAIN || 'claude -p';

const log = (...a) => console.error('[cycle]', ...a);
const today = () => new Date().toISOString().slice(0, 10);

// ── 1. GATHER ────────────────────────────────────────────────────────────────
function runScan() {
  const args = [path.join(__dirname, 'scan.mjs')];
  if (SELF_ONLY) args.push('--self-only');
  log('gather: running scan.mjs…');
  const r = spawnSync(process.execPath, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error(`scan.mjs exited ${r.status}`);
}

// ── 2. TRIAGE (optional) ─────────────────────────────────────────────────────
function triage(bundleText) {
  const cmd = process.env.TESTFORGE_TRIAGE;
  if (!cmd) return bundleText;
  log(`triage: piping findings through "${cmd}"…`);
  const [bin, ...rest] = cmd.split(/\s+/);
  const r = spawnSync(bin, rest, { input: bundleText, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout?.trim()) {
    log('triage: no usable output — using raw findings');
    return bundleText;
  }
  return r.stdout;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function readIfExists(p, max = Infinity) {
  try {
    const t = fs.readFileSync(p, 'utf8');
    return max === Infinity ? t : t.split('\n').slice(0, max).join('\n');
  } catch { return null; }
}

// Newest changelog entries live near the top of the file; a slice is plenty of
// "what just shipped" context without parsing TS.
function recentChangelog() {
  const t = readIfExists(CHANGELOG, 160);
  return t ? t : '(changelog unavailable)';
}

function assembleBundle() {
  const prompt = readIfExists(PROMPT_FILE);
  if (!prompt) throw new Error(`proposer prompt missing at ${PROMPT_FILE}`);
  const findings = readIfExists(FINDINGS);
  if (!findings) throw new Error(`findings missing at ${FINDINGS} — run without --no-scan`);
  const ledger = readIfExists(LEDGER) || '(empty ledger — nothing proposed yet)';
  const roadmap = readIfExists(path.join(__dirname, 'roadmap.md'));
  const signals = readIfExists(path.join(STATE, 'signals.md')) || readIfExists(path.join(__dirname, 'signals.md'));

  return [
    prompt,
    '\n\n---\n# CYCLE INPUTS\n',
    `## findings.json\n\`\`\`json\n${triage(findings)}\n\`\`\``,
    `\n## ledger.md\n${ledger}`,
    `\n## changelog-recent.md\n\`\`\`ts\n${recentChangelog()}\n\`\`\``,
    roadmap ? `\n## roadmap.md\n${roadmap}` : '',
    signals ? `\n## signals.md\n${signals}` : '',
    `\n\nToday is ${today()}. Produce the output exactly in the shape specified above.`,
  ].join('\n');
}

// ── 3. PROPOSE (the brain) ───────────────────────────────────────────────────
function runBrain(bundle) {
  const [bin, ...rest] = BRAIN.split(/\s+/);
  log(`propose: invoking brain "${BRAIN}" (bundle ${bundle.length} chars)…`);
  return new Promise((resolve, reject) => {
    const child = spawn(bin, rest, { stdio: ['pipe', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`brain exited ${code}`));
      resolve(out);
    });
    child.stdin.write(bundle);
    child.stdin.end();
  });
}

// ── 4. EMIT ──────────────────────────────────────────────────────────────────
// Pull the Telegram digest — the proposer fences it; prefer the block starting 🛠.
function extractDigest(planText) {
  const blocks = [...planText.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1].trim());
  const tg = blocks.find((b) => b.includes('🛠') || /TestForge flywheel/i.test(b));
  if (tg) return tg;
  return `🛠 TestForge flywheel — ${today()}\nCycle ran; see the full plan in the vault.`;
}

// Pull "- <date> | proposed|shipped|rejected | …" lines under the ledger heading.
function extractLedgerEntries(planText) {
  const idx = planText.search(/Ledger entries to append/i);
  const region = idx === -1 ? planText : planText.slice(idx);
  return [...region.matchAll(/^\s*[-*]\s+(.*\|\s*(?:proposed|shipped|rejected)\s*\|.*)$/gim)]
    .map((m) => '- ' + m[1].trim());
}

function appendLedger(entries) {
  if (!entries.length) { log('emit: no ledger entries to append (quiet cycle)'); return; }
  const stamp = `\n<!-- ${new Date().toISOString()} -->\n` + entries.join('\n') + '\n';
  fs.appendFileSync(LEDGER, stamp);
  log(`emit: appended ${entries.length} ledger entr${entries.length === 1 ? 'y' : 'ies'} → ${LEDGER}`);
}

async function main() {
  fs.mkdirSync(STATE, { recursive: true });
  if (!NO_SCAN) runScan();

  const bundle = assembleBundle();

  if (DRY) {
    const out = path.join(STATE, 'last-bundle.md');
    fs.writeFileSync(out, bundle);
    log(`DRY RUN — wrote brain bundle to ${out} (${bundle.length} chars). Brain NOT invoked.`);
    return;
  }

  const plan = await runBrain(bundle);
  fs.writeFileSync(path.join(STATE, 'last-plan.md'), plan);

  appendLedger(extractLedgerEntries(plan));

  const digest = extractDigest(plan);
  fs.writeFileSync(path.join(STATE, 'last-digest.txt'), digest + '\n');
  log('emit: digest →');
  process.stdout.write(digest + '\n'); // stdout = what hermes --no-agent delivers
}

main().catch((e) => { log('FATAL:', e.message); process.exit(1); });
