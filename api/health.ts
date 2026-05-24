export default async function handler() {
  return Response.json({
    status: 'ok',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
    database: !!process.env.DATABASE_URL ? 'connected' : 'not configured',
    features: {
      projects: true,
      testRuns: true,
      reports: true,
      auth: true,
    },
  });
}

