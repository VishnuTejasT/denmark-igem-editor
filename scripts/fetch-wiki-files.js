import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

config({ path: join(ROOT, '.env.local') });

const PROJECT     = encodeURIComponent(process.env.GITLAB_REPO_PATH || 'vishnutejast/denmarkwiki');
const REF         = encodeURIComponent(process.env.GITLAB_HTML_BRANCH || 'main');
const API_BASE    = `https://gitlab.igem.org/api/v4/projects/${PROJECT}`;
const TOKEN       = process.env.GITLAB_TOKEN;
const HEADERS     = TOKEN ? { 'PRIVATE-TOKEN': TOKEN } : {};

if (!TOKEN) {
  console.warn('Warning: GITLAB_TOKEN not set — unauthenticated API calls may still be rate limited');
}

const STATIC_FILES = ['static/style.css', 'static/denmark.css'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`429 rate limited, retrying in ${wait}ms…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Failed ${res.status} for ${url}`);
  }
  throw new Error(`Exhausted retries for ${url}`);
}

function cacheFile(filePath, text) {
  const dest = join(ROOT, 'public/wiki-cache', filePath);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text, 'utf8');
}

// ── 1. Discover all wiki/pages/*.html from the GitLab tree API ───────────────

console.log('Discovering pages from wiki/pages/…');

const treeUrl = `${API_BASE}/repository/tree?path=wiki%2Fpages&ref=${REF}&per_page=100`;
const treeRes = await fetchWithRetry(treeUrl);
const tree    = await treeRes.json();

const pageFiles = tree
  .filter(f => f.type === 'blob' && f.name.endsWith('.html'))
  .map(f => f.path)   // e.g. "wiki/pages/attributions.html"
  .sort();

const pageNames = pageFiles.map(f => f.replace('wiki/pages/', '').replace('.html', ''));

console.log(`Found ${pageNames.length} pages:`, pageNames.join(', '));

// ── 2. Cache each page HTML + static CSS files ────────────────────────────────

for (const file of [...pageFiles, ...STATIC_FILES]) {
  const encodedPath = encodeURIComponent(file);
  const url = `${API_BASE}/repository/files/${encodedPath}/raw?ref=${REF}`;
  const res = await fetchWithRetry(url);
  const text = await res.text();
  cacheFile(file, text);
  console.log('cached', file);
  await sleep(300);
}

// ── 3. Write pages manifest so the editor can discover pages at runtime ───────

const manifestPath = join(ROOT, 'public/wiki-cache/pages-manifest.json');
writeFileSync(manifestPath, JSON.stringify(pageNames, null, 2), 'utf8');
console.log(`wrote pages-manifest.json (${pageNames.length} pages)`);
