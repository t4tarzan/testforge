// Minimal .env loader (no dependency). Reads `~/.testforge/.env` — the file the
// `setup` wizard writes — into process.env WITHOUT overriding variables already
// set in the real environment (explicit env / Docker `-e` always wins). Called
// once at the very top of the server bootstrap, before any env var is read.
import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export const CONFIG_DIR = join(homedir(), '.testforge');
export const ENV_FILE = join(CONFIG_DIR, '.env');

// Keys whose values came from ~/.testforge/.env (the local setup wizard) rather
// than the real environment. Used to distinguish a LOCAL self-host config (file)
// from a MANAGED/exposed deployment (real Docker env) — e.g. so a file-sourced
// run secret never locks a local user out of their own dashboard.
const fileLoadedKeys = new Set<string>();

/** True if `key`'s value was loaded from the config file (not the real env). */
export function isFromEnvFile(key: string): boolean {
  return fileLoadedKeys.has(key);
}

export function loadEnvFile(file: string = ENV_FILE): { loaded: boolean; keys: string[] } {
  if (!existsSync(file)) return { loaded: false, keys: [] };
  const keys: string[] = [];
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return { loaded: false, keys: [] };
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!key) continue;
    if (process.env[key] === undefined) {
      process.env[key] = val;
      keys.push(key);
      fileLoadedKeys.add(key);
    }
  }
  return { loaded: true, keys };
}

/** Parse the config file into a plain object (or {} if absent). */
export function readEnvFile(file: string = ENV_FILE): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  try {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      out[line.slice(0, eq).trim()] = val;
    }
  } catch { /* ignore */ }
  return out;
}

const WRITE_ORDER = ['OPENROUTER_API_KEY', 'TESTFORGE_LLM_BASE_URL', 'TESTFORGE_LLM_API_KEY', 'TESTFORGE_PRIMARY_MODEL', 'TESTFORGE_FALLBACK_MODEL', 'TESTFORGE_RUN_SECRET', 'TESTFORGE_MCP_PORT'];

/**
 * Merge `updates` into the config file and write it back (chmod 600). A value of
 * null/undefined DELETES that key. Also mirrors the change into process.env and
 * the file-loaded-keys set so the running server reflects it immediately.
 */
export function writeEnvFile(updates: Record<string, string | null | undefined>, file: string = ENV_FILE): void {
  const merged = readEnvFile(file);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === '') {
      delete merged[k];
      delete process.env[k];
      fileLoadedKeys.delete(k);
    } else {
      merged[k] = v;
      process.env[k] = v;
      fileLoadedKeys.add(k);
    }
  }
  const keys = [...WRITE_ORDER.filter((k) => k in merged), ...Object.keys(merged).filter((k) => !WRITE_ORDER.includes(k))];
  const body = [
    '# TestForge MCP config — managed by the setup wizard / settings panel.',
    '# Real environment variables (e.g. Docker -e) override these.',
    ...keys.map((k) => `${k}=${merged[k]}`),
    '',
  ].join('\n');
  const dir = join(homedir(), '.testforge');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(file, body, { mode: 0o600 });
  try { chmodSync(file, 0o600); } catch { /* best-effort on non-POSIX */ }
}
