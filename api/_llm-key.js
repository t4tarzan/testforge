// Per-user BYOK LLM key storage (managed Tier-2 with the user's own key).
// Self-bootstrapping table so no manual migration is needed on prod. The key is
// stored ENCRYPTED (AES-256-GCM via _crypto); only a mask is ever returned to
// the client, and the plaintext is decrypted server-side only to forward it to
// the MCP for a single generation.
import { encryptSecret, decryptSecret, maskKey } from './_crypto.js';

async function getDb() {
  const { neon } = await import('@neondatabase/serverless');
  return neon(process.env.DATABASE_URL);
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS user_llm_keys (
      user_id uuid PRIMARY KEY,
      key_enc text NOT NULL,
      key_mask varchar(40),
      base_url text,
      model varchar(120),
      updated_at timestamptz DEFAULT now()
    )`;
}

/** Display metadata only — never decrypts. */
export async function getUserLlmKeyMeta(userId) {
  const sql = await getDb();
  await ensureTable(sql);
  const rows = await sql`SELECT key_mask, base_url, model, updated_at FROM user_llm_keys WHERE user_id = ${userId} LIMIT 1`;
  if (!rows.length) return { set: false };
  return { set: true, mask: rows[0].key_mask, baseUrl: rows[0].base_url || '', model: rows[0].model || '', updatedAt: rows[0].updated_at };
}

/** Decrypts — server-side only, for forwarding to the MCP. Returns null if none. */
export async function getUserLlmKey(userId) {
  const sql = await getDb();
  await ensureTable(sql);
  const rows = await sql`SELECT key_enc, key_mask, base_url, model FROM user_llm_keys WHERE user_id = ${userId} LIMIT 1`;
  if (!rows.length) return null;
  try {
    return { apiKey: decryptSecret(rows[0].key_enc), mask: rows[0].key_mask, baseUrl: rows[0].base_url || '', model: rows[0].model || '' };
  } catch {
    return null; // undecryptable (e.g. SESSION_SECRET rotated) → treat as unset
  }
}

export async function setUserLlmKey(userId, apiKey, baseUrl, model) {
  const sql = await getDb();
  await ensureTable(sql);
  const enc = encryptSecret(apiKey);
  const mask = maskKey(apiKey);
  await sql`
    INSERT INTO user_llm_keys (user_id, key_enc, key_mask, base_url, model, updated_at)
    VALUES (${userId}, ${enc}, ${mask}, ${baseUrl || null}, ${model || null}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET key_enc = ${enc}, key_mask = ${mask}, base_url = ${baseUrl || null}, model = ${model || null}, updated_at = now()`;
  return mask;
}

export async function deleteUserLlmKey(userId) {
  const sql = await getDb();
  await ensureTable(sql);
  await sql`DELETE FROM user_llm_keys WHERE user_id = ${userId}`;
}
