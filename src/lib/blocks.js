import { marked } from 'marked';

marked.use({ gfm: true, breaks: true });

export const SIZE_MAP = { sm: '30%', md: '50%', lg: '75%', xl: '90%', '2xl': '100%' };

let counter = 0;
export function newId() {
  counter += 1;
  return `b${Date.now().toString(36)}${counter}`;
}

export function slugify(text) {
  const slug = (text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

// Slugify `heading`, appending -2, -3, … until it doesn't collide with `existingIds`.
export function uniqueSectionId(heading, existingIds) {
  const base = slugify(heading);
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function defaultTableMarkdown(rows, cols) {
  const r = Math.max(1, Math.min(20, Number(rows) || 1));
  const c = Math.max(1, Math.min(10, Number(cols) || 1));
  const header = Array.from({ length: c }, (_, i) => `Header ${i + 1}`);
  const divider = Array.from({ length: c }, () => '---');
  const body = Array.from({ length: r }, () => Array.from({ length: c }, () => 'Cell'));
  const toRow = cells => `| ${cells.join(' | ')} |`;
  return [toRow(header), toRow(divider), ...body.map(toRow)].join('\n');
}

export function emptyBlock(type) {
  switch (type) {
    case 'text':
      return { id: newId(), type: 'text', markdown: '' };
    case 'image':
      return { id: newId(), type: 'image', url: '', caption: '', size: 'lg' };
    case 'carousel':
      return { id: newId(), type: 'carousel', slides: [{ url: '', caption: '' }, { url: '', caption: '' }] };
    case 'table':
      return { id: newId(), type: 'table', markdown: defaultTableMarkdown(3, 3) };
    case 'collapsible':
      return { id: newId(), type: 'collapsible', heading: '', rows: [{ feature: '', rule: '', required: false, detail: '' }] };
    case 'subsection':
      return { id: newId(), type: 'subsection', heading: 'New subsection', blocks: [] };
    default:
      return { id: newId(), type: 'text', markdown: '' };
  }
}

function imageBlockHtml(b) {
  if (!b.url || !b.url.trim()) return '';
  const maxWidth = SIZE_MAP[b.size] || SIZE_MAP.lg;
  let html = `<img src="${b.url}" alt="${esc(b.caption) || 'Figure'}" style="max-width:${maxWidth};display:block;margin:1.5em auto" />`;
  if (b.caption) {
    html += `\n<p style="text-align:center;font-style:italic;font-size:0.9em;color:#666;margin-top:0.4em">${esc(b.caption)}</p>`;
  }
  return html;
}

function carouselBlockHtml(b) {
  const filled = (b.slides || []).filter(s => s.url && s.url.trim());
  if (!filled.length) return '';
  const items = filled.map(s => {
    const cap = s.caption
      ? `\n    <p class="carousel-caption" style="text-align:center;font-style:italic;font-size:0.9em;color:#666;margin-top:0.4em">${esc(s.caption)}</p>`
      : '';
    return `  <div class="carousel-slide">\n    <img src="${s.url}" alt="${esc(s.caption) || ''}" style="max-width:100%;display:block;margin:0 auto" />${cap}\n  </div>`;
  }).join('\n');
  return `<div class="image-carousel">\n${items}\n</div>`;
}

function collapsibleBlockHtml(b) {
  const filled = (b.rows || []).filter(r => r.feature && r.feature.trim());
  if (!filled.length) return '';
  const rowsHtml = filled.map(r => {
    const required = r.required ? `\n      <span class="cl-required">Required</span>` : '';
    return `  <details class="cl-row">
    <summary>
      <span class="cl-chevron" aria-hidden="true"></span>
      <span class="cl-feature">${esc(r.feature)}</span>${required}
      <span class="cl-rule">${esc(r.rule)}</span>
    </summary>
    <div class="cl-detail">${esc(r.detail)}</div>
  </details>`;
  }).join('\n');
  const headHtml = b.heading && b.heading.trim()
    ? `\n  <div class="cl-table-head">\n    <span>${esc(b.heading)}</span>\n    <span>Rule / Range</span>\n  </div>`
    : '';
  return `<div class="cl-table">${headHtml}\n${rowsHtml}\n</div>`;
}

export function blockToHtml(block) {
  switch (block.type) {
    case 'text':
    case 'table':
      return block.markdown && block.markdown.trim() ? marked(block.markdown) : '';
    case 'image':
      return imageBlockHtml(block);
    case 'carousel':
      return carouselBlockHtml(block);
    case 'collapsible':
      return collapsibleBlockHtml(block);
    case 'subsection': {
      const heading = block.heading ? esc(block.heading) : '';
      const inner = (block.blocks || []).map(blockToHtml).filter(Boolean).join('\n');
      return `<div class="section-block" style="margin-top:26px">\n  <span class="section-block-label">${heading}</span>\n${inner}\n</div>`;
    }
    default:
      return '';
  }
}

export function sectionBodyHtml(blocks) {
  return (blocks || []).map(blockToHtml).filter(Boolean).join('\n');
}

// Per-block rendered HTML, used for containers (like the References <ol>)
// that need one list item per block instead of one merged blob.
export function sectionBodyBlocksHtml(blocks) {
  return (blocks || []).map(blockToHtml).filter(Boolean);
}

export function sectionBodyListItems(blocks) {
  return sectionBodyBlocksHtml(blocks).map(html => `<li class="section-block">${html}</li>`).join('\n');
}

function blockHasContent(b) {
  switch (b.type) {
    case 'text':
      return !!(b.markdown && b.markdown.trim() && b.markdown.trim() !== '--');
    case 'table':
      return !!(b.markdown && b.markdown.trim());
    case 'image':
      return !!(b.url && b.url.trim());
    case 'carousel':
      return (b.slides || []).some(s => s.url && s.url.trim());
    case 'collapsible':
      return (b.rows || []).some(r => r.feature && r.feature.trim());
    case 'subsection':
      return (b.blocks || []).some(blockHasContent);
    default:
      return false;
  }
}

export function sectionIsFilled(section) {
  return migrateSection(section).some(blockHasContent);
}

// Collapse duplicate empty subsections (same heading, no content) down to one.
// Repairs drafts corrupted by repeated "+ Subsection" clicks during the
// preview-freeze bug, without touching subsections that actually have content.
export function dedupeEmptySubsections(blocks) {
  const seenEmptyHeadings = new Set();
  const result = [];
  for (const b of blocks || []) {
    if (b.type !== 'subsection') {
      result.push(b);
      continue;
    }
    const cleaned = { ...b, blocks: dedupeEmptySubsections(b.blocks) };
    if (!blockHasContent(cleaned)) {
      const key = cleaned.heading || '';
      if (seenEmptyHeadings.has(key)) continue;
      seenEmptyHeadings.add(key);
    }
    result.push(cleaned);
  }
  return result;
}

// Collapse duplicate top-level sections sharing the same id down to one.
// Repairs pages committed while a prior bug let "+ Add Section" (or the HTML
// template itself) produce two sections with an identical id/heading/blocks.
// When one copy has real content and the other doesn't, the filled one wins.
export function dedupeSections(sections) {
  const seenAt = new Map();
  const result = [];
  for (const s of sections || []) {
    const existingIndex = seenAt.get(s.id);
    if (existingIndex === undefined) {
      seenAt.set(s.id, result.length);
      result.push(s);
      continue;
    }
    if (!sectionIsFilled(result[existingIndex]) && sectionIsFilled(s)) {
      result[existingIndex] = s;
    }
  }
  return result;
}

// Back-compat: convert a legacy `{ body: markdownString }` section (or the
// even older `{ blocks: [{ body }] }` shim) into the current blocks array.
// Sections saved after the block-editor rewrite already carry `blocks` and
// pass through untouched.
export function migrateSection(section) {
  if (Array.isArray(section.blocks) && section.blocks.every(b => typeof b.type === 'string')) {
    return section.blocks;
  }
  const body = section.body ?? (section.blocks?.[0]?.body ?? '');
  return body && body.trim() ? [{ id: newId(), type: 'text', markdown: body }] : [];
}
