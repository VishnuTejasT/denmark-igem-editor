// Same-origin proxy for the GitLab API. Calling gitlab.igem.org straight from
// the browser needs a CORS preflight, which intermittently comes back without
// an Access-Control-Allow-Origin header; going through here avoids CORS.
const HOST = (process.env.VITE_GITLAB_HOST || 'gitlab.igem.org').replace(/^https?:\/\//, '');

export default async function handler(req, res) {
  const { u } = req.query;
  if (typeof u !== 'string' || !u.startsWith('/')) return res.status(400).json({ error: 'Missing u' });

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(`https://${HOST}/api/v4${u}`, {
    method: req.method,
    headers: {
      Authorization: req.headers.authorization || '',
      ...(hasBody && { 'Content-Type': 'application/json' }),
    },
    body: hasBody ? JSON.stringify(req.body) : undefined,
  });
  res.status(upstream.status)
    .setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    .send(Buffer.from(await upstream.arrayBuffer()));
}
