import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

const SNIPPETS = [
  {
    label: 'Image',
    title: 'Insert an image',
    snippet: '\n<img src="PASTE_IGEM_UPLOAD_URL_HERE" alt="Description" style="max-width:100%;display:block;margin:1.5em auto" />\n<p style="text-align:center;font-style:italic;font-size:0.9em;color:#555">Figure N. Caption here.</p>\n',
  },
  {
    label: 'Reference',
    title: 'Insert a reference entry',
    snippet: '\n> Author(s). Title. *Journal* Year;Vol:Pages. doi:...\n',
  },
  {
    label: 'Bold',
    title: 'Wrap selection in bold',
    snippet: '**bold text**',
  },
  {
    label: 'Link',
    title: 'Insert a hyperlink',
    snippet: '[link text](https://)',
  },
];

export default function Editor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateBody = (id, body) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, body } : s);
    onChange({ ...content, sections });
  };

  const insertSnippet = (id, snippet) => {
    const current = content.sections.find(s => s.id === id)?.body || '';
    updateBody(id, current + snippet);
  };

  return (
    <div style={styles.wrap} data-color-mode="light">
      <div style={styles.metaSection}>
        <Field label="Page Title">
          <input
            style={styles.input}
            value={content.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Page title (shown in the hero banner)"
          />
        </Field>
        <Field label="Introduction">
          <textarea
            style={{ ...styles.input, ...styles.textarea }}
            value={content.intro}
            rows={3}
            onChange={e => set('intro', e.target.value)}
            placeholder="Brief intro paragraph shown under the title"
          />
        </Field>
      </div>

      {content.sections.length === 0 && (
        <div style={styles.emptyMsg}>
          No sections found. Select a page to begin editing.
        </div>
      )}

      {content.sections.map(section => (
        <div key={section.id} style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionHeading}>{section.heading}</span>
            <span style={styles.sectionId}>#{section.id}</span>
          </div>

          <div style={styles.snippetBar}>
            {SNIPPETS.map(s => (
              <button
                key={s.label}
                style={styles.snippetBtn}
                title={s.title}
                onClick={() => insertSnippet(section.id, s.snippet)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <MDEditor
            value={section.body}
            onChange={val => updateBody(section.id, val ?? '')}
            preview="edit"
            height={220}
            visibleDragbar={false}
            style={{ borderRadius: 6, fontSize: 13 }}
          />
        </div>
      ))}

      {content.sections.length > 0 && (
        <p style={styles.hint}>
          Sections come from the page HTML template. Write content in Markdown — the preview on the right shows how it will look on the wiki.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  wrap: { padding: '20px 20px 40px', minHeight: '100%' },
  metaSection: { marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #ebebeb' },
  fieldLabel: {
    display: 'block', fontWeight: 700, marginBottom: 5,
    fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  input: {
    width: '100%', padding: '7px 10px', border: '1px solid #ddd',
    borderRadius: 6, fontSize: 13, outline: 'none',
    boxSizing: 'border-box', color: '#222',
  },
  textarea: { resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 },
  sectionCard: { marginBottom: 28 },
  sectionHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  sectionHeading: { fontWeight: 700, fontSize: 15, color: '#111' },
  sectionId: { fontSize: 11, color: '#bbb', fontFamily: 'monospace' },
  snippetBar: { display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' },
  snippetBtn: {
    padding: '3px 11px', borderRadius: 20, border: '1px solid #e0e0e0',
    background: '#f8f8f8', cursor: 'pointer', fontSize: 12, color: '#555',
    transition: 'background 0.1s',
  },
  emptyMsg: { color: '#ccc', textAlign: 'center', padding: '48px 0', fontSize: 14 },
  hint: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 16 },
};
