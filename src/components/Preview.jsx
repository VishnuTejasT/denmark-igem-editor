export default function Preview({ content }) {
  return (
    <div style={styles.root}>
      <div style={styles.label}>Preview</div>
      <h1 style={styles.title}>
        {content.title || <em style={styles.empty}>No title</em>}
      </h1>
      {content.intro ? (
        <p style={styles.intro}>{content.intro}</p>
      ) : (
        <p style={{ ...styles.intro, ...styles.empty }}>No intro</p>
      )}
      {content.sections.map((section, i) => (
        <div key={i}>
          <h2 style={styles.heading}>
            {section.heading || <em style={styles.empty}>No heading</em>}
          </h2>
          {section.body ? (
            <p style={styles.body}>{section.body}</p>
          ) : (
            <p style={{ ...styles.body, ...styles.empty }}>No content</p>
          )}
        </div>
      ))}
    </div>
  );
}

const styles = {
  root: {
    maxWidth: 680,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#999',
    marginBottom: 20,
  },
  title: {
    margin: '0 0 16px',
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  intro: {
    margin: '0 0 24px',
    fontSize: 16,
    lineHeight: 1.7,
    color: '#333',
  },
  heading: {
    margin: '28px 0 10px',
    fontSize: 22,
    fontWeight: 600,
  },
  body: {
    margin: '0 0 8px',
    fontSize: 15,
    lineHeight: 1.75,
    color: '#444',
  },
  empty: {
    color: '#bbb',
    fontStyle: 'italic',
  },
};
