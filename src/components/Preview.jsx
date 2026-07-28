import { useEffect, useRef, useState } from 'react';
import { sectionBodyBlocksHtml, sectionCardsHtml } from '../lib/blocks';

const STATIC_RAW_BASE =
  `https://gitlab.igem.org/${import.meta.env.VITE_GITLAB_REPO_PATH || 'vishnutejast/denmarkwiki'}/-/raw/${import.meta.env.VITE_GITLAB_BRANCH || 'main'}/`;

async function fetchRaw(path) {
  const url = `/wiki-cache/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
  return res.text();
}

// Pre-render all Markdown body fields to HTML before injecting into the iframe.
function renderContent(content) {
  return {
    ...content,
    sections: (content.sections || []).map(s => {
      const items = sectionBodyBlocksHtml(s.blocks);
      return {
        ...s,
        body: items.join('\n'),
        items,
        cards: sectionCardsHtml(s.blocks),
      };
    }),
  };
}

function rewriteAssetUrls(html) {
  return html
    .replace(/(src|href)="static\//g, `$1="${STATIC_RAW_BASE}static/`)
    .replace(/(src|href)='static\//g, `$1='${STATIC_RAW_BASE}static/`);
}

export function buildHtml(rawHtml, css, content) {
  let html = rewriteAssetUrls(rawHtml);
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' blob:;">`;
  const injectedStyle = css ? `<style>${css}</style>` : '';
  const contentJson = JSON.stringify(renderContent(content) || {}).replace(/<\/script/gi, '<\\/script');

  const injectedScript = `<script>
(function() {
  var content = ${contentJson};

  // Resolved-node cache, keyed by section id. Once an id has been resolved to
  // a DOM node (found in the raw template or created by us), every later
  // lookup for that id goes through this cache instead of re-querying the
  // DOM. This is what actually makes section resolution idempotent: the raw
  // wiki template can itself contain duplicate ids (e.g. a section that was
  // duplicated before being committed), and document.getElementById on a
  // duplicate id is not a reliable "have we already handled this?" check —
  // relying on it let createSection() re-fire on every content push and
  // append a fresh duplicate section forever.
  var nodeById = {};
  var tocLinkById = {};
  function seedCaches() {
    // The raw wiki template can itself contain duplicate ids (e.g. a section
    // committed twice before this bug was caught). getElementById only ever
    // resolves the first one, which leaves every later duplicate as a stale,
    // never-updated orphan — and since the reorder pass below only moves
    // elements it actually looks up, that untouched orphan drifts to the
    // front of the page as everything else gets moved past it. Strip
    // duplicates outright at init so every id maps to exactly one node.
    // This has to run after the body has actually been parsed — this script
    // sits in <head>, so running it inline (before DOMContentLoaded) would
    // scan an empty document and silently seed nothing.
    document.querySelectorAll('.toc-section').forEach(function(sec) {
      if (!sec.id) return;
      if (nodeById[sec.id]) { sec.remove(); return; }
      nodeById[sec.id] = sec;
    });
    document.querySelectorAll('.toc-nav a[data-toc]').forEach(function(a) {
      var key = a.getAttribute('data-toc');
      if (!key) return;
      if (tocLinkById[key]) { a.remove(); return; }
      tocLinkById[key] = a;
    });
  }

  function byId(id) {
    if (!id) return null;
    if (nodeById[id]) return nodeById[id];
    // Ids come from slugify() and should already be safe, but escape anyway
    // so a stray character never throws a SyntaxError and aborts the caller.
    try {
      var found = document.getElementById(id) || document.querySelector('.toc-section#' + CSS.escape(id));
      if (found) nodeById[id] = found;
      return found;
    } catch (err) {
      return null;
    }
  }
  function tocLinkFor(id) {
    if (!id) return null;
    if (tocLinkById[id]) return tocLinkById[id];
    var found = document.querySelector('.toc-nav a[data-toc="' + id + '"]');
    if (found) tocLinkById[id] = found;
    return found;
  }
  function renameId(map, oldId, newId, node) {
    if (oldId && map[oldId] === node) delete map[oldId];
    map[newId] = node;
  }
  function pruneUnclaimedSections(claimedIds) {
    // Any .toc-section whose id nothing in the current content resolved to
    // this pass is stale — not just ones we created ourselves. This also
    // catches the original template's own elements: e.g. a section whose
    // sourceId was lost at some point (older draft, or a bug since fixed)
    // drifts its id away on every rename without ever being told to let go
    // of the old anchor, leaving the previous real element behind as a
    // permanent duplicate that keeps its last-known content forever.
    document.querySelectorAll('.toc-section').forEach(function(sec) {
      if (claimedIds[sec.id]) return;
      var tocLink = tocLinkFor(sec.id);
      if (tocLink) { tocLink.remove(); delete tocLinkById[sec.id]; }
      delete nodeById[sec.id];
      sec.remove();
    });
  }
  function createSection(s) {
    // Guard against re-creating a section that already exists under this id —
    // checked via the node cache, not a DOM re-query, so it holds even when
    // the raw template has duplicate ids or a lookup would otherwise miss.
    var existing = byId(s.id);
    if (existing) return existing;

    var container = document.querySelector('.page-content .container');
    if (!container) return null;

    var sec = document.createElement('section');
    sec.className = 'wiki-section toc-section';
    sec.id = s.id;
    sec.setAttribute('data-injected', 'true');

    var h3 = document.createElement('h3');
    h3.textContent = s.heading || '';
    sec.appendChild(h3);

    var block = document.createElement('div');
    block.className = 'section-block';
    sec.appendChild(block);

    container.appendChild(sec);
    nodeById[s.id] = sec;

    var tocNav = document.querySelector('.toc-nav');
    if (tocNav && !tocLinkFor(s.id)) {
      var link = document.createElement('a');
      link.setAttribute('href', '#' + s.id);
      link.setAttribute('data-toc', s.id);
      link.textContent = s.heading || '';
      tocNav.appendChild(link);
      tocLinkById[s.id] = link;
    }

    return sec;
  }
  function applyContent(c) {
    try {
      var h2 = document.querySelector('.page-hero h2');
      if (h2 && c.title) h2.textContent = c.title;
      var summary = document.querySelector('.page-hero .summary');
      if (summary && c.intro) summary.textContent = c.intro;
      var claimedIds = {};
      (c.sections || []).forEach(function(s) {
        try {
          // Look the element up by its original anchor (sourceId), since id
          // may have already drifted away from it to match a renamed heading.
          var lookupId = s.sourceId || s.id;
          var sec = byId(lookupId) || byId(s.id);
          if (!sec) {
            sec = createSection(s);
            if (!sec) return;
          } else {
            if (sec.id !== s.id) {
              var oldId = sec.id;
              renameId(nodeById, oldId, s.id, sec);
              sec.id = s.id;
              var linkToRename = tocLinkFor(oldId);
              if (linkToRename) renameId(tocLinkById, oldId, s.id, linkToRename);
            }
            if (s.heading) {
              var h3 = sec.querySelector('h3');
              if (h3) h3.textContent = s.heading;
            }
            var tocLink = tocLinkFor(s.id) || tocLinkFor(lookupId);
            if (tocLink) {
              if (s.heading) tocLink.textContent = s.heading;
              if (tocLink.getAttribute('data-toc') !== s.id) {
                tocLink.setAttribute('data-toc', s.id);
                tocLink.setAttribute('href', '#' + s.id);
              }
            } else {
              // A section can exist with no matching nav link (e.g. lost by
              // this same duplicate-id bug in an earlier commit) — backfill
              // it instead of leaving the section absent from "On this page".
              var tocNavFallback = document.querySelector('.toc-nav');
              if (tocNavFallback) {
                var newLink = document.createElement('a');
                newLink.setAttribute('href', '#' + s.id);
                newLink.setAttribute('data-toc', s.id);
                newLink.textContent = s.heading || '';
                tocNavFallback.appendChild(newLink);
                tocLinkById[s.id] = newLink;
              }
            }
          }
          claimedIds[sec.id] = true;
          var refsList = sec.querySelector('.references-list');
          if (refsList) {
            var items = s.items || [];
            if (items.length) {
              refsList.innerHTML = items.map(function(h) { return '<li class="section-block">' + h + '</li>'; }).join('\\n');
            }
          } else {
            // Replace the section's cards wholesale — a section can hold
            // several .section-block cards now (standalone blocks and
            // subsections each get their own), so writing into a single
            // existing one is not enough.
            // NB: no backticks or dollar-braces anywhere in this script — it
            // lives inside a JS template literal, so either would terminate
            // it early and turn prose into executable code.
            var cards = s.cards || [];
            if (cards.length) {
              var existingCards = [];
              for (var ci = 0; ci < sec.children.length; ci++) {
                var childEl = sec.children[ci];
                if (childEl.classList && childEl.classList.contains('section-block')) {
                  existingCards.push(childEl);
                }
              }
              existingCards.forEach(function(el) { el.remove(); });
              var tmp = document.createElement('div');
              tmp.innerHTML = cards.join('\\n');
              while (tmp.firstElementChild) sec.appendChild(tmp.firstElementChild);
            }
          }
        } catch (sectionErr) {
          console.error('[wiki-preview] failed to apply section', s && s.id, sectionErr);
        }
      });
      pruneUnclaimedSections(claimedIds);
      var container = document.querySelector('.page-content .container');
      var tocNav = document.querySelector('.toc-nav');
      (c.sections || []).forEach(function(s) {
        var sec = byId(s.id);
        if (sec && container) container.appendChild(sec);
        var tocLink = tocLinkFor(s.id);
        if (tocLink && tocNav) tocNav.appendChild(tocLink);
      });
    } catch (err) {
      console.error('[wiki-preview] applyContent failed', err);
    }
  }
  function init() {
    seedCaches();
    applyContent(content);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'WIKI_CONTENT') applyContent(e.data.content);
  });
})();
<\/script>`;

  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + cspMeta);
  }
  if (html.includes('</head>')) {
    html = html.replace('</head>', injectedStyle + injectedScript + '</head>');
  } else {
    html = cspMeta + injectedStyle + injectedScript + html;
  }

  return html;
}

export default function Preview({ selectedPage, content }) {
  const iframeRef = useRef(null);
  const iframeLoadedRef = useRef(false);
  const [rawHtml, setRawHtml] = useState(null);
  const [css, setCss] = useState('');
  const [fetchError, setFetchError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedPage) {
      setRawHtml(null);
      setCss('');
      setFetchError(null);
      return;
    }
    setLoading(true);
    setFetchError(null);

    Promise.all([
      fetchRaw(`wiki/pages/${selectedPage}.html`),
      fetchRaw('static/style.css').catch(() => ''),
      fetchRaw('static/denmark.css').catch(() => ''),
      fetchRaw('static/section-blocks.css').catch(() => ''),
    ])
      .then(([html, style, denmark, sectionBlocks]) => {
        setRawHtml(html);
        setCss([style, denmark, sectionBlocks].filter(Boolean).join('\n'));
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [selectedPage]);

  // Rebuild iframe when page template or CSS changes
  useEffect(() => {
    if (!rawHtml) return;
    iframeLoadedRef.current = false;
    const iframe = iframeRef.current;
    if (iframe) iframe.srcdoc = buildHtml(rawHtml, css, content);
  }, [rawHtml, css]);

  // Push content updates without reloading the iframe
  useEffect(() => {
    if (!rawHtml) return;
    const iframe = iframeRef.current;
    if (iframe && iframeLoadedRef.current && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'WIKI_CONTENT', content: renderContent(content) }, '*');
    }
  }, [content]);

  if (!selectedPage) {
    return <div style={styles.placeholder}>Select a page to preview.</div>;
  }
  if (loading) {
    return <div style={styles.placeholder}>Loading preview…</div>;
  }
  if (fetchError) {
    return <div style={styles.error}>Preview error: {fetchError}</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={styles.frame}
      title="Wiki Preview"
      onLoad={() => {
        iframeLoadedRef.current = true;
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'WIKI_CONTENT', content: renderContent(content) }, '*');
        }
      }}
    />
  );
}

const styles = {
  frame: { width: '100%', height: '100%', border: 'none', display: 'block' },
  placeholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: '#bbb', fontSize: 14,
  },
  error: { padding: 24, color: '#c00', fontSize: 14 },
};
