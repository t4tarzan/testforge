// Public status page — SLA monitoring
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const services = [
    { name: 'Web Platform', url: 'https://testforge-steel.vercel.app', check: async () => {
      const r = await fetch('https://testforge-steel.vercel.app/api/health');
      return r.ok ? 'operational' : 'degraded';
    }},
    { name: 'MCP Server', url: 'https://testforge-mcp.fly.dev', check: async () => {
      const r = await fetch('https://testforge-mcp.fly.dev/health');
      return r.ok ? 'operational' : 'degraded';
    }},
    { name: 'Neon Database', check: async () => process.env.DATABASE_URL ? 'operational' : 'not_configured' },
    { name: 'npm Package', url: 'https://www.npmjs.com/package/@whitenoisenpm/testforge-mcp', check: async () => {
      const r = await fetch('https://registry.npmjs.org/@whitenoisenpm/testforge-mcp/latest');
      return r.ok ? 'operational' : 'degraded';
    }},
  ];

  const results = [];
  for (const svc of services) {
    try {
      const status = await svc.check();
      results.push({ name: svc.name, status, url: svc.url });
    } catch {
      results.push({ name: svc.name, status: 'down', url: svc.url });
    }
  }

  const overall = results.every(r => r.status === 'operational') ? 'all_systems_operational' :
    results.some(r => r.status === 'down') ? 'major_outage' : 'partial_outage';

  return res.json({
    status: overall,
    updatedAt: new Date().toISOString(),
    services: results,
  });
}
