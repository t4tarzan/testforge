// Interactive setup wizard — `npx @whitenoisenpm/testforge-mcp setup`.
//
// A small guided "configuration menu" for self-hosters: picks an AI provider
// (OpenRouter / local model server / none), wires the Tier-2 secret and port,
// and writes it all to ~/.testforge/.env (chmod 600), which the server loads on
// startup. No third-party deps — just Node's readline + crypto.
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { CONFIG_DIR, ENV_FILE } from './load-env.js';

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', purple: '\x1b[35m',
};
const b = (s: string) => `${c.bold}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

function parseExisting(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(ENV_FILE)) return out;
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

export async function runSetup(): Promise<void> {
  // Robust line reader: buffer every `line` event into a queue so it works with
  // a real TTY (one line per Enter) AND with piped/redirected input (many lines
  // in one chunk) — readline/promises' question() drops the latter.
  const rl = createInterface({ input: stdin });
  const queue: string[] = [];
  let waiter: ((v: string) => void) | null = null;
  let closed = false;
  rl.on('line', (l) => { if (waiter) { const w = waiter; waiter = null; w(l); } else queue.push(l); });
  rl.on('close', () => { closed = true; if (waiter) { const w = waiter; waiter = null; w(''); } });
  const nextLine = (): Promise<string> => {
    if (queue.length) return Promise.resolve(queue.shift() as string);
    if (closed) return Promise.resolve('');
    return new Promise((res) => { waiter = res; });
  };
  const ask = async (q: string, def = ''): Promise<string> => {
    const suffix = def ? dim(` [${def}]`) : '';
    stdout.write(`${q}${suffix} `);
    const a = (await nextLine()).trim();
    return a || def;
  };
  const choose = async (q: string, opts: string[], def = 1): Promise<number> => {
    console.log(`\n${b(q)}`);
    opts.forEach((o, i) => console.log(`  ${c.cyan}${i + 1}${c.reset}) ${o}`));
    while (true) {
      stdout.write(dim(`Choose 1-${opts.length} `) + `[${def}] `);
      const a = (await nextLine()).trim() || String(def);
      const n = parseInt(a, 10);
      if (n >= 1 && n <= opts.length) return n;
      console.log(c.yellow + `  Please enter a number 1-${opts.length}.` + c.reset);
    }
  };

  const existing = parseExisting();
  const env: Record<string, string> = { ...existing };

  console.log(`\n${c.purple}${b('  TestForge MCP — setup')}${c.reset}`);
  console.log(dim('  Configures a self-hosted MCP server. Writes ~/.testforge/.env (chmod 600).'));
  if (Object.keys(existing).length) {
    console.log(dim(`  Found existing config (${Object.keys(existing).length} keys) — press Enter to keep current values.`));
  }

  // ── 1. AI provider for Tier-2 (LLM test generation) ──
  console.log(`\n${dim('Tier-1 analysis (22 dimensions) needs no AI. Tier-2 GENERATES & RUNS tests and needs a model.')}`);
  const provider = await choose('AI provider for Tier-2 test generation', [
    `${b('OpenRouter')} ${dim('(cloud — one key for DeepSeek/Kimi/etc.)')}`,
    `${b('Local model server')} ${dim('(Ollama / LM Studio / vLLM — OpenAI-compatible, free, private)')}`,
    `${b('Skip')} ${dim('(Tier-1 only for now — configure later)')}`,
  ], existing.TESTFORGE_LLM_BASE_URL ? 2 : 1);

  if (provider === 1) {
    console.log(dim('\n  Get a key at https://openrouter.ai/keys'));
    const key = await ask('OpenRouter API key:', existing.OPENROUTER_API_KEY || '');
    if (key) env.OPENROUTER_API_KEY = key;
    delete env.TESTFORGE_LLM_BASE_URL;
    delete env.TESTFORGE_LLM_API_KEY;
    const adv = await ask('Override default models? (y/N):', 'N');
    if (/^y/i.test(adv)) {
      env.TESTFORGE_PRIMARY_MODEL = await ask('  Primary model:', existing.TESTFORGE_PRIMARY_MODEL || 'deepseek/deepseek-v4-flash');
      env.TESTFORGE_FALLBACK_MODEL = await ask('  Fallback model:', existing.TESTFORGE_FALLBACK_MODEL || 'moonshotai/kimi-k2.6');
    }
  } else if (provider === 2) {
    const kind = await choose('Which local server?', [
      `Ollama ${dim('(http://localhost:11434/v1)')}`,
      `LM Studio ${dim('(http://localhost:1234/v1)')}`,
      `Other OpenAI-compatible (custom URL)`,
    ], 1);
    const defUrl = kind === 1 ? 'http://localhost:11434/v1' : kind === 2 ? 'http://localhost:1234/v1' : (existing.TESTFORGE_LLM_BASE_URL || 'http://localhost:8000/v1');
    env.TESTFORGE_LLM_BASE_URL = await ask('Base URL:', defUrl);
    console.log(dim('  NOTE: if the MCP runs in Docker, use http://host.docker.internal:<port>/v1 to reach a host model server.'));
    const model = await ask('Model name (as your server lists it):', existing.TESTFORGE_PRIMARY_MODEL || (kind === 1 ? 'qwen2.5-coder:14b' : 'local-model'));
    env.TESTFORGE_PRIMARY_MODEL = model;
    env.TESTFORGE_FALLBACK_MODEL = await ask('Fallback model:', existing.TESTFORGE_FALLBACK_MODEL || model);
    const key = await ask('API key (blank if your server needs none):', existing.TESTFORGE_LLM_API_KEY || '');
    if (key) env.TESTFORGE_LLM_API_KEY = key; else delete env.TESTFORGE_LLM_API_KEY;
    delete env.OPENROUTER_API_KEY;
  } else {
    console.log(dim('  Skipping AI — Tier-1 (clone-and-analyze) works without it. Re-run `setup` anytime.'));
  }

  // ── 2. Tier-2 run secret (gates generate-and-run / simulate) ──
  if (provider !== 3) {
    console.log(`\n${dim('Tier-2 endpoints are gated by a bearer secret so only you can trigger test runs.')}`);
    const cur = existing.TESTFORGE_RUN_SECRET;
    const sec = await choose('Run secret', [
      cur ? `Keep existing ${dim('(•••' + cur.slice(-4) + ')')}` : `Generate a strong random one ${dim('(recommended)')}`,
      'Enter my own',
      'None (leave Tier-2 ungated — local single-user only)',
    ], 1);
    if (sec === 1) env.TESTFORGE_RUN_SECRET = cur || randomBytes(24).toString('hex');
    else if (sec === 2) env.TESTFORGE_RUN_SECRET = await ask('  Secret:', cur || '');
    else delete env.TESTFORGE_RUN_SECRET;
  }

  // ── 3. Port ──
  env.TESTFORGE_MCP_PORT = await ask('\nPort to bind:', existing.TESTFORGE_MCP_PORT || '33221');

  // ── 4. Write ──
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  const ORDER = ['OPENROUTER_API_KEY', 'TESTFORGE_LLM_BASE_URL', 'TESTFORGE_LLM_API_KEY', 'TESTFORGE_PRIMARY_MODEL', 'TESTFORGE_FALLBACK_MODEL', 'TESTFORGE_RUN_SECRET', 'TESTFORGE_MCP_PORT'];
  const keys = [...ORDER.filter((k) => k in env), ...Object.keys(env).filter((k) => !ORDER.includes(k))];
  const body = [
    '# TestForge MCP config — generated by `testforge-mcp setup`.',
    '# Real environment variables (e.g. Docker -e) override these.',
    ...keys.map((k) => `${k}=${env[k]}`),
    '',
  ].join('\n');
  writeFileSync(ENV_FILE, body, { mode: 0o600 });
  try { chmodSync(ENV_FILE, 0o600); } catch { /* best-effort on non-POSIX */ }

  rl.close();

  // ── 5. Next steps ──
  const port = env.TESTFORGE_MCP_PORT;
  console.log(`\n${c.green}${b('  ✓ Saved ' + ENV_FILE)}${c.reset}`);
  console.log(dim('  Database: a local SQLite history file is auto-created at ~/.testforge/history.db — no DB setup needed.\n'));
  console.log(b('  Start the server:'));
  console.log(`    ${c.cyan}npx -y @whitenoisenpm/testforge-mcp${c.reset}   ${dim('# reads the config above')}`);
  console.log(`\n  ${b('Health check:')} ${dim(`curl localhost:${port}/health`)}`);
  console.log(`\n  ${b('Add to an MCP client')} ${dim('(Claude Desktop / Cursor) — mcpServers entry:')}`);
  console.log(dim(`    "testforge": { "command": "npx", "args": ["-y", "@whitenoisenpm/testforge-mcp"] }`));
  console.log(dim(`\n  Full env reference: testforge-mcp --help\n`));
}
