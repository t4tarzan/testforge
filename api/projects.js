const SEED = [{
  id: 'proj_001', name: 'express-ecommerce-api',
  repoUrl: 'https://github.com/example/express-ecommerce-api',
  localPath: '/projects/express-ecommerce-api', branch: 'main',
  techStack: ['Node.js', 'Express', 'MongoDB', 'JWT'],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const sql = neon(process.env.DATABASE_URL);
      const rows = await sql`SELECT * FROM projects ORDER BY updated_at DESC`;
      if (rows.length > 0) return res.json(rows);
    } catch (e) {
      console.error('[projects] DB error:', e.message);
    }
  }

  return res.json(SEED);
}
