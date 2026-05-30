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
    const rawHost = process.env.GITLAB_HOST || 'gitlab.igem.org';
    const gitlabHost = rawHost.replace(/^https?:\/\//, '');
    const tokenUrl = `https://${gitlabHost}/oauth/token`;
    console.log('[token] POST', tokenUrl);

    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    let data;
    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await upstream.json();
    } else {
      const text = await upstream.text();
      console.error('[token] Non-JSON response from GitLab:', upstream.status, text.slice(0, 500));
      return res.status(502).json({ error: `GitLab returned non-JSON (${upstream.status})`, body: text.slice(0, 500) });
    }

    console.log('[token] GitLab response status:', upstream.status, 'body:', JSON.stringify(data));

    if (!upstream.ok) {
      return res.status(400).json({
        error: data.error_description || data.error || 'Token exchange failed',
        gitlab_status: upstream.status,
        gitlab_error: data,
      });
    }

    return res.status(200).json({ access_token: data.access_token });
  } catch (err) {
    console.error('[token] Fetch threw:', err);
    return res.status(500).json({ error: 'Failed to reach GitLab', detail: err.message });
  }
}
