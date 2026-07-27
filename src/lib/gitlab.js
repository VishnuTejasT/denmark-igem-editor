import { sectionBodyHtml } from './blocks';

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
    if (res.status === 401 || res.status === 403) {
      const e = new Error('Session expired — please sign out and sign back in.');
      e.code = 'AUTH';
      throw e;
    }
    if (res.status === 404) {
      const e = new Error(`No saved content yet for "${pageName}".`);
      e.code = 'NOT_FOUND';
      throw e;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitLab error ${res.status} loading "${pageName}".`);
  }

  const data = await res.json();
  const result = {
    content: JSON.parse(atob(data.content)),
    lastCommitId: data.last_commit_id,
  };
  pageCache.set(pageName, result);
  return result;
}

// Append a brand-new `.toc-section` (and its matching TOC nav link) to a wiki
// page's HTML — used when a section was added in the editor but doesn't exist
// in the page template yet. Returns the new section element, or null if the
// page's content container isn't present.
function createSectionElement(doc, s) {
  const container = doc.querySelector('.page-content .container');
  if (!container) return null;

  const sec = doc.createElement('section');
  sec.className = 'wiki-section toc-section';
  sec.id = s.id;

  const h3 = doc.createElement('h3');
  h3.textContent = s.heading || '';
  sec.appendChild(h3);

  const block = doc.createElement('div');
  block.className = 'section-block';
  sec.appendChild(block);

  container.appendChild(sec);

  const tocNav = doc.querySelector('.toc-nav');
  if (tocNav) {
    const link = doc.createElement('a');
    link.setAttribute('href', `#${s.id}`);
    link.setAttribute('data-toc', s.id);
    link.textContent = s.heading || '';
    tocNav.appendChild(link);
  }

  return sec;
}

// Apply content to the cached HTML template and return the updated HTML string.
async function generatePageHtml(pageName, content) {
  const res = await fetch(`/wiki-cache/wiki/pages/${pageName}.html`);
  if (!res.ok) return null;
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Remove content-loader.js — content is now baked in, no runtime fetch needed.
  doc.querySelectorAll('script[src*="content-loader"]').forEach(s => s.remove());

  if (content.title) {
    const h2 = doc.querySelector('.page-hero h2');
    if (h2) h2.textContent = content.title;
  }
  if (content.intro) {
    const p = doc.querySelector('.page-hero .summary');
    if (p) p.textContent = content.intro;
  }
  for (const s of content.sections || []) {
    let sec = doc.querySelector(`.toc-section#${s.id}`);
    if (!sec) {
      sec = createSectionElement(doc, s);
      if (!sec) continue;
    } else if (s.heading) {
      const h3 = sec.querySelector('h3');
      if (h3) h3.textContent = s.heading;
      const tocLink = doc.querySelector(`.toc-nav a[data-toc="${s.id}"]`);
      if (tocLink) tocLink.textContent = s.heading;
    }
    const renderedBody = sectionBodyHtml(s.blocks);
    if (renderedBody) {
      const block = sec.querySelector('.section-block');
      if (block) block.innerHTML = renderedBody;
    }
  }

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// Lightweight fetch — bypasses cache, just returns lastCommitId + content.
export async function fetchPageMeta(token, pageName) {
  const encoded = encodeURIComponent(jsonPath(pageName));
  const url = `${BASE}/projects/${PROJECT_ID}/repository/files/${encoded}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return { lastCommitId: data.last_commit_id, content: JSON.parse(atob(data.content)) };
}

export async function fetchCommitInfo(token, commitId) {
  const url = `${BASE}/projects/${PROJECT_ID}/repository/commits/${commitId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

export async function commitPage(token, pageName, content, lastCommitId, authorName, commitMessage) {
  // Detect concurrent edits: re-fetch the current commit ID and compare
  // with what was loaded when the user opened the page. If someone else
  // committed in the meantime, refuse and tell the user to reload.
  if (lastCommitId) {
    const encoded = encodeURIComponent(jsonPath(pageName));
    const checkUrl = `${BASE}/projects/${PROJECT_ID}/repository/files/${encoded}?ref=${encodeURIComponent(BRANCH)}`;
    const checkRes = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.last_commit_id !== lastCommitId) {
        throw new Error(
          'This page was edited by someone else since you opened it. ' +
          'Please reload the page to get the latest version, then reapply your changes.'
        );
      }
    }
  }

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
