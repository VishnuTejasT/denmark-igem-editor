export default function Editor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateSection = (i, key, value) => {
    const sections = content.sections.map((s, idx) =>
      idx === i ? { ...s, [key]: value } : s
    );
    onChange({ ...content, sections });
  };

  const addSection = () =>
    onChange({ ...content, sections: [...content.sections, { heading: '', body: '' }] });

  const removeSection = (i) =>
    onChange({ ...content, sections: content.sections.filter((_, idx) => idx !== i) });

  return (
    <div style={{ maxWidth: 680 }}>
      <Field label="Title">
        <input
          style={styles.input}
          value={content.title}
          onChange={e => set('title', e.target.value)}
        />
      </Field>

      <Field label="Intro">
        <textarea
          style={{ ...styles.input, ...styles.textarea }}
          value={content.intro}
          rows={4}
          onChange={e => set('intro', e.target.value)}
        />
      </Field>

      <div style={styles.sectionHeader}>
        <span style={{ fontWeight: 600 }}>Sections</span>
        <button style={styles.addBtn} onClick={addSection}>+ Add section</button>
      </div>

      {content.sections.map((section, i) => (
        <div key={i} style={styles.sectionCard}>
          <div style={styles.sectionTop}>
            <span style={{ fontWeight: 600, color: '#555' }}>Section {i + 1}</span>
            <button style={styles.removeBtn} onClick={() => removeSection(i)}>Remove</button>
          </div>
          <Field label="Heading">
            <input
              style={styles.input}
              value={section.heading}
              onChange={e => updateSection(i, 'heading', e.target.value)}
            />
          </Field>
          <Field label="Body">
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={section.body}
              rows={6}
              onChange={e => updateSection(i, 'body', e.target.value)}
            />
          </Field>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13, color: '#333' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const styles = {
  input: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid #ccc',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
  },
  textarea: {
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  addBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid #1a73e8',
    color: '#1a73e8',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  },
  sectionCard: {
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  sectionTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  removeBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #e00',
    color: '#c00',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
  },
};
