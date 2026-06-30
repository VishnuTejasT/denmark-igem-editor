import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPage, commitPage } from '../lib/gitlab';
import { parseSectionsFromHtml } from '../lib/htmlParser';
import Editor from '../components/Editor';
import Preview from '../components/Preview';

const PAGES = [
  'attributions', 'contribution', 'education', 'engineering',
  'entrepreneurship', 'hardware', 'human-practices', 'implementation',
  'model', 'notebook', 'parts', 'project', 'protocols', 'safety',
  'software', 'software-2', 'software-3', 'team', 'wetlab',
];

const EMPTY = { title: '', intro: '', sections: [] };

function normalizeContent(content, htmlSections) {
  const savedBodies = {};
  (content.sections || []).forEach(s => {
    savedBodies[s.id] = s.body ?? (s.blocks?.[0]?.body ?? '');
  });
  return {
    title: content.title || '',
    intro: content.intro || '',
    sections: htmlSections.map(({ id, heading }) => ({
      id,
      heading,
      body: savedBodies[id] || '',
    })),
  };
}

async function fetchHtmlSections(pageName) {
  try {
    const res = await fetch(`/wiki-cache/wiki/pages/${pageName}.html`);
    if (!res.ok) return [];
    return parseSectionsFromHtml(await res.text());
  } catch {
    return [];
  }
}

export default function EditorPage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('gitlab_token');

  const [username, setUsername] = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [content, setContent] = useState(EMPTY);
  const [lastCommitId, setLastCommitId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [status, setStatus] = useState(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!token) { navigate('/'); return; }
    const host = (import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org').replace(/^https?:\/\//, '');
    fetch(`https://${host}/api/v4/user`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsername(d.username || d.name || ''))
      .catch(() => {});
  }, [token, navigate]);

  const handlePageSelect = async (pageName) => {
    if (pageName === selectedPage) return;
    setSelectedPage(pageName);
    setContent(EMPTY);
    setLastCommitId(null);
    setStatus(null);
    setCommitMessage('');
    if (!pageName) return;

    setLoading(true);
    try {
      const [jsonResult, htmlSections] = await Promise.allSettled([
        fetchPage(token, pageName),
        fetchHtmlSections(pageName),
      ]);

      const sections = htmlSections.status === 'fulfilled' ? htmlSections.value : [];

      if (jsonResult.status === 'rejected') {
        setStatus({ type: 'error', message: jsonResult.reason.message });
        setContent({ title: '', intro: '', sections: sections.map(s => ({ ...s, body: '' })) });
      } else {
        const { content: fetched, lastCommitId: cid } = jsonResult.value;
        const draft = sessionStorage.getItem(`wiki_draft_${pageName}`);
        setContent(draft ? JSON.parse(draft) : normalizeContent(fetched, sections));
        setLastCommitId(cid);
      }
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = useCallback((newContent) => {
    setContent(newContent);
    if (selectedPage) {
      sessionStorage.setItem(`wiki_draft_${selectedPage}`, JSON.stringify(newContent));
      forceUpdate(n => n + 1);
    }
  }, [selectedPage]);

  const handleCommit = async () => {
    setCommitting(true);
    setStatus(null);
    try {
      const message = commitMessage.trim() || `Update ${selectedPage} content`;
      await commitPage(token, selectedPage, content, lastCommitId, username, message);
      sessionStorage.removeItem(`wiki_draft_${selectedPage}`);
      forceUpdate(n => n + 1);
      setStatus({ type: 'success', message: '✓ Committed successfully.' });
      setCommitMessage('');
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    } finally {
      setCommitting(false);
    }
  };

  const discardDraft = () => {
    if (!selectedPage) return;
    sessionStorage.removeItem(`wiki_draft_${selectedPage}`);
    forceUpdate(n => n + 1);
    setStatus({ type: 'success', message: 'Draft discarded.' });
  };

  const hasDraft = (page) => !!sessionStorage.getItem(`wiki_draft_${page}`);
  const unsaved = selectedPage && hasDraft(selectedPage);
  const canCommit = !!selectedPage && !committing && !loading;

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <strong style={styles.logo}>iGEM Wiki Editor</strong>

        {unsaved && (
          <>
            <span style={styles.unsavedBadge}>● unsaved draft</span>
            <button style={styles.discardBtn} onClick={discardDraft}>Discard</button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {status && (
          <span style={{ color: status.type === 'error' ? '#c44' : '#2a9d2a', fontSize: 13 }}>
            {status.message}
          </span>
        )}

        <input
          style={styles.commitInput}
          type="text"
          placeholder={selectedPage ? `Update ${selectedPage} content` : 'Commit message'}
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          disabled={!canCommit}
          onKeyDown={e => e.key === 'Enter' && canCommit && handleCommit()}
        />

        <button
          style={{ ...styles.btn, ...(canCommit ? styles.btnPrimary : styles.btnDisabled) }}
          onClick={handleCommit}
          disabled={!canCommit}
        >
          {committing ? 'Committing…' : 'Commit'}
        </button>

        <span style={styles.userBadge}>{username && `@${username}`}</span>
        <button style={styles.btn} onClick={() => { sessionStorage.removeItem('gitlab_token'); navigate('/'); }}>
          Sign out
        </button>
      </header>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarLabel}>Pages</div>
          {PAGES.map(p => (
            <button
              key={p}
              style={{
                ...styles.pageItem,
                ...(p === selectedPage ? styles.pageItemActive : {}),
              }}
              onClick={() => handlePageSelect(p)}
            >
              <span style={styles.pageName}>{p}</span>
              {hasDraft(p) && p !== selectedPage && (
                <span style={styles.draftDot} title="Unsaved draft">●</span>
              )}
              {p === selectedPage && unsaved && (
                <span style={{ ...styles.draftDot, color: '#e07800' }} title="Unsaved draft">●</span>
              )}
            </button>
          ))}
        </aside>

        <div style={styles.editorPane}>
          {loading ? (
            <div style={styles.placeholder}>Loading…</div>
          ) : !selectedPage ? (
            <div style={styles.placeholder}>Select a page from the sidebar.</div>
          ) : (
            <Editor content={content} onChange={handleContentChange} />
          )}
        </div>

        <div style={styles.previewPane}>
          <Preview selectedPage={selectedPage} content={content} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '0 16px', borderBottom: '1px solid #e0e0e0',
    background: '#fff', flexShrink: 0, height: 50,
  },
  logo: { fontSize: 14, color: '#111', flexShrink: 0 },
  unsavedBadge: { fontSize: 12, color: '#e07800', fontWeight: 600, flexShrink: 0 },
  discardBtn: {
    padding: '3px 10px', borderRadius: 5, border: '1px solid #e0b060',
    background: '#fff8ee', color: '#b06000', cursor: 'pointer', fontSize: 12,
  },
  commitInput: {
    padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd',
    fontSize: 13, width: 220, outline: 'none',
  },
  btn: {
    padding: '5px 14px', borderRadius: 6, border: '1px solid #ddd',
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#333',
    flexShrink: 0,
  },
  btnPrimary: { background: '#1a73e8', color: '#fff', border: 'none', fontWeight: 600 },
  btnDisabled: { background: '#e8e8e8', color: '#aaa', border: 'none', cursor: 'not-allowed' },
  userBadge: { fontSize: 13, color: '#999', flexShrink: 0 },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: 200, flexShrink: 0, borderRight: '1px solid #e8e8e8',
    background: '#fafafa', overflowY: 'auto', paddingTop: 6,
  },
  sidebarLabel: {
    padding: '6px 14px 8px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#bbb',
  },
  pageItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', padding: '7px 14px', border: 'none', background: 'none',
    cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#444',
    transition: 'background 0.1s',
  },
  pageItemActive: { background: '#e8f0fe', color: '#1a73e8', fontWeight: 600 },
  pageName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  draftDot: { fontSize: 9, color: '#e07800', flexShrink: 0, marginLeft: 6 },
  editorPane: {
    width: 500, flexShrink: 0, borderRight: '1px solid #e8e8e8',
    overflowY: 'auto', background: '#fff',
  },
  previewPane: { flex: 1, overflow: 'hidden', background: '#fafafa' },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#ccc', fontSize: 14,
  },
};
