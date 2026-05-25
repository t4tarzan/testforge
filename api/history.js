export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-User');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!process.env.DATABASE_URL) return res.json([]);

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const githubUser = req.headers['x-github-user'] || null;
    
    const rows = githubUser
      ? await db`SELECT tr.*, p.name as project_name, p.repo_url FROM test_runs tr LEFT JOIN projects p ON tr.project_id = p.id WHERE tr.user_id = ${githubUser} OR tr.user_id IS NULL ORDER BY tr.completed_at DESC NULLS LAST LIMIT 20`
      : await db`SELECT tr.*, p.name as project_name, p.repo_url FROM test_runs tr LEFT JOIN projects p ON tr.project_id = p.id ORDER BY tr.completed_at DESC NULLS LAST LIMIT 20`;
    
    return res.json(rows);
  } catch (e) {
    return res.json([]);
  }
}
