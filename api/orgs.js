// Organization management API
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.DATABASE_URL) return res.json([]);

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const orgs = await db`SELECT * FROM organizations ORDER BY created_at DESC`;
      return res.json(orgs);
    }

    if (req.method === 'POST') {
      const { name, slug } = req.body || {};
      if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
      const org = await db`
        INSERT INTO organizations (name, slug) VALUES (${name}, ${slug})
        RETURNING *
      `;
      return res.json(org[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
