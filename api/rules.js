// Custom Rule Builder API — users define custom analysis rules
const customRules = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: list all custom rules
  if (req.method === 'GET') {
    const rules = [];
    for (const [id, rule] of customRules) rules.push({ id, ...rule });
    return res.json(rules);
  }

  // POST: create/update rule
  if (req.method === 'POST') {
    const { id, name, pattern, severity, category, description, fixSuggestion } = req.body || {};
    if (!name || !pattern) return res.status(400).json({ error: 'name and pattern required' });

    const ruleId = id || 'rule_' + Date.now().toString(36);
    customRules.set(ruleId, {
      name, pattern, severity: severity || 'medium', category: category || 'custom',
      description: description || '', fixSuggestion: fixSuggestion || '',
      createdAt: new Date().toISOString(),
    });

    return res.json({ id: ruleId, message: 'Rule saved', rulesCount: customRules.size });
  }

  // DELETE: remove rule
  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    customRules.delete(id);
    return res.json({ deleted: true, rulesCount: customRules.size });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
