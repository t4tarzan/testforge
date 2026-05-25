import { sql } from 'drizzle-orm';

import { withSecurity } from './_security.js';
async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return res.json({ error: 'Database not configured', tasks: [] });
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    const db = neon(process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const rows = await db`SELECT * FROM enterprise_tasks ORDER BY stage, priority, created_at`;
      const byStage = {};
      for (const row of rows) {
        const s = row.stage;
        if (!byStage[s]) byStage[s] = [];
        byStage[s].push(row);
      }
      return res.json({ tasks: rows, byStage, total: rows.length });
    }

    if (req.method === 'PATCH') {
      const { id, status, notes } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      
      const updates = {};
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      updates.updated_at = new Date().toISOString();

      const setClauses = [];
      const values = [];
      let i = 1;
      for (const [k, v] of Object.entries(updates)) {
        setClauses.push(`${k} = $${i++}`);
        values.push(v);
      }
      values.push(id);

      await db.unsafe(`UPDATE enterprise_tasks SET ${setClauses.join(', ')} WHERE id = $${i}`, values);
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export default withSecurity(handler);
