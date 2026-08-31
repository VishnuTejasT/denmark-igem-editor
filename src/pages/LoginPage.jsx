const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'https://dhs-editor.pro/callback';

export default function LoginPage() {
  const handleLogin = () => {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GITLAB_APP_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'api',
    });
    const rawHost = import.meta.env.VITE_GITLAB_HOST || 'gitlab.igem.org';
    const gitlabHost = rawHost.replace(/^https?:\/\//, '');
    window.location.href = `https://${gitlabHost}/oauth/authorize?${params}`;
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>iGEM Wiki Editor</h1>
        <p style={styles.subtitle}>Denmark iGEM — content management</p>
        <button style={styles.button} onClick={handleLogin}>
          Sign in with GitLab
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#f5f5f5',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '48px 56px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 28,
    fontWeight: 700,
  },
  subtitle: {
    margin: '0 0 32px',
    color: '#666',
  },
  button: {
    background: '#fc6d26',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px 28px',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
