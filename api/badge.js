import { withSecurity } from './_security.js';
// README Badge Generator — embeddable SVG badge showing TestForge score
// Usage: <img src="https://testforge.run/api/badge?repo=owner/name" />
// Or: /api/badge?score=85 (direct score)

async function handler(req, res) {
  const { repo, score: scoreParam } = req.query || {};
  
  let score = parseInt(scoreParam) || 0;
  let label = 'testforge';
  
  // If repo provided, try to get last score from DB
  if (repo && process.env.DATABASE_URL && !scoreParam) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const db = neon(process.env.DATABASE_URL);
      const rows = await db`
        SELECT tr.overall_score, p.name 
        FROM test_runs tr 
        JOIN projects p ON tr.project_id = p.id 
        WHERE p.name = ${repo.split('/').pop()}
        ORDER BY tr.completed_at DESC LIMIT 1
      `;
      if (rows.length > 0) {
        score = rows[0].overall_score || 0;
        label = rows[0].name || 'testforge';
      }
    } catch {}
  }
  
  if (!score && !scoreParam) {
    score = 0;
  }
  
  const color = score >= 80 ? '#574a7d' : score >= 50 ? '#EAB308' : '#EF4444';
  const letter = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D';
  
  // Shield.io-style badge
  const leftWidth = Math.max(70, label.length * 8 + 20);
  const rightWidth = 55;
  const totalWidth = leftWidth + rightWidth;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#555"/><stop offset="100%" stop-color="#333"/>
  </linearGradient>
  <rect width="${leftWidth}" height="20" fill="url(#g)" rx="3"/>
  <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}" rx="3"/>
  <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}" rx="0"/>
  <rect x="${leftWidth}" width="13" height="20" fill="${color}"/>
  <text x="${leftWidth/2}" y="14" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle" font-weight="bold">${label}</text>
  <text x="${leftWidth + rightWidth/2}" y="14" fill="#fff" font-family="monospace" font-size="11" text-anchor="middle" font-weight="bold">${score}% ${letter}</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.send(svg);
}

export default withSecurity(handler, { publicCors: true });
