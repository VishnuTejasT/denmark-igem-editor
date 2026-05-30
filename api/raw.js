const REPO_RAW_BASE =
  'https://gitlab.igem.org/vishnutejast/denmarkwiki/-/raw/feature/content-system/';

export default async function handler(req, res) {
  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  // Prevent path traversal
  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '');
  const url = `${REPO_RAW_BASE}${safePath}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.GITLAB_SECRET}`,
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `GitLab returned ${upstream.status} for ${safePath}`,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'text/plain';
    const body = await upstream.text();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(body);
  } catch (err) {
    console.error('[raw] fetch threw:', err);
    return res.status(500).json({ error: 'Failed to fetch from GitLab', detail: err.message });
  }
}
