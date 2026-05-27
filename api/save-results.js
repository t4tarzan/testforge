// POST /api/save-results — persists an analysis run to Neon.
// All writes are scoped to the signed-in user's user_id.
import crypto from 'crypto';
import { withSecurity } from './_security.js';
import { requireSession } from './_session.js';
import { denyIfOverTestQuota } from './_gate.js';

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await requireSession(req, res);
  if (!session) return;

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);
    const body = req.body || {};
    const userId = session.userId;

    // Server-side quota check — bypass-proof (any client that hits the save
    // endpoint directly without going through /api/gate first is still
    // blocked here).
    const deny = await denyIfOverTestQuota(userId, session.plan || 'free');
    if (deny) return res.status(deny.status).json(deny.body);

    // Look up or create the project, scoped per user so two users can have
    // repos with the same name without colliding.
    const repoName =
      (body.repo || 'unknown').split('/').pop()?.replace('.git', '') || 'unknown';
    const existing = await db`
      SELECT id FROM projects
      WHERE name = ${repoName} AND user_id = ${userId}
      LIMIT 1
    `;
    let projectId = existing[0]?.id;
    if (!projectId) {
      const created = await db`
        INSERT INTO projects (user_id, name, repo_url, local_path, tech_stack)
        VALUES (
          ${userId},
          ${repoName},
          ${body.repo || ''},
          ${'/tmp/' + repoName},
          ${JSON.stringify(body.codebase?.techStack || [])}
        )
        RETURNING id
      `;
      projectId = created[0].id;
    }

    const runId = crypto.randomUUID();
    const secFindings = body.security?.findings || 0;
    const overallScore = Math.round(
      (body.vision?.score || 50) * 0.25 +
        (body.stack?.score || 60) * 0.15 +
        (body.unit?.coverage || 50) * 0.1 +
        (body.accessibility?.score || 70) * 0.1 +
        Math.max(0, 100 - secFindings * 5) * 0.4
    );

    await db`
      INSERT INTO test_runs (
        id, project_id, user_id, branch, status, overall_score,
        total_findings, critical_count, high_count, medium_count, low_count,
        started_at, completed_at, config
      )
      VALUES (
        ${runId}, ${projectId}, ${userId}, ${body.branch || 'main'},
        'completed', ${overallScore},
        ${secFindings + (body.unit?.findings || 0) + (body.accessibility?.issues || 0)},
        ${body.security?.critical || 0}, ${body.security?.high || 0},
        ${body.security?.medium || 0}, ${body.security?.low || 0},
        ${new Date().toISOString()}, ${new Date().toISOString()},
        ${JSON.stringify({ source: 'testforge-web' })}
      )
    `;

    const findings = body.security?.items || [];
    for (const f of findings.slice(0, 20)) {
      await db`
        INSERT INTO findings (
          test_run_id, dimension, severity, title, description,
          file_path, line_number, fix_suggestion, status
        )
        VALUES (
          ${runId}, 'security', ${f.severity || 'low'},
          ${f.title || ''}, ${f.description || ''},
          ${f.filePath || ''}, ${f.lineNumber || 0},
          ${f.fixSuggestion || ''}, 'open'
        )
      `;
    }

    return res.json({
      saved: true,
      projectId,
      runId,
      findingsSaved: Math.min(findings.length, 20),
    });
  } catch (e) {
    console.error('[save-results] error:', e.message);
    return res.status(500).json({ saved: false, error: e.message });
  }
}

export default withSecurity(handler);
