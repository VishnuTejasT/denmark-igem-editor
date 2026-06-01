const REPO_RAW_BASE =
  'https://gitlab.igem.org/vishnutejast/denmarkwiki/-/raw/feature/content-system/';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // key: safePath → { body, contentType, expiresAt }

export default async function handler(req, res) {
  const { path, token } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }
  if (!token) {
    return res.status(400).json({ error: 'Missing token query parameter' });
  }

  // Prevent path traversal
  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '');

  const cached = cache.get(safePath);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).send(cached.body);
  }

  const url = `${REPO_RAW_BASE}${safePath}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '');
      console.error('[raw] GitLab error', upstream.status, safePath, body.slice(0, 500));
      return res.status(upstream.status).json({
        error: `GitLab returned ${upstream.status} for ${safePath}`,
        detail: body.slice(0, 500),
      });
    }

    const contentType = upstream.headers.get('content-type') || 'text/plain';
    const body = await upstream.text();

    cache.set(safePath, { body, contentType, expiresAt: Date.now() + CACHE_TTL_MS });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).send(body);
  } catch (err) {
    console.error('[raw] fetch threw:', err);
    return res.status(500).json({ error: 'Failed to fetch from GitLab', detail: err.message });
  }
}
