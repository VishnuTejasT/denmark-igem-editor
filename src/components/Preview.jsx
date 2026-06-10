import { useEffect, useRef, useState } from 'react';

const STATIC_RAW_BASE =
  `https://gitlab.igem.org/${import.meta.env.VITE_GITLAB_REPO_PATH || 'vishnutejast/denmarkwiki'}/-/raw/${import.meta.env.VITE_GITLAB_BRANCH || 'main'}/`;

async function fetchRaw(path) {
  const url = `/api/raw?path=${encodeURIComponent(path)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
  return res.text();
}

function rewriteAssetUrls(html) {
  return html
    .replace(/(src|href)="static\//g, `$1="${STATIC_RAW_BASE}static/`)
    .replace(/(src|href)='static\//g, `$1='${STATIC_RAW_BASE}static/`);
}

function buildHtml(rawHtml, css, content) {
  let html = rewriteAssetUrls(rawHtml);

  const injectedStyle = css ? `<style>${css}</style>` : '';

  const contentJson = JSON.stringify(content || {}).replace(/<\/script/gi, '<\\/script');

  const injectedScript = `<script>
(function() {
  var content = ${contentJson};
  var originals = new WeakMap();
  function set(el, val) {
    if (!el) return;
    if (!originals.has(el)) originals.set(el, el.innerHTML);
    el.innerHTML = val ? val : originals.get(el);
  }
  function applyContent(c) {
    set(document.querySelector('.page-hero h2'), c.title);
    set(document.querySelector('.page-hero .summary'), c.intro);
    (c.sections || []).forEach(function(s) {
      var sec = document.querySelector('.toc-section#' + s.id);
      if (!sec) return;
      set(sec.querySelector('h3'), s.heading);
      var firstBlock = (s.blocks || [])[0];
      if (firstBlock) set(sec.querySelector('.section-block'), firstBlock.body);
    });
  }
  applyContent(content);
})();
<\/script>`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', injectedStyle + injectedScript + '</head>');
  } else {
    html = injectedStyle + injectedScript + html;
  }

  return html;
}

export default function Preview({ selectedPage, content }) {
  const iframeRef = useRef(null);
  const blobUrlRef = useRef(null);
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
    ])
      .then(([html, style, denmark]) => {
        setRawHtml(html);
        setCss([style, denmark].filter(Boolean).join('\n'));
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [selectedPage]);

  // Rebuild the entire iframe blob URL whenever the page template, css, or content changes
  useEffect(() => {
    if (!rawHtml) return;

    const html = buildHtml(rawHtml, css, content);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = url;

    const iframe = iframeRef.current;
    if (iframe) iframe.src = url;

    return () => {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
    };
  }, [rawHtml, css, content]);

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
    />
  );
}

const styles = {
  frame: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#999',
    fontSize: 15,
  },
  error: {
    padding: 24,
    color: '#c00',
    fontSize: 14,
  },
};
