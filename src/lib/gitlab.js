import { marked } from 'marked';

marked.use({ gfm: true, breaks: true });

const GITLAB_HOST = (import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org').replace(/^https?:\/\//, '');
const BASE = `https://${GITLAB_HOST}/api/v4`;
const PROJECT_ID = import.meta.env.VITE_GITLAB_PROJECT_ID || '4422';
const BRANCH = import.meta.env.VITE_GITLAB_BRANCH || 'main';

function jsonPath(pageName) {
  return `wiki/content/${pageName}.json`;
}

function htmlPath(pageName) {
  return `wiki/pages/${pageName}.html`;
}

const pageCache = new Map();

export async function fetchPage(token, pageName) {
  if (pageCache.has(pageName)) return pageCache.get(pageName);

  const encoded = encodeURIComponent(jsonPath(pageName));
  const url = `${BASE}/projects/${PROJECT_ID}/repository/files/${encoded}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load "${pageName}": ${res.statusText}`);
  }

  const data = await res.json();
  const result = {
    content: JSON.parse(atob(data.content)),
    lastCommitId: data.last_commit_id,
  };
  pageCache.set(pageName, result);
  return result;
}

// Apply content to the cached HTML template and return the updated HTML string.
async function generatePageHtml(pageName, content) {
  const res = await fetch(`/wiki-cache/wiki/pages/${pageName}.html`);
  if (!res.ok) return null;
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (content.title) {
    const h2 = doc.querySelector('.page-hero h2');
    if (h2) h2.textContent = content.title;
  }
  if (content.intro) {
    const p = doc.querySelector('.page-hero .summary');
    if (p) p.textContent = content.intro;
  }
  for (const s of content.sections || []) {
    const sec = doc.querySelector(`.toc-section#${s.id}`);
    if (!sec) continue;
    const renderedBody = s.body ? marked(s.body) : '';
    if (renderedBody) {
      const block = sec.querySelector('.section-block');
      if (block) block.innerHTML = renderedBody;
    }
  }

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

export async function commitPage(token, pageName, content, lastCommitId, authorName, commitMessage) {
  // Invalidate cache so next load reads fresh JSON.
  pageCache.delete(pageName);

  const htmlContent = await generatePageHtml(pageName, content).catch(() => null);

  const actions = [
    {
      action: lastCommitId ? 'update' : 'create',
      file_path: jsonPath(pageName),
      content: JSON.stringify(content, null, 2),
      encoding: 'text',
    },
  ];

  if (htmlContent) {
    actions.push({
      action: 'update',
      file_path: htmlPath(pageName),
      content: htmlContent,
      encoding: 'text',
    });
  }

  const url = `${BASE}/projects/${PROJECT_ID}/repository/commits`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: BRANCH,
      commit_message: commitMessage || `Update ${pageName} wiki content`,
      author_name: authorName,
      actions,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let parsed = {};
    try { parsed = JSON.parse(text); } catch {}
    throw new Error(parsed.message || `Commit failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}
