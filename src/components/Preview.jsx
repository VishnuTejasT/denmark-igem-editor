import { useEffect, useRef, useState } from 'react';

const RAW_BASE = 'https://gitlab.igem.org/vishnutejast/denmarkwiki/-/raw/feature/content-system/';

async function fetchRaw(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return res.text();
}

function rewriteAssetUrls(html) {
  return html
    .replace(/(src|href)="static\//g, `$1="${RAW_BASE}wiki/static/`)
    .replace(/(src|href)='static\//g, `$1='${RAW_BASE}wiki/static/`);
}

function buildHtml(rawHtml, css, content) {
  let html = rewriteAssetUrls(rawHtml);

  const injectedStyle = css ? `<style>${css}</style>` : '';

  // Script sets window.__WIKI_CONTENT and tries common data-content-key selectors
  const injectedScript = `<script>
(function() {
  var c = ${JSON.stringify(content)};
  window.__WIKI_CONTENT = c;
  function set(sel, val) {
    var el = document.querySelector(sel);
    if (el) el.textContent = val;
  }
  function run() {
    set('[data-content-key="title"]', c.title);
    set('[data-content-key="intro"]', c.intro);
    (c.sections || []).forEach(function(s, i) {
      set('[data-content-key="sections.' + i + '.heading"]', s.heading);
      set('[data-content-key="sections.' + i + '.body"]', s.body);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
<\/script>`;

  if (html.includes('</head>')) {
    html = html.replace('</head>', injectedStyle + injectedScript + '</head>');
  } else {
    html = injectedStyle + injectedScript + html;
  }

  return html;
}

export default function Preview({ selectedPage, token, content }) {
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

    const htmlUrl = `${RAW_BASE}wiki/pages/${selectedPage}.html`;
    const styleUrl = `${RAW_BASE}wiki/static/style.css`;
    const denmarkUrl = `${RAW_BASE}wiki/static/denmark.css`;

    Promise.all([
      fetchRaw(htmlUrl, token),
      fetchRaw(styleUrl, token).catch(() => ''),
      fetchRaw(denmarkUrl, token).catch(() => ''),
    ])
      .then(([html, style, denmark]) => {
        setRawHtml(html);
        setCss([style, denmark].filter(Boolean).join('\n'));
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [selectedPage, token]);

  useEffect(() => {
    if (!rawHtml) return;

    const html = buildHtml(rawHtml, css, content);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = url;

    if (iframeRef.current) iframeRef.current.src = url;

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
