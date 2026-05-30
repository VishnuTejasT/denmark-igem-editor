import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const REDIRECT_URI = 'https://project-qznrm.vercel.app/callback';

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
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          sessionStorage.setItem('gitlab_token', data.access_token);
          navigate('/editor');
        } else {
          setError(data.error || 'Authentication failed.');
        }
      })
      .catch(() => setError('Network error during authentication.'));
  }, [navigate]);

  if (error) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'red' }}>{error}</p>
        <a href="/">Try again</a>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <p>Signing in…</p>
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
    color: '#444',
  },
};
