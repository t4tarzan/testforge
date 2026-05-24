// Shared DB utility for Vercel API functions
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

let _db = null;

export function getDb() {
  if (_db) return _db;
  
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  
  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  _db = drizzle(client);
  return _db;
}
