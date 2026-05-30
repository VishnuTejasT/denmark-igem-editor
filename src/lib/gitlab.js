const BASE = 'https://gitlab.com/api/v4';
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

export async function commitPage(token, pageName, content, lastCommitId, authorName) {
  const url = `${BASE}/projects/${PROJECT_ID}/repository/files/${encodedPath(pageName)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: BRANCH,
      content: JSON.stringify(content, null, 2),
      commit_message: `Update ${pageName} wiki content`,
      last_commit_id: lastCommitId,
      author_name: authorName,
      encoding: 'text',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Commit failed: ${res.statusText}`);
  }
  return res.json();
}
