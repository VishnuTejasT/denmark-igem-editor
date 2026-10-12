export function parseSectionsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sections = [];
  const seenIds = new Set();
  doc.querySelectorAll('.toc-section').forEach(sec => {
    const id = sec.id;
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);
    const h3 = sec.querySelector('h3');
    // Styled headings carry a number badge (<span class="chapter-number">02</span>);
    // read only the text span, or the heading becomes "02Model Description".
    const textSpan = h3?.querySelector('.chapter-number') ? h3.querySelector('span:not(.chapter-number)') : h3;
    const heading = textSpan?.textContent?.trim() || id;
    sections.push({ id, heading });
  });

  return sections;
}
