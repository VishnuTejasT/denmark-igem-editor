import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';

marked.use({ gfm: true, breaks: true });

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
    sections: (content.sections || []).map(s => ({
      ...s,
      body: s.body ? marked(s.body) : '',
    })),
  };
}

function rewriteAssetUrls(html) {
  return html
    .replace(/(src|href)="static\//g, `$1="${STATIC_RAW_BASE}static/`)
    .replace(/(src|href)='static\//g, `$1='${STATIC_RAW_BASE}static/`);
}

function buildHtml(rawHtml, css, content) {
  let html = rewriteAssetUrls(rawHtml);
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' blob:;">`;
  const injectedStyle = css ? `<style>${css}</style>` : '';
  const contentJson = JSON.stringify(renderContent(content) || {}).replace(/<\/script/gi, '<\\/script');

  const injectedScript = `<script>
(function() {
  var content = ${contentJson};
  function applyContent(c) {
    var h2 = document.querySelector('.page-hero h2');
    if (h2 && c.title) h2.textContent = c.title;
    var summary = document.querySelector('.page-hero .summary');
    if (summary && c.intro) summary.textContent = c.intro;
    (c.sections || []).forEach(function(s) {
      var sec = document.querySelector('.toc-section#' + s.id);
      if (!sec) return;
      if (s.heading) {
        var h3 = sec.querySelector('h3');
        if (h3) h3.textContent = s.heading;
        var tocLink = document.querySelector('.toc-nav a[data-toc="' + s.id + '"]');
        if (tocLink) tocLink.textContent = s.heading;
      }
      var body = s.body || ((s.blocks || [])[0] || {}).body || '';
      if (body) {
        var block = sec.querySelector('.section-block');
        if (block) block.innerHTML = body;
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { applyContent(content); });
  } else {
    applyContent(content);
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
