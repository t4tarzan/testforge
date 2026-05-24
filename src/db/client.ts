import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function getEnvVar(key: string): string | undefined {
  try {
    // Vite / browser
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return (import.meta.env as Record<string, string>)[key];
    }
  } catch { /* not in Vite */ }
  try {
    // Node.js
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeEnv = (globalThis as any).process?.env;
    if (nodeEnv) return nodeEnv[key];
  } catch { /* not in Node */ }
  return undefined;
}

export function createClient(connectionString?: string) {
  const url = connectionString || getEnvVar('VITE_DATABASE_URL') || getEnvVar('DATABASE_URL') || '';
  
  if (!url) {
    console.warn('DATABASE_URL not set — using in-memory mock database');
    return null;
  }

  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export type DB = ReturnType<typeof createClient>;
export { schema };
