import { useEffect, useRef, useState } from 'react';

const STATIC_RAW_BASE =
  'https://gitlab.igem.org/vishnutejast/denmarkwiki/-/raw/feature/content-system/';

async function fetchRaw(path) {
  const res = await fetch(`/api/raw?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`${res.status} fetching ${path}`);
  return res.text();
}

function rewriteAssetUrls(html) {
  return html
    .replace(/(src|href)="static\//g, `$1="${STATIC_RAW_BASE}wiki/static/`)
    .replace(/(src|href)='static\//g, `$1='${STATIC_RAW_BASE}wiki/static/`);
}

function buildHtml(rawHtml, css) {
  let html = rewriteAssetUrls(rawHtml);

  const injectedStyle = css ? `<style>${css}</style>` : '';

  const injectedScript = `<script>
(function() {
  var originals = new WeakMap();
  function set(el, val) {
    if (!el) return;
    if (!originals.has(el)) originals.set(el, el.innerHTML);
    el.innerHTML = val ? val : originals.get(el);
  }
  function applyContent(c) {
    set(document.querySelector('.page-hero h2'), c.title);
    set(document.querySelector('.page-hero .summary'), c.intro);
    var sections = document.querySelectorAll('.toc-section');
    (c.sections || []).forEach(function(s, i) {
      var sec = sections[i];
      if (!sec) return;
      set(sec.querySelector('h3'), s.heading);
      set(sec.querySelector('.placeholder-block'), s.body);
    });
  }
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'WIKI_CONTENT') applyContent(e.data.content);
  });
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
  const prevSectionsLenRef = useRef(null);
  const contentRef = useRef(content);
  contentRef.current = content;
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
      fetchRaw('wiki/static/style.css').catch(() => ''),
      fetchRaw('wiki/static/denmark.css').catch(() => ''),
    ])
      .then(([html, style, denmark]) => {
        setRawHtml(html);
        setCss([style, denmark].filter(Boolean).join('\n'));
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoading(false));
  }, [selectedPage, token]);

  // Rebuild iframe blob URL only when the page template changes
  useEffect(() => {
    if (!rawHtml) return;

    const html = buildHtml(rawHtml, css);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = url;

    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.onload = () => {
      iframe.contentWindow?.postMessage(
        { type: 'WIKI_CONTENT', content: contentRef.current }, '*'
      );
    };
    iframe.src = url;

    return () => {
      iframe.onload = null;
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
    };
  }, [rawHtml, css]);

  // Push content updates into the loaded iframe without reloading it
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !rawHtml) return;
    const newLen = content?.sections?.length ?? 0;
    const prevLen = prevSectionsLenRef.current;
    prevSectionsLenRef.current = newLen;
    if (prevLen !== null && newLen !== prevLen) {
      const html = buildHtml(rawHtml, css);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      iframe.onload = () => {
        iframe.contentWindow?.postMessage({ type: 'WIKI_CONTENT', content }, '*');
      };
      iframe.src = url;
    } else {
      iframe.contentWindow.postMessage({ type: 'WIKI_CONTENT', content }, '*');
    }
  }, [content, rawHtml]);

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
