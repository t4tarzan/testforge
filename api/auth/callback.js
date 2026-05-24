export default async function handler(req, res) {
  const { code, state } = req.query || {};
  
  // Step 1: Redirect to GitHub
  if (!code) {
    const redirectUri = 'https://testforge-steel.vercel.app/api/auth/callback';
    const scope = 'read:user user:email';
    const state = Math.random().toString(36).substring(2);
    const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
    res.writeHead(302, { Location: url });
    return res.end();
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

    // Step 3: Fetch user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const githubUser = await userRes.json();

    // Step 4: Fetch email if not public
    let email = githubUser.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      email = emails.find((e) => e.primary)?.email || emails[0]?.email;
    }

    // Step 5: Save/update user in Neon DB
    if (githubUser.id) {
      try {
        const { neon } = await import('@neondatabase/serverless');
        const db = neon(process.env.DATABASE_URL);
        await db\`
          INSERT INTO users (github_id, name, email, avatar_url, login, last_login_at)
          VALUES (\${githubUser.id.toString()}, \${githubUser.name || githubUser.login}, \${email || ''}, \${githubUser.avatar_url || ''}, \${githubUser.login}, NOW())
          ON CONFLICT (github_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, last_login_at = NOW()
        \`;
      } catch (e) {
        console.error('Failed to save user:', e.message);
      }
    }

    // Step 6: Return user data to frontend via redirect
    const userData = encodeURIComponent(JSON.stringify({
      id: githubUser.id.toString(),
      name: githubUser.name || githubUser.login,
      email: email || githubUser.login + '@github',
      avatar: githubUser.avatar_url,
      login: githubUser.login,
    }));

    res.writeHead(302, {
      Location: `/#/auth?github_user=${userData}`,
    });
    return res.end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
