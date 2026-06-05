import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PROJECT = encodeURIComponent(process.env.GITLAB_REPO_PATH || 'vishnutejast/denmarkwiki');
const REF = encodeURIComponent(process.env.GITLAB_BRANCH || 'main');
const API_BASE = `https://gitlab.igem.org/api/v4/projects/${PROJECT}/repository/files`;
const TOKEN = process.env.GITLAB_TOKEN;

if (!TOKEN) {
  console.warn('Warning: GITLAB_TOKEN not set — unauthenticated API calls may still be rate limited');
}

const FILES = [
  'wiki/pages/attributions.html',
  'wiki/pages/contribution.html',
  'wiki/pages/education.html',
  'wiki/pages/engineering.html',
  'wiki/pages/entrepreneurship.html',
  'wiki/pages/hardware.html',
  'wiki/pages/human-practices.html',
  'wiki/pages/implementation.html',
  'wiki/pages/model.html',
  'wiki/pages/notebook.html',
  'wiki/pages/parts.html',
  'wiki/pages/project.html',
  'wiki/pages/protocols.html',
  'wiki/pages/safety.html',
  'wiki/pages/software.html',
  'wiki/pages/software-2.html',
  'wiki/pages/software-3.html',
  'wiki/pages/team.html',
  'wiki/pages/wetlab.html',
  'static/style.css',
  'static/denmark.css',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, headers, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`429 rate limited, retrying in ${wait}ms...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Failed ${res.status} for ${url}`);
  }
  throw new Error(`Exhausted retries for ${url}`);
}

for (const file of FILES) {
  const encodedPath = encodeURIComponent(file);
  const url = `${API_BASE}/${encodedPath}/raw?ref=${REF}`;
  const headers = TOKEN ? { 'PRIVATE-TOKEN': TOKEN } : {};
  const res = await fetchWithRetry(url, headers);
  const text = await res.text();
  const dest = join(ROOT, 'public/wiki-cache', file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text, 'utf8');
  console.log('cached', file);
  await sleep(300);
}
