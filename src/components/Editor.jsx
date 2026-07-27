import { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';

// ─── Image insert form ───────────────────────────────────────────────────────

const SIZE_MAP = { sm: '30%', md: '50%', lg: '75%', xl: '90%', '2xl': '100%' };

function ImageInsertForm({ onInsert, onClose }) {
  const [url, setUrl]         = useState('');
  const [caption, setCaption] = useState('');
  const [size, setSize]       = useState('lg');

  const handleInsert = () => {
    const maxWidth = SIZE_MAP[size];
    let snippet = `\n<img src="${url}" alt="${caption || 'Figure'}" style="max-width:${maxWidth};display:block;margin:1.5em auto" />`;
    if (caption) {
      snippet += `\n<p style="text-align:center;font-style:italic;font-size:0.9em;color:#666;margin-top:0.4em">${caption}</p>`;
    }
    snippet += '\n';
    onInsert(snippet);
    onClose();
  };

  return (
    <div style={formStyles.panel}>
      <div style={formStyles.panelTitle}>Insert Image</div>
      <div style={formStyles.row}>
        <input
          style={{ ...formStyles.input, flex: 3 }}
          placeholder="iGEM upload URL  (https://static.igem.wiki/teams/…)"
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
        <select style={formStyles.select} value={size} onChange={e => setSize(e.target.value)}>
          {Object.keys(SIZE_MAP).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={formStyles.row}>
        <input
          style={{ ...formStyles.input, flex: 1 }}
          placeholder="Caption (optional)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
        />
        <button style={formStyles.insertBtn} onClick={handleInsert} disabled={!url.trim()}>
          Insert
        </button>
        <button style={formStyles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Carousel insert form ────────────────────────────────────────────────────

function CarouselInsertForm({ onInsert, onClose }) {
  const [slides, setSlides] = useState([
    { url: '', caption: '' },
    { url: '', caption: '' },
  ]);

  const update = (i, key, val) =>
    setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  const addSlide = () => setSlides(prev => [...prev, { url: '', caption: '' }]);
  const removeSlide = (i) => setSlides(prev => prev.filter((_, idx) => idx !== i));

  const handleInsert = () => {
    const filled = slides.filter(s => s.url.trim());
    if (!filled.length) return;

    const items = filled.map(s => {
      const cap = s.caption
        ? `\n    <p class="carousel-caption" style="text-align:center;font-style:italic;font-size:0.9em;color:#666;margin-top:0.4em">${s.caption}</p>`
        : '';
      return `  <div class="carousel-slide">\n    <img src="${s.url}" alt="${s.caption || ''}" style="max-width:100%;display:block;margin:0 auto" />${cap}\n  </div>`;
    }).join('\n');

    onInsert(`\n<div class="image-carousel">\n${items}\n</div>\n`);
    onClose();
  };

  return (
    <div style={formStyles.panel}>
      <div style={formStyles.panelTitle}>Insert Image Carousel</div>
      {slides.map((slide, i) => (
        <div key={i} style={formStyles.carouselRow}>
          <span style={formStyles.slideNum}>{i + 1}</span>
          <input
            style={{ ...formStyles.input, flex: 2 }}
            placeholder="iGEM upload URL"
            value={slide.url}
            onChange={e => update(i, 'url', e.target.value)}
          />
          <input
            style={{ ...formStyles.input, flex: 1 }}
            placeholder="Caption for this image"
            value={slide.caption}
            onChange={e => update(i, 'caption', e.target.value)}
          />
          {slides.length > 1 && (
            <button style={formStyles.removeSlideBtn} onClick={() => removeSlide(i)}>✕</button>
          )}
        </div>
      ))}
      <div style={{ ...formStyles.row, marginTop: 6 }}>
        <button style={formStyles.addSlideBtn} onClick={addSlide}>+ Add image</button>
        <div style={{ flex: 1 }} />
        <button
          style={formStyles.insertBtn}
          onClick={handleInsert}
          disabled={!slides.some(s => s.url.trim())}
        >
          Insert Carousel
        </button>
        <button style={formStyles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Table insert form ───────────────────────────────────────────────────────

function TableInsertForm({ onInsert, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const handleInsert = () => {
    const r = Math.max(1, Math.min(20, Number(rows) || 1));
    const c = Math.max(1, Math.min(10, Number(cols) || 1));

    const header = Array.from({ length: c }, (_, i) => `Header ${i + 1}`);
    const divider = Array.from({ length: c }, () => '---');
    const body = Array.from({ length: r }, () => Array.from({ length: c }, () => 'Cell'));

    const toRow = cells => `| ${cells.join(' | ')} |`;
    const table = [toRow(header), toRow(divider), ...body.map(toRow)].join('\n');

    onInsert(`\n${table}\n`);
    onClose();
  };

  return (
    <div style={formStyles.panel}>
      <div style={formStyles.panelTitle}>Insert Table</div>
      <div style={formStyles.row}>
        <label style={formStyles.tableLabel}>Rows</label>
        <input
          style={{ ...formStyles.input, width: 60 }}
          type="number"
          min={1}
          max={20}
          value={rows}
          onChange={e => setRows(e.target.value)}
        />
        <label style={formStyles.tableLabel}>Columns</label>
        <input
          style={{ ...formStyles.input, width: 60 }}
          type="number"
          min={1}
          max={10}
          value={cols}
          onChange={e => setCols(e.target.value)}
        />
        <div style={{ flex: 1 }} />
        <button style={formStyles.insertBtn} onClick={handleInsert}>Insert</button>
        <button style={formStyles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
      <div style={formStyles.tableHint}>
        Edit cell text directly in the Markdown below. Inside any cell you can use
        <code> **bold** </code>, <code> *italic* </code>, <code> ~~strikethrough~~ </code>,
        and <code>&lt;u&gt;underline&lt;/u&gt;</code>.
      </div>
    </div>
  );
}

// ─── Collapsible list insert form ────────────────────────────────────────────

function CollapsibleListInsertForm({ onInsert, onClose }) {
  const [heading, setHeading] = useState('');
  const [rows, setRows] = useState([
    { feature: '', rule: '', required: false, detail: '' },
    { feature: '', rule: '', required: false, detail: '' },
  ]);

  const update = (i, key, val) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const addRow = () => setRows(prev => [...prev, { feature: '', rule: '', required: false, detail: '' }]);
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const handleInsert = () => {
    const filled = rows.filter(r => r.feature.trim());
    if (!filled.length) return;

    const rowsHtml = filled.map(r => {
      const required = r.required
        ? `\n      <span class="cl-required">Required</span>`
        : '';
      return `  <details class="cl-row">
    <summary>
      <span class="cl-chevron" aria-hidden="true"></span>
      <span class="cl-feature">${esc(r.feature)}</span>${required}
      <span class="cl-rule">${esc(r.rule)}</span>
    </summary>
    <div class="cl-detail">${esc(r.detail)}</div>
  </details>`;
    }).join('\n');

    const headHtml = heading.trim()
      ? `\n  <div class="cl-table-head">\n    <span>${esc(heading)}</span>\n    <span>Rule / Range</span>\n  </div>`
      : '';

    onInsert(`\n<div class="cl-table">${headHtml}\n${rowsHtml}\n</div>\n`);
    onClose();
  };

  return (
    <div style={formStyles.panel}>
      <div style={formStyles.panelTitle}>Insert Collapsible List</div>
      <div style={formStyles.row}>
        <input
          style={{ ...formStyles.input, flex: 1 }}
          placeholder="Left column header (e.g. Feature) — optional"
          value={heading}
          onChange={e => setHeading(e.target.value)}
        />
      </div>
      {rows.map((row, i) => (
        <div key={i} style={formStyles.clRowGroup}>
          <div style={formStyles.carouselRow}>
            <span style={formStyles.slideNum}>{i + 1}</span>
            <input
              style={{ ...formStyles.input, flex: 2 }}
              placeholder="Feature (e.g. Primer length)"
              value={row.feature}
              onChange={e => update(i, 'feature', e.target.value)}
            />
            <input
              style={{ ...formStyles.input, flex: 1 }}
              placeholder="Rule / Range (e.g. 28–36 nt)"
              value={row.rule}
              onChange={e => update(i, 'rule', e.target.value)}
            />
            <label style={formStyles.checkboxLabel}>
              <input
                type="checkbox"
                checked={row.required}
                onChange={e => update(i, 'required', e.target.checked)}
              />
              Required
            </label>
            {rows.length > 1 && (
              <button style={formStyles.removeSlideBtn} onClick={() => removeRow(i)}>✕</button>
            )}
          </div>
          <textarea
            style={{ ...formStyles.input, ...formStyles.clDetailInput }}
            placeholder="Expanded explanation shown when the row is opened"
            rows={2}
            value={row.detail}
            onChange={e => update(i, 'detail', e.target.value)}
          />
        </div>
      ))}
      <div style={{ ...formStyles.row, marginTop: 6 }}>
        <button style={formStyles.addSlideBtn} onClick={addRow}>+ Add row</button>
        <div style={{ flex: 1 }} />
        <button
          style={formStyles.insertBtn}
          onClick={handleInsert}
          disabled={!rows.some(r => r.feature.trim())}
        >
          Insert List
        </button>
        <button style={formStyles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
      <div style={formStyles.tableHint}>
        Renders as a native, no-JS expand/collapse list (using <code>&lt;details&gt;</code>).
        Styling comes from the wiki's own stylesheet — see the <code>.cl-*</code> classes.
      </div>
    </div>
  );
}

// ─── Subsection insert form ──────────────────────────────────────────────────

function SubsectionInsertForm({ onInsert, onClose }) {
  const [heading, setHeading] = useState('');

  const handleInsert = () => {
    if (!heading.trim()) return;
    onInsert(`\n#### ${heading.trim()}\n\n`);
    onClose();
  };

  return (
    <div style={formStyles.panel}>
      <div style={formStyles.panelTitle}>Insert Subsection</div>
      <div style={formStyles.row}>
        <input
          style={{ ...formStyles.input, flex: 1 }}
          placeholder="Subsection heading (e.g. Materials)"
          value={heading}
          onChange={e => setHeading(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInsert()}
        />
        <button style={formStyles.insertBtn} onClick={handleInsert} disabled={!heading.trim()}>
          Insert
        </button>
        <button style={formStyles.cancelBtn} onClick={onClose}>Cancel</button>
      </div>
      <div style={formStyles.tableHint}>
        Adds a smaller header inside this section, letting you break it into mini sections.
      </div>
    </div>
  );
}

// ─── Main editor component ───────────────────────────────────────────────────

export default function Editor({ content, onChange }) {
  const [activePanels, setActivePanels] = useState({});

  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateBody = (id, body) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, body } : s);
    onChange({ ...content, sections });
  };

  const updateHeading = (id, heading) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, heading } : s);
    onChange({ ...content, sections });
  };

  const appendToBody = (id, snippet) => {
    const current = content.sections.find(s => s.id === id)?.body || '';
    updateBody(id, current + snippet);
  };

  const togglePanel = (sectionId, type) => {
    setActivePanels(prev => ({
      ...prev,
      [sectionId]: prev[sectionId] === type ? null : type,
    }));
  };

  const closePanel = (sectionId) => {
    setActivePanels(prev => ({ ...prev, [sectionId]: null }));
  };

  return (
    <div style={styles.wrap} data-color-mode="light">
      {/* Meta fields */}
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
        <div style={styles.emptyMsg}>No sections found. Select a page to begin editing.</div>
      )}

      {content.sections.map(section => (
        <div key={section.id} style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <input
              style={styles.sectionHeadingInput}
              value={section.heading}
              onChange={e => updateHeading(section.id, e.target.value)}
              placeholder="Section name"
            />
            <span style={styles.sectionId}>#{section.id}</span>
          </div>

          {/* Insert toolbar */}
          <div style={styles.snippetBar}>
            <button
              style={{ ...styles.snippetBtn, ...(activePanels[section.id] === 'image' ? styles.snippetBtnActive : {}) }}
              onClick={() => togglePanel(section.id, 'image')}
            >
              Image
            </button>
            <button
              style={{ ...styles.snippetBtn, ...(activePanels[section.id] === 'carousel' ? styles.snippetBtnActive : {}) }}
              onClick={() => togglePanel(section.id, 'carousel')}
            >
              Carousel
            </button>
            <button
              style={{ ...styles.snippetBtn, ...(activePanels[section.id] === 'table' ? styles.snippetBtnActive : {}) }}
              onClick={() => togglePanel(section.id, 'table')}
            >
              Table
            </button>
            <button
              style={{ ...styles.snippetBtn, ...(activePanels[section.id] === 'collapsible' ? styles.snippetBtnActive : {}) }}
              onClick={() => togglePanel(section.id, 'collapsible')}
            >
              Collapsible List
            </button>
            <button
              style={{ ...styles.snippetBtn, ...(activePanels[section.id] === 'subsection' ? styles.snippetBtnActive : {}) }}
              onClick={() => togglePanel(section.id, 'subsection')}
            >
              Subsection
            </button>
            <button
              style={styles.snippetBtn}
              onClick={() => appendToBody(section.id, '\n> **[N]** Author(s). Title. *Journal* Year;Vol:Pages.\n')}
            >
              Reference
            </button>
            <button
              style={styles.snippetBtn}
              onClick={() => appendToBody(section.id, '[link text](https://)')}
            >
              Link
            </button>
          </div>

          {/* Inline insert panels */}
          {activePanels[section.id] === 'image' && (
            <ImageInsertForm
              onInsert={snippet => appendToBody(section.id, snippet)}
              onClose={() => closePanel(section.id)}
            />
          )}
          {activePanels[section.id] === 'carousel' && (
            <CarouselInsertForm
              onInsert={snippet => appendToBody(section.id, snippet)}
              onClose={() => closePanel(section.id)}
            />
          )}
          {activePanels[section.id] === 'table' && (
            <TableInsertForm
              onInsert={snippet => appendToBody(section.id, snippet)}
              onClose={() => closePanel(section.id)}
            />
          )}
          {activePanels[section.id] === 'collapsible' && (
            <CollapsibleListInsertForm
              onInsert={snippet => appendToBody(section.id, snippet)}
              onClose={() => closePanel(section.id)}
            />
          )}
          {activePanels[section.id] === 'subsection' && (
            <SubsectionInsertForm
              onInsert={snippet => appendToBody(section.id, snippet)}
              onClose={() => closePanel(section.id)}
            />
          )}

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
          Sections come from the page HTML template. Write in Markdown — the preview shows how it will look on the wiki.
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

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = {
  wrap: { padding: '20px 20px 40px', minHeight: '100%' },
  metaSection: { marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #ebebeb' },
  fieldLabel: {
    display: 'block', fontWeight: 700, marginBottom: 5,
    fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  input: {
    width: '100%', padding: '7px 10px', border: '1px solid #ddd',
    borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#222',
  },
  textarea: { resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 },
  sectionCard: { marginBottom: 28 },
  sectionHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  sectionHeadingInput: {
    fontWeight: 700, fontSize: 15, color: '#111', border: '1px solid #eee',
    borderRadius: 4, padding: '2px 6px', outline: 'none', flex: 1, minWidth: 0,
    fontFamily: 'inherit', background: 'transparent',
  },
  sectionId: { fontSize: 11, color: '#bbb', fontFamily: 'monospace' },
  snippetBar: { display: 'flex', gap: 6, marginBottom: 7, flexWrap: 'wrap' },
  snippetBtn: {
    padding: '3px 11px', borderRadius: 20, border: '1px solid #e0e0e0',
    background: '#f8f8f8', cursor: 'pointer', fontSize: 12, color: '#555',
  },
  snippetBtnActive: {
    background: '#e8f0fe', borderColor: '#1a73e8', color: '#1a73e8', fontWeight: 600,
  },
  emptyMsg: { color: '#ccc', textAlign: 'center', padding: '48px 0', fontSize: 14 },
  hint: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 16 },
};

const formStyles = {
  panel: {
    background: '#f8faff', border: '1px solid #d0e0ff', borderRadius: 8,
    padding: '12px 14px', marginBottom: 10,
  },
  panelTitle: { fontWeight: 700, fontSize: 12, color: '#1a73e8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  row: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  carouselRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 },
  input: {
    padding: '6px 10px', border: '1px solid #ccd', borderRadius: 6,
    fontSize: 13, outline: 'none', color: '#222', boxSizing: 'border-box',
  },
  select: {
    padding: '6px 8px', border: '1px solid #ccd', borderRadius: 6,
    fontSize: 13, outline: 'none', background: '#fff',
  },
  insertBtn: {
    padding: '6px 16px', borderRadius: 6, border: 'none',
    background: '#1a73e8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    opacity: 1,
  },
  cancelBtn: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd',
    background: '#fff', color: '#888', cursor: 'pointer', fontSize: 13,
  },
  addSlideBtn: {
    padding: '5px 12px', borderRadius: 6, border: '1px solid #1a73e8',
    background: '#fff', color: '#1a73e8', cursor: 'pointer', fontSize: 12,
  },
  slideNum: {
    fontSize: 11, color: '#aaa', width: 16, textAlign: 'right', flexShrink: 0,
  },
  removeSlideBtn: {
    padding: '4px 8px', borderRadius: 5, border: '1px solid #fcc',
    background: '#fff', color: '#c44', cursor: 'pointer', fontSize: 12, flexShrink: 0,
  },
  tableLabel: { fontSize: 12, color: '#666' },
  tableHint: { fontSize: 11, color: '#888', lineHeight: 1.6 },
  clRowGroup: { marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #dde6f7' },
  clDetailInput: { width: '100%', marginTop: 6, resize: 'vertical', fontFamily: 'inherit' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', flexShrink: 0, whiteSpace: 'nowrap' },
};
