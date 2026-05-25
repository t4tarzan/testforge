// /api/keys — list, create, revoke personal API keys.
// Always scoped to the signed-in user via the session JWT cookie.
import crypto from 'crypto';
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';

async function handler(req, res) {
  const session = await requireSession(req, res);
  if (!session) return; // 401 already sent

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(process.env.DATABASE_URL);
  const userId = session.userId;

  if (req.method === 'GET') {
    const keys = await db`
      SELECT id, name, key_prefix, last_used, created_at
      FROM api_keys
      WHERE user_id = ${userId} AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    return res.json(keys);
  }

  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const key = 'tf_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 10) + '...';

    await db`
      INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
      VALUES (${userId}, ${name}, ${prefix}, ${keyHash})
    `;
    return res.json({
      key,
      name,
      prefix,
      message: "Save this key — it won't be shown again",
    });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await db`
      UPDATE api_keys SET revoked_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;
    return res.json({ revoked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withSecurity(handler);
