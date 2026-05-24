export default async function handler(req, res) {
  const { code } = req.query || {};

  // Step 1: Redirect to GitHub (when no auth code provided)
  if (!code) {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
      }
      const stateStr = Math.random().toString(36).substring(2);
      const redirectUri = encodeURIComponent('https://testforge-steel.vercel.app/api/auth/callback');
      const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user%20user:email&state=${stateStr}`;
      res.writeHead(302, { Location: url });
      res.end();
      return;
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Step 2: Exchange code for token
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    // Fetch user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userRes.json();

    let email = githubUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      email = emails.find(e => e.primary)?.email || emails[0]?.email;
    }

    // Save user to DB
    if (process.env.DATABASE_URL && githubUser.id) {
      try {
        const { neon } = await import('@neondatabase/serverless');
        const db = neon(process.env.DATABASE_URL);
        await db`
          INSERT INTO users (github_id, name, email, avatar_url, login, last_login_at)
          VALUES (${String(githubUser.id)}, ${githubUser.name || githubUser.login}, ${email || ''}, ${githubUser.avatar_url || ''}, ${githubUser.login}, NOW())
          ON CONFLICT (github_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, last_login_at = NOW()
        `;
      } catch (e) {
        console.error('DB save failed:', e.message);
      }
    }

    // Redirect to app with user data
    const userData = encodeURIComponent(JSON.stringify({
      id: String(githubUser.id),
      name: githubUser.name || githubUser.login,
      email: email || githubUser.login + '@github',
      avatar: githubUser.avatar_url,
      login: githubUser.login,
    }));

    res.writeHead(302, { Location: `/#/auth?github_user=${userData}` });
    res.end();
    return;
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
