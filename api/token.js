export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirect_uri } = req.body;
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Missing code or redirect_uri' });
  }

  const params = new URLSearchParams({
    client_id: process.env.GITLAB_APP_ID,
    client_secret: process.env.GITLAB_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri,
  });

  try {
    const upstream = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(400).json({ error: data.error_description || 'Token exchange failed' });
    }

    return res.status(200).json({ access_token: data.access_token });
  } catch {
    return res.status(500).json({ error: 'Failed to reach GitLab' });
  }
}
