import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPage, commitPage, fetchPageMeta, fetchCommitInfo } from '../lib/gitlab';
import { parseSectionsFromHtml } from '../lib/htmlParser';
import { migrateSection, sectionIsFilled, uniqueSectionId } from '../lib/blocks';
import Editor from '../components/Editor';
import Preview from '../components/Preview';

const EMPTY = { title: '', intro: '', sections: [] };

// ─── helpers ────────────────────────────────────────────────────────────────

function computePageStatus(content) {
  if (!content) return { status: 'unknown', filled: 0, total: 0 };
  const sections = content.sections || [];
  const filled = sections.filter(s => sectionIsFilled(s)).length;
  const total = sections.length;
  const hasTitle = !!(content.title?.trim() && content.title !== '--');

  let status;
  if (filled === total && total > 0 && hasTitle) status = 'complete';
  else if (filled > 0 || hasTitle) status = 'partial';
  else status = 'empty';

  return { status, filled, total };
}

const STATUS_COLOR = {
  complete: '#16a34a',
  partial:  '#ca8a04',
  empty:    '#dc2626',
  unknown:  '#d1d5db',
};

function normalizeContent(content, htmlSections) {
  const savedBlocks = {};
  const savedHeadings = {};
  const savedSourceId = {};
  (content.sections || []).forEach(s => {
    savedBlocks[s.id] = migrateSection(s);
    if (s.heading) savedHeadings[s.id] = s.heading;
    // sourceId is the anchor id actually present in the HTML template — kept
    // stable even as the user renames the section (and its displayed `id`
    // drifts to match), so commit/preview can still find the right element.
    savedSourceId[s.id] = s.sourceId || s.id;
  });
  const htmlHeadingById = {};
  htmlSections.forEach(({ id, heading }) => { htmlHeadingById[id] = heading; });

  // Saved JSON order is the source of truth (it's what the user arranged via
  // "move section"). Any section present in the HTML template but not yet in
  // the saved JSON (e.g. added to the page template since the last commit)
  // gets appended at the end.
  const savedIds = (content.sections || []).map(s => s.id);
  const extraHtmlIds = htmlSections.map(s => s.id).filter(id => !savedIds.includes(id));
  const orderedIds = [...savedIds, ...extraHtmlIds];

  const sections = orderedIds.map(id => ({
    id,
    heading: savedHeadings[id] || htmlHeadingById[id] || id,
    blocks: savedBlocks[id] || [],
    sourceId: savedSourceId[id] || id,
  }));

  // Self-heal id collisions: a section's `id` must not equal another
  // section's `sourceId` (its real HTML anchor), or the preview/commit DOM
  // lookup — which matches on sourceId first — hijacks that other
  // section's element instead of this one's. This can happen with data
  // saved before ids were reserved against sourceIds too.
  const sourceIdOwner = {};
  sections.forEach(s => { if (s.sourceId) sourceIdOwner[s.sourceId] = s; });
  sections.forEach(s => {
    const owner = sourceIdOwner[s.id];
    if (owner && owner !== s) {
      const reserved = sections.filter(o => o !== s).flatMap(o => [o.id, o.sourceId].filter(Boolean));
      s.id = uniqueSectionId(s.heading, reserved);
    }
  });

  return {
    title: content.title || '',
    intro: content.intro || '',
    sections,
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

// ─── component ──────────────────────────────────────────────────────────────

export default function EditorPage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('gitlab_token');

  const [pages, setPages]             = useState([]);
  const [username, setUsername]       = useState('');
  const [selectedPage, setSelectedPage] = useState('');
  const [content, setContent]         = useState(EMPTY);
  const [lastCommitId, setLastCommitId] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [committing, setCommitting]   = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [status, setStatus]           = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [pageStatuses, setPageStatuses] = useState({});
  const [staleWarning, setStaleWarning] = useState(null);
  const [, forceUpdate] = useState(0);
  const pollingRef = useRef(null);
  const lastCommitIdRef = useRef(null);

  // Auth check + username + manifest
  useEffect(() => {
    if (!token) { navigate('/'); return; }

    const host = (import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org').replace(/^https?:\/\//, '');
    fetch(`https://${host}/api/v4/user`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsername(d.username || d.name || ''))
      .catch(() => {});

    // Load page list from the build-time manifest, then kick off status loading
    fetch('/wiki-cache/pages-manifest.json')
      .then(r => r.json())
      .then(list => {
        setPages(list);
        loadAllStatuses(token, list);
      })
      .catch(() => {
        // Manifest missing (local dev without a build) — fall back to empty list
        setPages([]);
      });
  }, [token]);

  const loadAllStatuses = (tok, list) => {
    list.forEach(async (pageName) => {
      try {
        const { content: c } = await fetchPage(tok, pageName);
        setPageStatuses(prev => ({ ...prev, [pageName]: computePageStatus(c) }));
      } catch (e) {
        if (e.code === 'AUTH') {
          setSessionExpired(true);
        } else {
          // NOT_FOUND = page not written yet → shows as empty (red), which is correct
          setPageStatuses(prev => ({ ...prev, [pageName]: { status: 'empty', filled: 0, total: 0 } }));
        }
      }
    });
  };

  // Update current page status live as user edits
  useEffect(() => {
    if (selectedPage) {
      setPageStatuses(prev => ({ ...prev, [selectedPage]: computePageStatus(content) }));
    }
  }, [content, selectedPage]);

  // Poll every 30s for concurrent edits
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setStaleWarning(null);
    if (!selectedPage || !token) return;

    pollingRef.current = setInterval(async () => {
      try {
        const meta = await fetchPageMeta(token, selectedPage);
        if (!meta) return;
        const baseline = lastCommitIdRef.current;
        if (baseline && meta.lastCommitId !== baseline) {
          const commit = await fetchCommitInfo(token, meta.lastCommitId);
          const mins = commit
            ? Math.max(1, Math.round((Date.now() - new Date(commit.committed_date)) / 60000))
            : null;
          setStaleWarning({
            author: commit?.author_name || 'Someone',
            mins,
            message: commit?.message?.split('\n')[0] || '',
          });
        }
      } catch {}
    }, 30000);

    return () => clearInterval(pollingRef.current);
  }, [selectedPage, token]);

  const handlePageSelect = async (pageName) => {
    if (pageName === selectedPage) return;
    setSelectedPage(pageName);
    setContent(EMPTY);
    setLastCommitId(null);
    lastCommitIdRef.current = null;
    setStatus(null);
    setCommitMessage('');
    setStaleWarning(null);
    if (!pageName) return;

    setLoading(true);
    try {
      const [jsonResult, htmlSections] = await Promise.allSettled([
        fetchPage(token, pageName),
        fetchHtmlSections(pageName),
      ]);

      const sections = htmlSections.status === 'fulfilled' ? htmlSections.value : [];

      if (jsonResult.status === 'rejected') {
        const err = jsonResult.reason;
        if (err.code === 'AUTH') {
          setSessionExpired(true);
        } else if (err.code !== 'NOT_FOUND') {
          // NOT_FOUND just means no content saved yet — don't show as an error
          setStatus({ type: 'error', message: err.message });
        }
        setContent({ title: '', intro: '', sections: sections.map(s => ({ ...s, blocks: [], sourceId: s.id })) });
      } else {
        const { content: fetched, lastCommitId: cid } = jsonResult.value;
        const draft = sessionStorage.getItem(`wiki_draft_${pageName}`);
        setContent(draft ? JSON.parse(draft) : normalizeContent(fetched, sections));
        setLastCommitId(cid);
        lastCommitIdRef.current = cid;
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
      // Sections just committed now really exist in the wiki HTML with a frozen
      // id — stop treating them as "new" so further heading edits don't reslug them.
      setContent(prev => ({
        ...prev,
        sections: prev.sections.map(s => s.isNew ? { ...s, isNew: false } : s),
      }));
      setStaleWarning(null);
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
      {/* Header */}
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
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.sidebarLabel}>Pages</div>

          {/* Status legend */}
          <div style={styles.legend}>
            <span style={styles.legendItem}><span style={{ ...styles.dot, background: STATUS_COLOR.complete }} />done</span>
            <span style={styles.legendItem}><span style={{ ...styles.dot, background: STATUS_COLOR.partial }} />partial</span>
            <span style={styles.legendItem}><span style={{ ...styles.dot, background: STATUS_COLOR.empty }} />empty</span>
          </div>

          {pages.map(p => {
            const ps = pageStatuses[p];
            const dotColor = ps ? STATUS_COLOR[ps.status] : STATUS_COLOR.unknown;
            const fraction = ps && ps.total > 0 ? `${ps.filled}/${ps.total}` : null;
            const isActive = p === selectedPage;
            const draft = hasDraft(p);

            return (
              <button
                key={p}
                style={{ ...styles.pageItem, ...(isActive ? styles.pageItemActive : {}) }}
                onClick={() => handlePageSelect(p)}
              >
                <span style={{ ...styles.statusDot, background: dotColor }} />
                <span style={styles.pageName}>{p}</span>
                {fraction && (
                  <span style={styles.fraction}>{fraction}</span>
                )}
                {draft && (
                  <span style={styles.draftDot} title="Unsaved draft">●</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Editor pane */}
        <div style={styles.editorPane}>
          {/* Session expired banner */}
          {sessionExpired && (
            <div style={styles.authBanner}>
              <span>🔒 Your GitLab session has expired. Sign out and sign back in to continue editing.</span>
              <button
                style={styles.reloadBtn}
                onClick={() => { sessionStorage.removeItem('gitlab_token'); navigate('/'); }}
              >
                Sign out
              </button>
            </div>
          )}

          {/* Stale warning banner */}
          {staleWarning && (
            <div style={styles.staleBanner}>
              <span>
                ⚠️ <strong>{staleWarning.author}</strong> committed to this page
                {staleWarning.mins ? ` ${staleWarning.mins} min ago` : ''}.
                {staleWarning.message ? ` "${staleWarning.message}"` : ''}
                {' '}Reload to get the latest before editing.
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={styles.reloadBtn}
                  onClick={() => { setStaleWarning(null); handlePageSelect(selectedPage); }}
                >
                  Reload
                </button>
                <button style={styles.dismissBtn} onClick={() => setStaleWarning(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={styles.placeholder}>Loading…</div>
          ) : !selectedPage ? (
            <div style={styles.placeholder}>Select a page from the sidebar.</div>
          ) : (
            <Editor content={content} onChange={handleContentChange} />
          )}
        </div>

        {/* Preview pane */}
        <div style={styles.previewPane}>
          <Preview selectedPage={selectedPage} content={content} />
        </div>
      </div>
    </div>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

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
    background: '#fff', cursor: 'pointer', fontSize: 13, color: '#333', flexShrink: 0,
  },
  btnPrimary: { background: '#1a73e8', color: '#fff', border: 'none', fontWeight: 600 },
  btnDisabled: { background: '#e8e8e8', color: '#aaa', border: 'none', cursor: 'not-allowed' },
  userBadge: { fontSize: 13, color: '#999', flexShrink: 0 },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: 210, flexShrink: 0, borderRight: '1px solid #e8e8e8',
    background: '#fafafa', overflowY: 'auto', paddingTop: 6,
  },
  sidebarLabel: {
    padding: '6px 14px 4px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em', color: '#bbb',
  },
  legend: {
    display: 'flex', gap: 10, padding: '4px 14px 10px', borderBottom: '1px solid #ebebeb',
    marginBottom: 4,
  },
  legendItem: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 10, color: '#999',
  },
  dot: {
    width: 7, height: 7, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
  },
  pageItem: {
    display: 'flex', alignItems: 'center', gap: 7,
    width: '100%', padding: '7px 14px', border: 'none', background: 'none',
    cursor: 'pointer', textAlign: 'left', fontSize: 13, color: '#444',
  },
  pageItemActive: { background: '#e8f0fe', color: '#1a73e8', fontWeight: 600 },
  statusDot: {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
  },
  pageName: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  fraction: { fontSize: 10, color: '#aaa', flexShrink: 0, fontVariantNumeric: 'tabular-nums' },
  draftDot: { fontSize: 9, color: '#e07800', flexShrink: 0 },
  editorPane: {
    width: 500, flexShrink: 0, borderRight: '1px solid #e8e8e8',
    overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column',
  },
  previewPane: { flex: 1, overflow: 'hidden', background: '#fafafa' },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#ccc', fontSize: 14,
  },
  staleBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 16px', background: '#fff8e1', borderBottom: '1px solid #f0c040',
    fontSize: 13, color: '#7a5c00', flexShrink: 0,
  },
  authBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    padding: '10px 16px', background: '#fef2f2', borderBottom: '1px solid #fca5a5',
    fontSize: 13, color: '#7f1d1d', flexShrink: 0,
  },
  reloadBtn: {
    padding: '4px 12px', borderRadius: 5, border: '1px solid #c09000',
    background: '#fff3c0', color: '#7a5c00', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  dismissBtn: {
    padding: '4px 10px', borderRadius: 5, border: '1px solid #ddd',
    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 12,
  },
};
