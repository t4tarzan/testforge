const { getDb } = require('../_db.js');

const SEED_PROJECTS = [{
  id: 'proj_001', name: 'express-ecommerce-api',
  repoUrl: 'https://github.com/example/express-ecommerce-api',
  localPath: '/projects/express-ecommerce-api', branch: 'main',
  techStack: ['Node.js', 'Express', 'MongoDB', 'JWT'],
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const db = getDb();
  if (!db) return res.json(SEED_PROJECTS);

  try {
    const { sql } = require('drizzle-orm');
    const rows = await db.execute(sql`SELECT * FROM projects ORDER BY updated_at DESC`);
    return res.json(rows.length > 0 ? rows : SEED_PROJECTS);
  } catch (err) {
    console.error('[projects]', err.message);
    return res.json(SEED_PROJECTS);
  }
};
