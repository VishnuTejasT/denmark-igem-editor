export function parseSectionsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sections = [];
  doc.querySelectorAll('.toc-section').forEach(sec => {
    const id = sec.id;
    if (!id) return;
    const h3 = sec.querySelector('h3');
    const heading = h3?.textContent?.trim() || id;
    sections.push({ id, heading });
  });

  return sections;
}
