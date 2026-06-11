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
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' blob:;">`;

  const injectedStyle = css ? `<style>${css}</style>` : '';

  const contentJson = JSON.stringify(content || {}).replace(/<\/script/gi, '<\\/script');

  const injectedScript = `<script>
(function() {
  var content = ${contentJson};
  function applyContent(c) {
    console.log('toc-section#overview found:', !!document.querySelector('.toc-section#overview'));
    console.log('s.blocks[0].body:', c.sections && c.sections[0] && c.sections[0].blocks && c.sections[0].blocks[0] && c.sections[0].blocks[0].body);
    var h2 = document.querySelector('.page-hero h2');
    if (h2 && c.title) h2.textContent = c.title;
    var summary = document.querySelector('.page-hero .summary');
    if (summary && c.intro) summary.textContent = c.intro;
    (c.sections || []).forEach(function(s) {
      var sec = document.querySelector('.toc-section#' + s.id);
      if (!sec) return;
      console.log('sec.id:', sec.id, 'sec.innerHTML:', sec.innerHTML.substring(0, 100));
      if (s.heading) { var h3 = sec.querySelector('h3'); if (h3) h3.textContent = s.heading; }
      var firstBlock = (s.blocks || [])[0];
      if (firstBlock && firstBlock.body) {
        var block = sec.querySelector('.section-block');
        console.log('block found:', !!block);
        if (block) {
          block.innerHTML = firstBlock.body;
          console.log('injected into block:', block.className, 'value:', firstBlock.body.substring(0, 50));
        }
      }
    });
  }
  function runApplyContent() {
    console.log('applyContent called', content.sections ? content.sections.length : undefined);
    applyContent(content);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runApplyContent);
  } else {
    runApplyContent();
  }
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

    console.log('rebuilding blob', JSON.stringify(content || {}).slice(0, 50));
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
