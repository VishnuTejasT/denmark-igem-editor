import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPage, fetchPageHtml, fetchPageList, commitPage, fetchPageMeta, fetchCommitInfo } from '../lib/gitlab';
import { parseSectionsFromHtml } from '../lib/htmlParser';
import { migrateSection, sectionIsFilled, uniqueSectionId, dedupeEmptySubsections, dedupeSections } from '../lib/blocks';
import Editor from '../components/Editor';
import Preview from '../components/Preview';

const EMPTY = { title: '', intro: '', sections: [] };

// ─── helpers ────────────────────────────────────────────────────────────────

function computePageStatus(content) {
  if (!content) return { status: 'unknown', filled: 0, total: 0 };
  const sections = Array.isArray(content.sections) ? content.sections : [];
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
  complete: 'var(--green)',
  partial:  'var(--amber)',
  empty:    'var(--red)',
  unknown:  'var(--ink-300)',
};

function normalizeContent(content, htmlSections) {
  const savedBlocks = {};
  const savedHeadings = {};
  const savedSourceId = {};
  dedupeSections(content.sections || []).forEach(s => {
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
  // A saved section claims its HTML anchor by *either* id or sourceId. Checking
  // only `id` meant that as soon as a heading was renamed (id drifts, sourceId
  // stays pinned to the real anchor) the template's original element looked
  // unclaimed — so it got re-appended as a brand-new phantom section on every
  // load, and the phantom got committed back into the HTML, resurrecting itself
  // forever. Honor sourceId here so a renamed section still owns its anchor.
  const deduped = dedupeSections(content.sections || []);
  const savedIds = deduped.map(s => s.id);
  const claimedHtmlIds = new Set(deduped.flatMap(s => [s.id, s.sourceId].filter(Boolean)));
  const extraHtmlIds = htmlSections.map(s => s.id).filter(id => !claimedHtmlIds.has(id));
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

async function fetchHtmlSections(token, pageName) {
  try {
    const html = await fetchPageHtml(token, pageName);
    return parseSectionsFromHtml(html);
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

    // Load the live page list from GitLab (falls back to the build-time
    // manifest only if that call fails, e.g. transient network error).
    fetchPageList(token)
      .then(list => {
        setPages(list);
        loadAllStatuses(token, list);
      })
      .catch(() => {
        fetch('/wiki-cache/pages-manifest.json')
          .then(r => r.json())
          .then(list => {
            setPages(list);
            loadAllStatuses(token, list);
          })
          .catch(() => setPages([]));
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
        fetchHtmlSections(token, pageName),
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
        if (draft) {
          // A corrupted draft must never be fatal: fall back to the committed
          // content rather than letting a parse/shape error blank the editor.
          let parsed = null;
          try {
            const candidate = JSON.parse(draft);
            if (candidate && Array.isArray(candidate.sections)) parsed = candidate;
          } catch (parseErr) {
            console.error('[wiki-editor] discarding unreadable draft', parseErr);
          }
          if (!parsed) {
            sessionStorage.removeItem(`wiki_draft_${pageName}`);
            setContent(normalizeContent(fetched, sections));
            setLastCommitId(cid);
            lastCommitIdRef.current = cid;
            return;
          }
          const cleaned = {
            ...parsed,
            // sourceId anchors a section to its real HTML element across
            // heading renames. Drafts saved before that field existed (or
            // that otherwise lost it) must get it defaulted here too, not
            // just on a fresh GitLab fetch — otherwise every further rename
            // in this draft loses track of the true anchor and orphans a
            // new duplicate section instead of renaming in place.
            sections: dedupeSections(parsed.sections || []).map(s => ({
              ...s,
              sourceId: s.sourceId || s.id,
              blocks: dedupeEmptySubsections(migrateSection(s)),
            })),
          };
          setContent(cleaned);
          sessionStorage.setItem(`wiki_draft_${pageName}`, JSON.stringify(cleaned));
        } else {
          setContent(normalizeContent(fetched, sections));
        }
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
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <span className="app-logo">
          <span className="app-logo-mark">W</span>
          iGEM Wiki Editor
        </span>

        {unsaved && (
          <>
            <span className="unsaved-badge">unsaved draft</span>
            <button className="btn btn-sm" onClick={discardDraft}>Discard</button>
          </>
        )}

        <div style={{ flex: 1 }} />

        {status && (
          <span className={`status-msg ${status.type === 'error' ? 'error' : 'success'}`}>
            {status.message}
          </span>
        )}

        <input
          className="commit-input"
          type="text"
          placeholder={selectedPage ? `Update ${selectedPage} content` : 'Commit message'}
          value={commitMessage}
          onChange={e => setCommitMessage(e.target.value)}
          disabled={!canCommit}
          onKeyDown={e => e.key === 'Enter' && canCommit && handleCommit()}
        />

        <button
          className="btn btn-primary"
          onClick={handleCommit}
          disabled={!canCommit}
        >
          {committing ? 'Committing…' : 'Commit'}
        </button>

        <span className="user-badge">{username && `@${username}`}</span>
        <button className="btn" onClick={() => { sessionStorage.removeItem('gitlab_token'); navigate('/'); }}>
          Sign out
        </button>
      </header>

      <div className="app-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-label">Pages</div>

          {/* Status legend */}
          <div className="legend">
            <span className="legend-item"><span className="status-dot" style={{ background: STATUS_COLOR.complete }} />done</span>
            <span className="legend-item"><span className="status-dot" style={{ background: STATUS_COLOR.partial }} />partial</span>
            <span className="legend-item"><span className="status-dot" style={{ background: STATUS_COLOR.empty }} />empty</span>
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
                className={`page-item${isActive ? ' active' : ''}`}
                onClick={() => handlePageSelect(p)}
              >
                <span className="status-dot" style={{ background: dotColor }} />
                <span className="page-item-name">{p}</span>
                {fraction && (
                  <span className="page-item-fraction">{fraction}</span>
                )}
                {draft && (
                  <span className="draft-dot" title="Unsaved draft">●</span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Editor pane */}
        <div className="editor-pane">
          {/* Session expired banner */}
          {sessionExpired && (
            <div className="banner banner-error">
              <span>Your GitLab session has expired. Sign out and sign back in to continue editing.</span>
              <button
                className="banner-btn banner-btn-solid"
                onClick={() => { sessionStorage.removeItem('gitlab_token'); navigate('/'); }}
              >
                Sign out
              </button>
            </div>
          )}

          {/* Stale warning banner */}
          {staleWarning && (
            <div className="banner banner-warning">
              <span>
                <strong>{staleWarning.author}</strong> committed to this page
                {staleWarning.mins ? ` ${staleWarning.mins} min ago` : ''}.
                {staleWarning.message ? ` "${staleWarning.message}"` : ''}
                {' '}Reload to get the latest before editing.
              </span>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="banner-btn banner-btn-solid"
                  onClick={() => { setStaleWarning(null); handlePageSelect(selectedPage); }}
                >
                  Reload
                </button>
                <button className="banner-btn banner-btn-ghost" onClick={() => setStaleWarning(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="placeholder">Loading…</div>
          ) : !selectedPage ? (
            <div className="placeholder">Select a page from the sidebar to start editing.</div>
          ) : (
            <Editor content={content} onChange={handleContentChange} />
          )}
        </div>

        {/* Preview pane */}
        <div className="preview-pane">
          <div className="preview-frame-wrap">
            <Preview selectedPage={selectedPage} content={content} token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
