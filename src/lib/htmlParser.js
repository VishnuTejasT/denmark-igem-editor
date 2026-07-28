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
    const heading = h3?.textContent?.trim() || id;
    sections.push({ id, heading });
  });

  return sections;
}
