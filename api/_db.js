// Shared DB utility for Vercel API functions (CommonJS)
let _db = null;
let _initError = false;

function getDb() {
  if (_db) return _db;
  if (_initError) return null;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    const postgres = require('postgres');
    const { drizzle } = require('drizzle-orm/postgres-js');
    
    const client = postgres(url, {
      max: 5,
      idle_timeout: 10,
      connect_timeout: 5,
    });
    _db = drizzle(client);
    console.log('[DB] Connected to Neon PostgreSQL');
    return _db;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    _initError = true;
    return null;
  }
}

module.exports = { getDb };
