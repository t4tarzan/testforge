import { createClient } from '../src/db/client';
import { testRuns, testResults, findings, reports as reportsTable } from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const projectId = url.searchParams.get('projectId');

  try {
    const db = createClient();

    if (req.method === 'GET') {
      if (id) {
        if (!db) return Response.json({ error: 'Database not configured' }, { status: 500, headers });
        const run = await db.select().from(testRuns).where(eq(testRuns.id, id)).limit(1);
        if (!run.length) return Response.json({ error: 'Not found' }, { status: 404, headers });

        // Get related data
        const runFindings = await db.select().from(findings).where(eq(findings.testRunId, id));
        const runResults = await db.select().from(testResults).where(eq(testResults.testRunId, id));
        const runReports = await db.select().from(reportsTable).where(eq(reportsTable.testRunId, id));

        return Response.json({
          ...run[0],
          findings: runFindings,
          results: runResults,
          reports: runReports,
        }, { headers });
      }

      if (!db) {
        // Seed data
        return Response.json([
          {
            id: 'TF-2026-001',
            projectId: 'proj_001',
            branch: 'main',
            commitHash: 'a1b2c3d',
            status: 'completed',
            overallScore: 68,
            totalFindings: 16,
            criticalCount: 1,
            highCount: 2,
            mediumCount: 5,
            lowCount: 8,
            startedAt: '2026-05-20T10:00:00Z',
            completedAt: '2026-05-20T10:05:30Z',
            config: { depth: 'normal' },
          },
        ], { headers });
      }

      let query = db.select().from(testRuns).orderBy(desc(testRuns.startedAt));
      if (projectId) {
        query = query.where(eq(testRuns.projectId, projectId));
      }
      const all = await query;
      return Response.json(all, { headers });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}

