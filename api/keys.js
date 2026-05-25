import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-User');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.DATABASE_URL) return res.json([]);

  const githubUser = req.headers['x-github-user'] || 'anonymous';
  const { neon } = await import('@neondatabase/serverless');
  const db = neon(process.env.DATABASE_URL);

  // GET: list keys
  if (req.method === 'GET') {
    const keys = await db`SELECT id, name, key_prefix, last_used, created_at FROM api_keys WHERE user_id = ${githubUser} AND revoked_at IS NULL ORDER BY created_at DESC`;
    return res.json(keys);
  }

  // POST: create key
  if (req.method === 'POST') {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });

    const key = 'tf_' + crypto.randomBytes(24).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = key.substring(0, 10) + '...';

    await db`INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (${githubUser}, ${name}, ${prefix}, ${keyHash})`;
    
    return res.json({ key, name, prefix, message: 'Save this key — it won\'t be shown again' });
  }

  // DELETE: revoke key
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await db`UPDATE api_keys SET revoked_at = NOW() WHERE id = ${id} AND user_id = ${githubUser}`;
    return res.json({ revoked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
