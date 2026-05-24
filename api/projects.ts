import { createClient } from '../src/db/client';
import { projects } from '../src/db/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    const db = createClient();

    if (req.method === 'GET') {
      if (id) {
        if (!db) return Response.json({ error: 'Database not configured' }, { status: 500, headers });
        const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
        if (!result.length) return Response.json({ error: 'Not found' }, { status: 404, headers });
        return Response.json(result[0], { headers });
      }

      if (!db) {
        // Return seed data when no DB
        return Response.json([{
          id: 'proj_001',
          name: 'express-ecommerce-api',
          repoUrl: 'https://github.com/example/express-ecommerce-api',
          localPath: '/projects/express-ecommerce-api',
          branch: 'main',
          techStack: ['Node.js', 'Express', 'MongoDB', 'JWT'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }], { headers });
      }

      const all = await db.select().from(projects).orderBy(projects.updatedAt);
      return Response.json(all, { headers });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}

