import { readFileSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), 'public/wiki-cache');

export default function handler(req, res) {
  const { path } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const safePath = path.replace(/\.\./g, '').replace(/^\/+/, '');
  const filePath = join(CACHE_DIR, safePath);

  if (!filePath.startsWith(CACHE_DIR)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return res.status(404).json({ error: `Not found: ${safePath}` });
  }

  const contentType = safePath.endsWith('.css') ? 'text/css' : 'text/html';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Content-Security-Policy', "script-src 'unsafe-inline' 'unsafe-eval' blob: 'self'");
  return res.status(200).send(content);
}
