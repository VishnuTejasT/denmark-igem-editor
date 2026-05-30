import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPage, commitPage } from '../lib/gitlab'
import Editor from '../components/Editor'
import Preview from '../components/Preview'

const PAGES = [
  'attributions', 'contribution', 'education', 'engineering',
  'entrepreneurship', 'hardware', 'human-practices', 'implementation',
  'model', 'notebook', 'parts', 'project', 'protocols', 'safety',
  'software', 'wetlab',
];

const EMPTY = { title: '', intro: '', sections: [] };

export default function EditorPage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('gitlab_token');

  const [username, setUsername] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [content, setContent] = useState(EMPTY);
  const [lastCommitId, setLastCommitId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    const gitlabHost = import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org';
    fetch(`https://${gitlabHost}/api/v4/user`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setUsername(data.username || data.name || ''))
      .catch(() => {});
  }, [token, navigate]);

  const handlePageSelect = async (pageName) => {
    setSelectedPage(pageName);
    setContent(EMPTY);
    setLastCommitId(null);
    setStatus(null);
    if (!pageName) return;

    setLoading(true);
    try {
      const { content: fetched, lastCommitId: cid } = await fetchPage(token, pageName);
      setContent(fetched);
      setLastCommitId(cid);
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setCommitting(true);
    setStatus(null);
    try {
      await commitPage(token, selectedPage, content, lastCommitId, username);
      setStatus({ type: 'success', message: 'Committed successfully.' });
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setCommitting(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('gitlab_token');
    navigate('/');
  };

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <strong style={{ fontSize: 16 }}>iGEM Wiki Editor</strong>

        <select
          style={styles.select}
          value={selectedPage}
          onChange={e => handlePageSelect(e.target.value)}
        >
          <option value="">— select a page —</option>
          {PAGES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={handleCommit}
          disabled={!selectedPage || !lastCommitId || committing || loading}
        >
          {committing ? 'Committing…' : 'Commit'}
        </button>

        {status && (
          <span style={{ color: status.type === 'error' ? '#c00' : '#080', fontSize: 14 }}>
            {status.message}
          </span>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#666' }}>
          {username && `@${username}`}
        </span>
        <button style={styles.btn} onClick={handleLogout}>Sign out</button>
      </header>

      <div style={styles.body}>
        {loading ? (
          <div style={styles.placeholder}>Loading…</div>
        ) : !selectedPage ? (
          <div style={styles.placeholder}>Select a page above to start editing.</div>
        ) : (
          <>
            <div style={styles.pane}>
              <Editor content={content} onChange={setContent} />
            </div>
            <div style={{ ...styles.pane, background: '#fafafa', borderLeft: '1px solid #e0e0e0' }}>
              <Preview content={content} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    borderBottom: '1px solid #ddd',
    background: '#fff',
    flexShrink: 0,
  },
  select: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #ccc',
    fontSize: 14,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #ccc',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
  },
  btnPrimary: {
    background: '#1a73e8',
    color: '#fff',
    border: 'none',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  pane: {
    flex: 1,
    overflow: 'auto',
    padding: 24,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: 15,
  },
};
