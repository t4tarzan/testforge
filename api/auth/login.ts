export default async function handler(req: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  }

  try {
    const { email, password } = await req.json();

    // Mock auth — any email/password works
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400, headers });
    }

    // Simulate API call delay
    await new Promise(r => setTimeout(r, 300));

    return Response.json({
      token: 'mock_jwt_token_testforge_2026',
      user: {
        id: 'usr_123',
        name: 'Alex Chen',
        email: email,
        avatar: 'AC',
        plan: 'standard',
        creditsUsed: 1247,
        creditsTotal: 2000,
        testsRun: 47,
        passRate: 82,
        repos: 5,
      },
    }, { headers });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500, headers });
  }
}

