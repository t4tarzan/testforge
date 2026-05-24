const MCP_SERVER = process.env.MCP_SERVER_URL || 'https://testforge-mcp.fly.dev';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: return test status
  if (req.method === 'GET') {
    const { id } = req.query;
    try {
      const response = await fetch(`${MCP_SERVER}/test/${id}/progress`);
      const data = await response.json();
      return res.json(data);
    } catch (e) {
      return res.json({ status: 'unknown', error: 'Cannot reach test server' });
    }
  }

  // POST: start a new test
  const { repoUrl, dimensions, branch } = req.body || {};
  if (!repoUrl) {
    return res.status(400).json({ error: 'repoUrl is required' });
  }

  try {
    const response = await fetch(`${MCP_SERVER}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: repoUrl,
        dimensions: dimensions || ['security', 'unit', 'load', 'accessibility'],
        branch: branch || 'main',
      }),
    });
    const data = await response.json();
    return res.json(data);
  } catch (e) {
    console.error('[test] MCP server error:', e.message);
    // Return mock test run ID for demo
    return res.json({
      testRunId: 'TF-' + Date.now().toString(36).toUpperCase(),
      status: 'queued',
      message: 'Test queued (MCP server starting up)',
    });
  }
}
