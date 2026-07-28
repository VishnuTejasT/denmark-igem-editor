import { sectionBodyHtml, sectionBodyListItems } from './blocks';

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

  // The page template can itself contain duplicate section ids (e.g. a
  // section that got committed twice by this exact bug before it was
  // caught). querySelector(`#id`) below only ever resolves the first match,
  // silently leaving every later duplicate as an untouched orphan that then
  // gets committed right back into the output HTML, compounding on every
  // save. Strip duplicates up front so every id maps to exactly one element.
  const seenSectionIds = new Set();
  doc.querySelectorAll('.toc-section').forEach(sec => {
    if (!sec.id) return;
    if (seenSectionIds.has(sec.id)) { sec.remove(); return; }
    seenSectionIds.add(sec.id);
  });
  const seenTocIds = new Set();
  doc.querySelectorAll('.toc-nav a[data-toc]').forEach(a => {
    const key = a.getAttribute('data-toc');
    if (!key) return;
    if (seenTocIds.has(key)) { a.remove(); return; }
    seenTocIds.add(key);
  });

  if (content.title) {
    const h2 = doc.querySelector('.page-hero h2');
    if (h2) h2.textContent = content.title;
  }
  if (content.intro) {
    const p = doc.querySelector('.page-hero .summary');
    if (p) p.textContent = content.intro;
  }
  for (const s of content.sections || []) {
    // Look the element up by its original anchor (sourceId), since `id` may
    // have already drifted away from it to match a renamed heading.
    const lookupId = s.sourceId || s.id;
    let sec = doc.querySelector(`.toc-section#${lookupId}`);
    if (!sec) {
      sec = createSectionElement(doc, s);
      if (!sec) continue;
    } else {
      if (sec.id !== s.id) sec.id = s.id;
      if (s.heading) {
        const h3 = sec.querySelector('h3');
        if (h3) h3.textContent = s.heading;
      }
      const tocLink = doc.querySelector(`.toc-nav a[data-toc="${lookupId}"]`);
      if (tocLink) {
        if (s.heading) tocLink.textContent = s.heading;
        if (tocLink.getAttribute('data-toc') !== s.id) {
          tocLink.setAttribute('data-toc', s.id);
          tocLink.setAttribute('href', `#${s.id}`);
        }
      }
    }
    // The References section is an <ol class="references-list"> whose
    // numbered-circle styling comes from a CSS counter on each <li> — so
    // every reference needs its own <li>, not one merged blob.
    const refsList = sec.querySelector('.references-list');
    if (refsList) {
      const items = sectionBodyListItems(s.blocks);
      if (items) refsList.innerHTML = items;
    } else {
      const renderedBody = sectionBodyHtml(s.blocks);
      if (renderedBody) {
        const block = sec.querySelector('.section-block');
        if (block) block.innerHTML = renderedBody;
      }
    }
  }

  // Reorder the actual DOM nodes (and their TOC links) to match the editor's
  // section order — appendChild on an existing node moves it, so iterating
  // in the desired order lays them out correctly.
  const container = doc.querySelector('.page-content .container');
  const tocNav = doc.querySelector('.toc-nav');
  for (const s of content.sections || []) {
    const sec = doc.querySelector(`.toc-section#${s.id}`);
    if (sec && container) container.appendChild(sec);
    const tocLink = doc.querySelector(`.toc-nav a[data-toc="${s.id}"]`);
    if (tocLink && tocNav) tocNav.appendChild(tocLink);
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
