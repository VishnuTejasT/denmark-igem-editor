import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'https://dhs-editor.pro/callback';

export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) {
      setError('No authorization code received from GitLab.');
      return;
    }

    fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: REDIRECT_URI }),
    })
      .then(async res => {
        const data = await res.json();
        console.log('[callback] /api/token response', res.status, data);
        if (data.access_token) {
          sessionStorage.setItem('gitlab_token', data.access_token);
          navigate('/editor');
        } else {
          const detail = data.detail || (data.gitlab_error ? JSON.stringify(data.gitlab_error) : null);
          const msg = [data.error, detail].filter(Boolean).join(' — ');
          setError(msg || 'Authentication failed.');
        }
      })
      .catch(err => {
        console.error('[callback] Network error:', err);
        setError(`Network error: ${err.message}`);
      });
  }, [navigate]);

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.errorText}>{error}</p>
          <a href="/" style={styles.link}>Try again</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.spinner} />
      <p style={styles.text}>Signing in…</p>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 16,
    background: 'var(--bg)',
    fontFamily: 'var(--font-ui)',
  },
  text: { color: 'var(--ink-500)', fontSize: 14 },
  spinner: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: '3px solid var(--ink-200)',
    borderTopColor: 'var(--accent)',
    animation: 'wiki-spin 0.8s linear infinite',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--ink-150)',
    borderRadius: 14,
    padding: '32px 36px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-md)',
  },
  errorText: { color: 'var(--red)', fontSize: 13.5, margin: '0 0 12px', maxWidth: 340 },
  link: { fontSize: 13.5, fontWeight: 600 },
};
