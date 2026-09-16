import { useState } from 'react';
import MDEditor, { commands as mdCommands, MarkdownUtil } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { emptyBlock, SIZE_MAP, defaultTableMarkdown, uniqueSectionId, sectionIsFilled } from '../lib/blocks';

const BLOCK_LABELS = {
  text: 'Text',
  image: 'Image',
  carousel: 'Carousel',
  table: 'Table',
  collapsible: 'Collapsible List',
  subsection: 'Subsection',
};

// ─── extra rich-text commands (superscript, subscript, underline, highlight) ─
// Symmetric wrap/unwrap, same mechanics as the built-in bold/strikethrough
// commands — reuses the library's own selectWord/executeCommand so toggling
// off an already-wrapped selection behaves identically to the stock buttons.

function textIcon(label, style) {
  return (
    <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'ui-serif, Georgia, serif', ...style }}>
      {label}
    </span>
  );
}

function wrapCommand({ name, shortcuts, label, icon, prefix, suffix = prefix }) {
  return {
    name,
    keyCommand: name,
    shortcuts,
    buttonProps: { 'aria-label': label, title: label },
    icon,
    execute: (state, api) => {
      const range = MarkdownUtil.selectWord({ text: state.text, selection: state.selection, prefix, suffix });
      const state1 = api.setSelectionRange(range);
      MarkdownUtil.executeCommand({ api, selectedText: state1.selectedText, selection: state.selection, prefix, suffix });
    },
  };
}

const superscriptCommand = wrapCommand({
  name: 'superscript',
  label: 'Superscript (^text^)',
  icon: textIcon('x²'),
  prefix: '^',
});
const subscriptCommand = wrapCommand({
  name: 'subscript',
  label: 'Subscript (~text~)',
  icon: textIcon('x₂'),
  prefix: '~',
});
const underlineCommand = wrapCommand({
  name: 'underline',
  shortcuts: 'ctrlcmd+u',
  label: 'Underline (++text++, ctrl + u)',
  icon: textIcon('U', { textDecoration: 'underline' }),
  prefix: '++',
});
const highlightCommand = wrapCommand({
  name: 'highlight',
  label: 'Highlight (==text==)',
  icon: textIcon('A', { background: '#fde68a', padding: '0 2px', borderRadius: 2 }),
  prefix: '==',
});

// Insert the four new buttons right after strikethrough, so they sit with
// the other inline-formatting marks rather than off in their own group.
const TEXT_EDITOR_COMMANDS = (() => {
  const base = mdCommands.getCommands();
  const i = base.findIndex(c => c.name === 'strikethrough');
  const extra = [superscriptCommand, subscriptCommand, underlineCommand, highlightCommand];
  return i === -1 ? [...base, ...extra] : [...base.slice(0, i + 1), ...extra, ...base.slice(i + 1)];
})();

// ─── per-block editors ───────────────────────────────────────────────────────

function TextBlockEditor({ block, onChange }) {
  return (
    <div className="wiki-md-editor" data-color-mode="light">
      <MDEditor
        value={block.markdown ?? ''}
        onChange={val => onChange({ ...block, markdown: val ?? '' })}
        preview="edit"
        height={160}
        visibleDragbar={false}
        commands={TEXT_EDITOR_COMMANDS}
      />
    </div>
  );
}

function ImageBlockEditor({ block, onChange }) {
  return (
    <div>
      <div className="form-row">
        <input
          className="field-input"
          style={{ flex: 3 }}
          placeholder="iGEM upload URL  (https://static.igem.wiki/teams/…)"
          value={block.url ?? ''}
          onChange={e => onChange({ ...block, url: e.target.value })}
        />
        <select
          className="field-select"
          value={block.size}
          onChange={e => onChange({ ...block, size: e.target.value })}
        >
          {Object.keys(SIZE_MAP).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <input
        className="field-input"
        placeholder="Caption (optional)"
        value={block.caption ?? ''}
        onChange={e => onChange({ ...block, caption: e.target.value })}
      />
      {(block.url || '').trim() && (
        <img className="image-preview" src={block.url} alt="" />
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
        <div key={i} className="form-row">
          <span className="slide-num">{i + 1}</span>
          <input
            className="field-input"
            style={{ flex: 2 }}
            placeholder="iGEM upload URL"
            value={slide.url}
            onChange={e => update(i, 'url', e.target.value)}
          />
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder="Caption for this image"
            value={slide.caption}
            onChange={e => update(i, 'caption', e.target.value)}
          />
          {slides.length > 1 && (
            <button className="btn btn-icon btn-danger" onClick={() => removeSlide(i)}>✕</button>
          )}
        </div>
      ))}
      <button className="btn btn-sm" onClick={addSlide}>+ Add image</button>
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
      <div className="form-row">
        <label style={{ fontSize: 12, color: 'var(--ink-500)' }}>Rows</label>
        <input
          className="field-input"
          style={{ width: 60 }}
          type="number" min={1} max={20}
          value={rows}
          onChange={e => setRows(e.target.value)}
        />
        <label style={{ fontSize: 12, color: 'var(--ink-500)' }}>Columns</label>
        <input
          className="field-input"
          style={{ width: 60 }}
          type="number" min={1} max={10}
          value={cols}
          onChange={e => setCols(e.target.value)}
        />
        <button className="btn btn-sm" onClick={regenerate}>Regenerate grid</button>
      </div>
      <textarea
        className="field-textarea"
        style={{ fontFamily: 'var(--font-mono)' }}
        rows={5}
        value={block.markdown ?? ''}
        onChange={e => onChange({ ...block, markdown: e.target.value })}
      />
      <div className="table-hint">
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
        className="field-input"
        style={{ marginBottom: 8 }}
        placeholder="Left column header (e.g. Feature) — optional"
        value={block.heading ?? ''}
        onChange={e => onChange({ ...block, heading: e.target.value })}
      />
      {rows.map((row, i) => (
        <div key={i} className="cl-row-group">
          <div className="form-row">
            <span className="slide-num">{i + 1}</span>
            <input
              className="field-input"
              style={{ flex: 2 }}
              placeholder="Feature (e.g. Primer length)"
              value={row.feature}
              onChange={e => update(i, 'feature', e.target.value)}
            />
            <input
              className="field-input"
              style={{ flex: 1 }}
              placeholder="Rule / Range (e.g. 28–36 nt)"
              value={row.rule}
              onChange={e => update(i, 'rule', e.target.value)}
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={row.required}
                onChange={e => update(i, 'required', e.target.checked)}
              />
              Required
            </label>
            {rows.length > 1 && (
              <button className="btn btn-icon btn-danger" onClick={() => removeRow(i)}>✕</button>
            )}
          </div>
          <textarea
            className="field-textarea"
            style={{ marginTop: 6 }}
            placeholder="Expanded explanation shown when the row is opened"
            rows={2}
            value={row.detail}
            onChange={e => update(i, 'detail', e.target.value)}
          />
        </div>
      ))}
      <button className="btn btn-sm" onClick={addRow}>+ Add row</button>
    </div>
  );
}

function SubsectionBlockEditor({ block, onChange, depth }) {
  return (
    <div>
      <input
        className="subsection-heading-input"
        placeholder="Subsection heading (e.g. Materials)"
        value={block.heading ?? ''}
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
    <div className="block-card">
      <div className="block-header">
        <span className="block-type-label">{BLOCK_LABELS[block.type] || block.type}</span>
        <div style={{ flex: 1 }} />
        {/* Subsections are always their own card, so the toggle only applies to
            ordinary blocks — and only at the top level, since cards don't nest. */}
        {block.type !== 'subsection' && depth === 0 && (
          <button
            className={`card-toggle${block.standalone ? ' on' : ''}`}
            onClick={() => onChange({ ...block, standalone: !block.standalone })}
            title={block.standalone
              ? 'This block is in its own card — click to merge it into the card above'
              : 'This block shares a card with its neighbours — click to give it its own card'}
          >
            {block.standalone ? '▣ Own card' : '▢ Own card'}
          </button>
        )}
        <button className="btn btn-icon" disabled={!canMoveUp} onClick={onMoveUp} title="Move up">↑</button>
        <button className="btn btn-icon" disabled={!canMoveDown} onClick={onMoveDown} title="Move down">↓</button>
        <button className="btn btn-sm btn-danger" onClick={onRemove}>✕ Remove</button>
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

function BlockList({ blocks: rawBlocks, onChange, depth }) {
  // Drop anything that isn't a usable block object. A single null/garbage entry
  // (from an older schema or a half-written draft) would otherwise throw during
  // render and take the whole editor down to a blank page.
  const blocks = (Array.isArray(rawBlocks) ? rawBlocks : []).filter(b => b && typeof b === 'object');

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
    <div className={depth > 0 ? 'nested-block-list' : undefined}>
      {blocks.map((block, i) => (
        <BlockItem
          key={block.id || `block-${i}`}
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
        <div className="empty-block-msg">
          {depth > 0 ? 'No content in this subsection yet.' : 'No content yet.'} Add a block below.
        </div>
      )}

      <div className="add-bar">
        <button className="pill-btn" onClick={() => addBlock('text')}>+ Text</button>
        <button className="pill-btn" onClick={() => addBlock('image')}>+ Image</button>
        <button className="pill-btn" onClick={() => addBlock('carousel')}>+ Carousel</button>
        <button className="pill-btn" onClick={() => addBlock('table')}>+ Table</button>
        <button className="pill-btn" onClick={() => addBlock('collapsible')}>+ Collapsible List</button>
        {depth === 0 && (
          <button className="pill-btn" onClick={() => addBlock('subsection')}>+ Subsection</button>
        )}
        <button
          className="pill-btn"
          onClick={() => addTextSnippet('**[N]** Author(s). Title. *Journal* Year;Vol:Pages.')}
        >
          + Reference
        </button>
        <button
          className="pill-btn"
          onClick={() => addTextSnippet('[link text](https://)')}
        >
          + Link
        </button>
      </div>
    </div>
  );
}

// ─── main editor component ───────────────────────────────────────────────────

export default function Editor({ content: rawContent, onChange }) {
  // Same defensive filtering as BlockList: one malformed section must not be
  // able to blank the entire editor.
  const content = {
    ...rawContent,
    sections: (Array.isArray(rawContent?.sections) ? rawContent.sections : [])
      .filter(s => s && typeof s === 'object'),
  };
  const set = (key, value) => onChange({ ...content, [key]: value });

  const updateHeading = (id, heading) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, heading } : s);
    onChange({ ...content, sections });
  };

  // Keep the section id in sync with its heading, for every section — not
  // just brand-new ones. Resync on blur, not per keystroke, so the preview
  // iframe doesn't spawn a fresh DOM section on every letter typed.
  // `sourceId` (set when the section was first loaded) always keeps pointing
  // at the original HTML anchor so we can still find and rename that element
  // on commit, even after `id` has drifted away from it.
  // Ids must stay unique against every other section's *id* AND its
  // *sourceId* — otherwise a new/renamed section can be assigned an id that
  // another section already uses as its real HTML anchor, and the preview's
  // DOM lookup (which matches on sourceId first) hijacks that other
  // section's element instead of creating its own.
  const reservedIds = (excludeId) => content.sections
    .filter(o => o.id !== excludeId)
    .flatMap(o => [o.id, o.sourceId].filter(Boolean));

  const resyncSectionId = (id) => {
    const section = content.sections.find(s => s.id === id);
    if (!section) return;
    const nextId = uniqueSectionId(section.heading, reservedIds(id));
    if (nextId === id) return;
    // Lock in sourceId before id drifts away from it. Without this, a
    // section whose sourceId was never set (e.g. loaded from an older draft)
    // loses track of its real HTML anchor on every rename — each edit then
    // orphans the previous element and creates a brand new one instead of
    // renaming in place, leaving stale duplicate sections behind forever.
    const sections = content.sections.map(s => s.id === id ? { ...s, id: nextId, sourceId: s.sourceId || id } : s);
    onChange({ ...content, sections });
  };

  const updateBlocks = (id, blocks) => {
    const sections = content.sections.map(s => s.id === id ? { ...s, blocks } : s);
    onChange({ ...content, sections });
  };

  const addSection = () => {
    const existingIds = reservedIds(null);
    const id = uniqueSectionId('New Section', existingIds);
    onChange({
      ...content,
      sections: [...content.sections, { id, heading: 'New Section', blocks: [], isNew: true, sourceId: null }],
    });
  };

  const removeSection = (id) => {
    onChange({ ...content, sections: content.sections.filter(s => s.id !== id) });
  };

  const moveSection = (id, dir) => {
    const i = content.sections.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= content.sections.length) return;
    const sections = [...content.sections];
    [sections[i], sections[j]] = [sections[j], sections[i]];
    onChange({ ...content, sections });
  };

  return (
    <div className="editor-wrap">
      {/* Meta fields */}
      <div className="meta-section">
        <Field label="Page Title">
          <input
            className="field-input"
            value={content.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Page title (shown in the hero banner)"
          />
        </Field>
        <Field label="Introduction">
          <textarea
            className="field-textarea"
            value={content.intro}
            rows={3}
            onChange={e => set('intro', e.target.value)}
            placeholder="Brief intro paragraph shown under the title"
          />
        </Field>
      </div>

      {content.sections.length === 0 && (
        <div className="empty-msg">No sections found. Select a page to begin editing.</div>
      )}

      {content.sections.map((section, i) => (
        // Keyed by position, not id: a newly-added section's id is re-slugified
        // on every keystroke (see updateHeading), which would otherwise remount
        // the card — and its inputs — mid-edit.
        <div key={i} className="section-card">
          <div className="section-header">
            <input
              className="section-heading-input"
              value={section.heading ?? ''}
              onChange={e => updateHeading(section.id, e.target.value)}
              onBlur={() => resyncSectionId(section.id)}
              placeholder="Section name"
            />
            <span className="section-id-badge">
              #{uniqueSectionId(section.heading, reservedIds(section.id))}
            </span>
            <button
              className="btn btn-icon"
              disabled={i === 0}
              onClick={() => moveSection(section.id, -1)}
              title="Move section up"
            >↑</button>
            <button
              className="btn btn-icon"
              disabled={i === content.sections.length - 1}
              onClick={() => moveSection(section.id, 1)}
              title="Move section down"
            >↓</button>
            {/* Removable regardless of isNew: sections that came from the page
                template also need to be deletable, both to drop a section for
                real and to clear stale/phantom ones. Confirm first when the
                section actually has content, since this is destructive. */}
            <button
              className="btn btn-sm btn-danger"
              title="Remove this section"
              onClick={() => {
                const filled = (section.blocks || []).length > 0 && sectionIsFilled(section);
                if (filled && !window.confirm(`Delete the "${section.heading}" section and its content?`)) return;
                removeSection(section.id);
              }}
            >
              ✕ Remove section
            </button>
          </div>

          <BlockList
            blocks={section.blocks || []}
            onChange={blocks => updateBlocks(section.id, blocks)}
            depth={0}
          />
        </div>
      ))}

      <button className="add-section-btn" onClick={addSection}>+ Add Section</button>

      {content.sections.length > 0 && (
        <p className="hint-text">
          Each section is a stack of blocks — text, images, tables, collapsible lists, and
          subsections. Subsections are their own mini cards that can hold the same block types.
          The preview on the right shows how it will look on the wiki. New sections appear on the
          real wiki page once you commit.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="meta-field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
