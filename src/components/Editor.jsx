import { useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { emptyBlock, SIZE_MAP, defaultTableMarkdown } from '../lib/blocks';

const BLOCK_LABELS = {
  text: 'Text',
  image: 'Image',
  carousel: 'Carousel',
  table: 'Table',
  collapsible: 'Collapsible List',
  subsection: 'Subsection',
};

// ─── per-block editors ───────────────────────────────────────────────────────

function TextBlockEditor({ block, onChange }) {
  return (
    <MDEditor
      value={block.markdown}
      onChange={val => onChange({ ...block, markdown: val ?? '' })}
      preview="edit"
      height={160}
      visibleDragbar={false}
      style={{ borderRadius: 6, fontSize: 13 }}
    />
  );
}

function ImageBlockEditor({ block, onChange }) {
  return (
    <div>
      <div style={formStyles.row}>
        <input
          style={{ ...formStyles.input, flex: 3 }}
          placeholder="iGEM upload URL  (https://static.igem.wiki/teams/…)"
          value={block.url}
          onChange={e => onChange({ ...block, url: e.target.value })}
        />
        <select
          style={formStyles.select}
          value={block.size}
          onChange={e => onChange({ ...block, size: e.target.value })}
        >
          {Object.keys(SIZE_MAP).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <input
        style={{ ...formStyles.input, width: '100%' }}
        placeholder="Caption (optional)"
        value={block.caption}
        onChange={e => onChange({ ...block, caption: e.target.value })}
      />
      {block.url.trim() && (
        <img src={block.url} alt="" style={formStyles.imagePreview} />
      )}
    </div>
  );
}

function CarouselBlockEditor({ block, onChange }) {
  const slides = block.slides || [];
  const update = (i, key, val) =>
    onChange({ ...block, slides: slides.map((s, idx) => idx === i ? { ...s, [key]: val } : s) });
  const addSlide = () => onChange({ ...block, slides: [...slides, { url: '', caption: '' }] });
  const removeSlide = (i) => onChange({ ...block, slides: slides.filter((_, idx) => idx !== i) });

  return (
    <div>
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
      <button style={formStyles.addSlideBtn} onClick={addSlide}>+ Add image</button>
    </div>
  );
}

function TableBlockEditor({ block, onChange }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  const regenerate = () => {
    const r = Math.max(1, Math.min(20, Number(rows) || 1));
    const c = Math.max(1, Math.min(10, Number(cols) || 1));
    onChange({ ...block, markdown: defaultTableMarkdown(r, c) });
  };

  return (
    <div>
      <div style={formStyles.row}>
        <label style={formStyles.tableLabel}>Rows</label>
        <input
          style={{ ...formStyles.input, width: 60 }}
          type="number" min={1} max={20}
          value={rows}
          onChange={e => setRows(e.target.value)}
        />
        <label style={formStyles.tableLabel}>Columns</label>
        <input
          style={{ ...formStyles.input, width: 60 }}
          type="number" min={1} max={10}
          value={cols}
          onChange={e => setCols(e.target.value)}
        />
        <button style={formStyles.addSlideBtn} onClick={regenerate}>Regenerate grid</button>
      </div>
      <textarea
        style={{ ...formStyles.input, width: '100%', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
        rows={5}
        value={block.markdown}
        onChange={e => onChange({ ...block, markdown: e.target.value })}
      />
      <div style={formStyles.tableHint}>
        Edit cell text directly above using Markdown table syntax. "Regenerate grid" replaces
        the whole table with a fresh empty grid of the given size.
      </div>
    </div>
  );
}

function CollapsibleBlockEditor({ block, onChange }) {
  const rows = block.rows || [];
  const update = (i, key, val) =>
    onChange({ ...block, rows: rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r) });
  const addRow = () => onChange({ ...block, rows: [...rows, { feature: '', rule: '', required: false, detail: '' }] });
  const removeRow = (i) => onChange({ ...block, rows: rows.filter((_, idx) => idx !== i) });

  return (
    <div>
      <input
        style={{ ...formStyles.input, width: '100%', marginBottom: 8 }}
        placeholder="Left column header (e.g. Feature) — optional"
        value={block.heading}
        onChange={e => onChange({ ...block, heading: e.target.value })}
      />
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
      <button style={formStyles.addSlideBtn} onClick={addRow}>+ Add row</button>
    </div>
  );
}

function SubsectionBlockEditor({ block, onChange, depth }) {
  return (
    <div>
      <input
        style={styles.subsectionHeadingInput}
        placeholder="Subsection heading (e.g. Materials)"
        value={block.heading}
        onChange={e => onChange({ ...block, heading: e.target.value })}
      />
      <BlockList
        blocks={block.blocks || []}
        onChange={blocks => onChange({ ...block, blocks })}
        depth={depth + 1}
      />
    </div>
  );
}

// ─── generic block list (recursive — used at section level and inside subsections) ──

function BlockItem({ block, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, depth }) {
  return (
    <div style={styles.blockCard}>
      <div style={styles.blockHeader}>
        <span style={styles.blockType}>{BLOCK_LABELS[block.type] || block.type}</span>
        <div style={{ flex: 1 }} />
        <button style={styles.iconBtn} disabled={!canMoveUp} onClick={onMoveUp} title="Move up">↑</button>
        <button style={styles.iconBtn} disabled={!canMoveDown} onClick={onMoveDown} title="Move down">↓</button>
        <button style={styles.removeBtn} onClick={onRemove}>✕ Remove</button>
      </div>

      {block.type === 'text' && <TextBlockEditor block={block} onChange={onChange} />}
      {block.type === 'image' && <ImageBlockEditor block={block} onChange={onChange} />}
      {block.type === 'carousel' && <CarouselBlockEditor block={block} onChange={onChange} />}
      {block.type === 'table' && <TableBlockEditor block={block} onChange={onChange} />}
      {block.type === 'collapsible' && <CollapsibleBlockEditor block={block} onChange={onChange} />}
      {block.type === 'subsection' && <SubsectionBlockEditor block={block} onChange={onChange} depth={depth} />}
    </div>
  );
}

function BlockList({ blocks, onChange, depth }) {
  const update = (i, newBlock) => onChange(blocks.map((b, idx) => idx === i ? newBlock : b));
  const remove = (i) => onChange(blocks.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const copy = [...blocks];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const addBlock = (type) => onChange([...blocks, emptyBlock(type)]);
  const addTextSnippet = (markdown) => onChange([...blocks, { ...emptyBlock('text'), markdown }]);

  return (
    <div style={depth > 0 ? styles.nestedBlockList : undefined}>
      {blocks.map((block, i) => (
        <BlockItem
          key={block.id}
          block={block}
          onChange={nb => update(i, nb)}
          onRemove={() => remove(i)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          canMoveUp={i > 0}
          canMoveDown={i < blocks.length - 1}
          depth={depth}
        />
      ))}

      {blocks.length === 0 && (
        <div style={styles.emptyBlockMsg}>
          {depth > 0 ? 'No content in this subsection yet.' : 'No content yet.'} Add a block below.
        </div>
      )}

      <div style={styles.addBar}>
        <button style={styles.snippetBtn} onClick={() => addBlock('text')}>+ Text</button>
        <button style={styles.snippetBtn} onClick={() => addBlock('image')}>+ Image</button>
        <button style={styles.snippetBtn} onClick={() => addBlock('carousel')}>+ Carousel</button>
        <button style={styles.snippetBtn} onClick={() => addBlock('table')}>+ Table</button>
        <button style={styles.snippetBtn} onClick={() => addBlock('collapsible')}>+ Collapsible List</button>
        {depth === 0 && (
          <button style={styles.snippetBtn} onClick={() => addBlock('subsection')}>+ Subsection</button>
        )}
        <button
          style={styles.snippetBtn}
          onClick={() => addTextSnippet('> **[N]** Author(s). Title. *Journal* Year;Vol:Pages.')}
        >
          + Reference
        </button>
        <button
          style={styles.snippetBtn}
          onClick={() => addTextSnippet('[link text](https://)')}
        >
          + Link
        </button>
      </div>
    </div>
  );
}

// ─── main editor component ───────────────────────────────────────────────────

export default function Editor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateHeading = (id, heading) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, heading } : s);
    onChange({ ...content, sections });
  };

  const updateBlocks = (id, blocks) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, blocks } : s);
    onChange({ ...content, sections });
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

          <BlockList
            blocks={section.blocks || []}
            onChange={blocks => updateBlocks(section.id, blocks)}
            depth={0}
          />
        </div>
      ))}

      {content.sections.length > 0 && (
        <p style={styles.hint}>
          Each section is a stack of blocks — text, images, tables, collapsible lists, and
          subsections. Subsections are their own mini cards that can hold the same block types.
          The preview on the right shows how it will look on the wiki.
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
  sectionCard: {
    marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #f0f0f0',
  },
  sectionHeader: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionHeadingInput: {
    fontWeight: 700, fontSize: 15, color: '#111', border: '1px solid #eee',
    borderRadius: 4, padding: '2px 6px', outline: 'none', flex: 1, minWidth: 0,
    fontFamily: 'inherit', background: 'transparent',
  },
  sectionId: { fontSize: 11, color: '#bbb', fontFamily: 'monospace' },

  blockCard: {
    border: '1px solid #ebebeb', borderRadius: 8, padding: '10px 12px',
    marginBottom: 10, background: '#fff',
  },
  blockHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 },
  blockType: {
    fontSize: 10.5, fontWeight: 700, color: '#1a73e8',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  iconBtn: {
    border: '1px solid #ddd', background: '#fff', borderRadius: 5,
    padding: '2px 8px', cursor: 'pointer', fontSize: 12, color: '#666',
  },
  removeBtn: {
    border: '1px solid #fcc', background: '#fff', color: '#c44', borderRadius: 5,
    padding: '2px 9px', cursor: 'pointer', fontSize: 12,
  },
  nestedBlockList: {
    marginTop: 8, marginBottom: 4, paddingLeft: 14, borderLeft: '2px solid #e8f0fe',
  },
  addBar: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2, marginBottom: 4 },
  snippetBtn: {
    padding: '3px 11px', borderRadius: 20, border: '1px solid #e0e0e0',
    background: '#f8f8f8', cursor: 'pointer', fontSize: 12, color: '#555',
  },
  emptyBlockMsg: { color: '#bbb', fontSize: 12, padding: '10px 0' },
  subsectionHeadingInput: {
    fontWeight: 700, fontSize: 13, color: '#111', border: '1px solid #eee',
    borderRadius: 4, padding: '4px 8px', outline: 'none', width: '100%',
    marginBottom: 8, fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box',
  },

  emptyMsg: { color: '#ccc', textAlign: 'center', padding: '48px 0', fontSize: 14 },
  hint: { fontSize: 11, color: '#ccc', textAlign: 'center', marginTop: 16 },
};

const formStyles = {
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
  tableHint: { fontSize: 11, color: '#888', lineHeight: 1.6, marginTop: 6 },
  clRowGroup: { marginBottom: 10, paddingBottom: 10, borderBottom: '1px dashed #dde6f7' },
  clDetailInput: { width: '100%', marginTop: 6, resize: 'vertical', fontFamily: 'inherit' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#666', flexShrink: 0, whiteSpace: 'nowrap' },
  imagePreview: { maxWidth: '100%', marginTop: 8, borderRadius: 6, display: 'block' },
};
