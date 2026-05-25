-- ─────────────────────────────────────────────────────────────────────────
--  TestForge schema upgrade — v0 (pre-launch) → v1 (multi-user safe)
--  Run ONCE against the existing Neon DB. Safe to re-run (idempotent guards).
--
--  What this fixes:
--    • projects.user_id was missing → API queries threw "column does not exist"
--    • test_runs.user_id was missing → /api/history could not scope per user
--    • api_keys table did not exist → /api/keys was completely broken
--    • projects had a global unique(name) — two users couldn't have repos
--      with the same name. Replaced with unique(user_id, name).
--
--  How to apply:
--    A) Neon SQL Editor — paste this whole file, run.
--    B) From your machine with DATABASE_URL set:
--         psql "$DATABASE_URL" -f scripts/migrate-to-v1.sql
--    C) Drizzle: `npm run db:push` also works (it diffs schema.ts vs live DB).
--
--  After running this, the drizzle/0000_init.sql baseline matches reality.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. projects.user_id (nullable; FK -> users.id, cascade on delete)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);

-- Replace the global unique(name) with a per-user unique(user_id, name).
-- Drop only if it exists under either possible auto-generated name.
DROP INDEX IF EXISTS projects_name_idx;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_unique;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS projects_user_name_idx
  ON projects (user_id, name);

-- 2. test_runs.user_id (nullable; denormalized for fast /api/history filtering)
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS test_runs_user_id_idx ON test_runs (user_id);

-- 3. api_keys table (was referenced by /api/keys but never created)
CREATE TABLE IF NOT EXISTS api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,
  key_prefix  varchar(20)  NOT NULL,
  key_hash    varchar(128) NOT NULL,
  last_used   timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX        IF NOT EXISTS api_keys_user_id_idx   ON api_keys (user_id);

COMMIT;
