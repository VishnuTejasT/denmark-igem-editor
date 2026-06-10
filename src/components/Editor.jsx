const EMPTY_BLOCK = { body: '', image: '', caption: '', list: [] };

export default function Editor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateBlock = (sectionIdx, blockIdx, key, value) => {
    const sections = content.sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      const blocks = s.blocks.map((b, bi) =>
        bi === blockIdx ? { ...b, [key]: value } : b
      );
      return { ...s, blocks };
    });
    onChange({ ...content, sections });
  };

  const addBlock = (sectionIdx) => {
    const sections = content.sections.map((s, si) =>
      si === sectionIdx ? { ...s, blocks: [...s.blocks, { ...EMPTY_BLOCK }] } : s
    );
    onChange({ ...content, sections });
  };

  const removeBlock = (sectionIdx, blockIdx) => {
    const sections = content.sections.map((s, si) =>
      si === sectionIdx ? { ...s, blocks: s.blocks.filter((_, bi) => bi !== blockIdx) } : s
    );
    onChange({ ...content, sections });
  };

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

      {content.sections.map((section, si) => (
        <div key={section.id} style={styles.sectionCard}>
          <div style={styles.sectionTop}>
            <span style={styles.sectionLabel}>{section.heading}</span>
          </div>

          {section.blocks.map((block, bi) => (
            <div key={bi} style={styles.blockCard}>
              <div style={styles.blockTop}>
                <span style={{ fontWeight: 600, color: '#555' }}>Block {bi + 1}</span>
                <button style={styles.removeBtn} onClick={() => removeBlock(si, bi)}>Remove</button>
              </div>

              <Field label="Body">
                <textarea
                  style={{ ...styles.input, ...styles.textarea }}
                  value={block.body}
                  rows={4}
                  onChange={e => updateBlock(si, bi, 'body', e.target.value)}
                />
              </Field>

              <Field label="Image URL">
                <input
                  style={styles.input}
                  value={block.image}
                  onChange={e => updateBlock(si, bi, 'image', e.target.value)}
                />
              </Field>

              <Field label="Caption">
                <input
                  style={styles.input}
                  value={block.caption}
                  onChange={e => updateBlock(si, bi, 'caption', e.target.value)}
                />
              </Field>

              <Field label="List (one item per line)">
                <textarea
                  style={{ ...styles.input, ...styles.textarea }}
                  value={block.list.join('\n')}
                  rows={3}
                  onChange={e => updateBlock(si, bi, 'list', e.target.value.split('\n'))}
                />
              </Field>
            </div>
          ))}

          <button style={styles.addBtn} onClick={() => addBlock(si)}>+ Add block</button>
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
    marginBottom: 12,
  },
  sectionLabel: {
    fontWeight: 600,
    fontSize: 15,
    color: '#222',
  },
  blockCard: {
    border: '1px solid #eee',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
    background: '#fafafa',
  },
  blockTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
