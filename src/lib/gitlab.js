const GITLAB_HOST = (import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org').replace(/^https?:\/\//, '');
const BASE = `https://${GITLAB_HOST}/api/v4`;
const PROJECT_ID = '4422';
const BRANCH = 'feature/content-system';

function encodedPath(pageName) {
  return encodeURIComponent(`wiki/content/${pageName}.json`);
}

export async function fetchPage(token, pageName) {
  const url = `${BASE}/projects/${PROJECT_ID}/repository/files/${encodedPath(pageName)}?ref=${encodeURIComponent(BRANCH)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load "${pageName}": ${res.statusText}`);
  }
  const data = await res.json();
  return {
    content: JSON.parse(atob(data.content)),
    lastCommitId: data.last_commit_id,
  };
}

export async function commitPage(token, pageName, content, lastCommitId, authorName, commitMessage) {
  const filePath = encodedPath(pageName);
  const url = `${BASE}/projects/${PROJECT_ID}/repository/files/${filePath}`;
  const bodyPayload = {
    branch: BRANCH,
    content: JSON.stringify(content, null, 2),
    commit_message: commitMessage || `Update ${pageName} wiki content`,
    author_name: authorName,
    encoding: 'text',
  };

  // PUT updates an existing file; POST creates it when it doesn't exist yet.
  const methods = lastCommitId
    ? [{ method: 'PUT', body: { ...bodyPayload, last_commit_id: lastCommitId } }]
    : [
        { method: 'PUT', body: { ...bodyPayload, last_commit_id: lastCommitId } },
        { method: 'POST', body: bodyPayload },
      ];

  let lastStatus = null;
  let lastBodyText = '';

  for (const { method, body } of methods) {
    console.log(`[commitPage] ${method} ${url}`, body);
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    lastBodyText = await res.text();
    lastStatus = res.status;
    console.log(`[commitPage] ${method} → ${res.status}`, lastBodyText.slice(0, 1000));

    if (res.ok) {
      return JSON.parse(lastBodyText);
    }

    // 404 on PUT means the file doesn't exist yet — try POST next (if queued).
    if (res.status !== 404) break;
  }

  let parsed = {};
  try { parsed = JSON.parse(lastBodyText); } catch (_) {}
  throw new Error(parsed.message || `Commit failed (${lastStatus}): ${lastBodyText.slice(0, 300)}`);
}
