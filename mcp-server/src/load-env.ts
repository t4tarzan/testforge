// Minimal .env loader (no dependency). Reads `~/.testforge/.env` — the file the
// `setup` wizard writes — into process.env WITHOUT overriding variables already
// set in the real environment (explicit env / Docker `-e` always wins). Called
// once at the very top of the server bootstrap, before any env var is read.
import { readFileSync, existsSync } from 'fs';
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
