import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.DATABASE_URL) return res.json({ saved: false, reason: 'No database configured' });

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
  const githubUser = req.headers['x-github-user'] || null;
    const body = req.body || {};
    
    // Save project
    const repoName = (body.repo || 'unknown').split('/').pop()?.replace('.git', '') || 'unknown';
    const projects = await db`SELECT id FROM projects WHERE name = ${repoName} LIMIT 1`;
    let projectId = projects[0]?.id;
    
    if (!projectId) {
      const newProject = await db`
        INSERT INTO projects (name, repo_url, local_path, tech_stack)
        VALUES (${repoName}, ${body.repo || ''}, ${'/tmp/' + repoName}, ${JSON.stringify(body.codebase?.techStack || [])})
        RETURNING id
      `;
      projectId = newProject[0].id;
    }

    // Save test run
    const runId = crypto.randomUUID();
    const secFindings = body.security?.findings || 0;
    await db`
      INSERT INTO test_runs (id, project_id, user_id, branch, status, overall_score, total_findings, critical_count, high_count, medium_count, low_count, started_at, completed_at, config)
      VALUES (${runId}, ${projectId}, ${githubUser || 'anonymous'}, ${body.branch || 'main'}, 'completed', 
        ${Math.round(((body.vision?.score || 50) * 0.25 + (body.stack?.score || 60) * 0.15 + (body.unit?.coverage || 50) * 0.1 + (body.accessibility?.score || 70) * 0.1 + Math.max(0, 100 - secFindings * 5) * 0.4))},
        ${secFindings + (body.unit?.findings || 0) + (body.accessibility?.issues || 0)},
        ${body.security?.critical || 0}, ${body.security?.high || 0}, ${body.security?.medium || 0}, ${body.security?.low || 0},
        ${new Date().toISOString()}, ${new Date().toISOString()}, ${JSON.stringify({ source: 'testforge-web' })})
    `;

    // Save findings
    const findings = body.security?.items || [];
    for (const f of findings.slice(0, 20)) {
      await db`
        INSERT INTO findings (test_run_id, dimension, severity, title, description, file_path, line_number, fix_suggestion, status)
        VALUES (${runId}, 'security', ${f.severity || 'low'}, ${f.title || ''}, ${f.description || ''}, ${f.filePath || ''}, ${f.lineNumber || 0}, ${f.fixSuggestion || ''}, 'open')
      `;
    }

    return res.json({ saved: true, projectId, runId, findingsSaved: Math.min(findings.length, 20) });
  } catch (e) {
    return res.json({ saved: false, error: e.message });
  }
}
