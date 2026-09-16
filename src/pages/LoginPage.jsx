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
        <div style={styles.mark}>W</div>
        <h1 style={styles.title}>iGEM Wiki Editor</h1>
        <p style={styles.subtitle}>Denmark iGEM — content management</p>
        <button className="gitlab-btn" style={styles.button} onClick={handleLogin}>
          <GitLabMark />
          Sign in with GitLab
        </button>
      </div>
    </div>
  );
}

function GitLabMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23.6 9.593l-.033-.086L20.3.98a.851.851 0 00-.336-.405.875.875 0 00-1 .053.875.875 0 00-.29.445l-2.2 6.735H7.526l-2.2-6.735a.87.87 0 00-.29-.446.876.876 0 00-1 0 .87.87 0 00-.33.445L.436 9.5l-.033.086a6.06 6.06 0 002.01 7.005l.012.008.03.022 4.964 3.715 2.454 1.858 1.494 1.129a1.032 1.032 0 001.25 0l1.494-1.129 2.454-1.858 4.995-3.738.012-.01a6.062 6.062 0 002.01-7.003z"
      />
    </svg>
  );
}

const styles = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background:
      'radial-gradient(ellipse 900px 500px at 20% -10%, #eef3fb 0%, transparent 60%), radial-gradient(ellipse 700px 500px at 100% 110%, #eef3fb 0%, transparent 55%), var(--bg)',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 18,
    padding: '46px 52px',
    boxShadow: 'var(--shadow-lifted)',
    border: '1px solid var(--ink-150)',
    textAlign: 'center',
    width: 340,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'linear-gradient(155deg, var(--accent), #4b7dc4)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 19,
    fontWeight: 800,
    margin: '0 auto 18px',
    boxShadow: '0 4px 12px rgba(44, 90, 160, 0.35)',
  },
  title: {
    margin: '0 0 6px',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--ink-900)',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: '0 0 30px',
    color: 'var(--ink-500)',
    fontSize: 13.5,
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    width: '100%',
    background: '#fc6d26',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14.5,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 3px 10px rgba(252, 109, 38, 0.3)',
  },
};
