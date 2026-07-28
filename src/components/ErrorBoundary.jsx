import { Component } from 'react';

// A crash anywhere in the tree used to unmount everything and leave a blank
// white page with the reason only visible in the devtools console. Show it on
// screen instead, along with the two recovery actions that actually fix the
// common causes (a corrupted page draft, or stale cached code).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[wiki-editor] crashed:', error, info);
  }

  clearDrafts() {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('wiki_draft_'))
      .forEach(k => sessionStorage.removeItem(k));
    window.location.reload();
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const detail = [
      error.message || String(error),
      error.stack || '',
      info?.componentStack || '',
    ].filter(Boolean).join('\n\n');

    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>The editor hit an error</h1>
        <p style={styles.lead}>
          Nothing was committed. Your saved wiki content on GitLab is untouched — this is a
          crash in the editor UI itself.
        </p>

        <div style={styles.actions}>
          <button style={styles.primary} onClick={() => this.clearDrafts()}>
            Discard local drafts &amp; reload
          </button>
          <button style={styles.secondary} onClick={() => window.location.reload()}>
            Just reload
          </button>
        </div>

        <p style={styles.hint}>
          If it keeps happening, copy the details below — they say exactly what broke.
        </p>
        <pre style={styles.pre}>{detail}</pre>
      </div>
    );
  }
}

const styles = {
  wrap: {
    maxWidth: 780, margin: '0 auto', padding: '48px 24px',
    fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222',
  },
  title: { fontSize: 22, margin: '0 0 10px' },
  lead: { fontSize: 14, lineHeight: 1.6, color: '#555', margin: '0 0 20px' },
  actions: { display: 'flex', gap: 10, marginBottom: 22 },
  primary: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#1a73e8', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
  },
  secondary: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #ddd',
    background: '#fff', color: '#333', fontSize: 13, cursor: 'pointer',
  },
  hint: { fontSize: 13, color: '#777', margin: '0 0 8px' },
  pre: {
    background: '#f6f6f6', border: '1px solid #e2e2e2', borderRadius: 8,
    padding: 14, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
    wordBreak: 'break-word', maxHeight: 360, overflow: 'auto', color: '#444',
  },
};
