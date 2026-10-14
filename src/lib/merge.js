// 3-way merge of wiki content by section/block id: base = what we loaded,
// theirs = latest committed, mine = local edits. Whichever side changed a
// piece wins; if both changed the same block, mine wins and it is counted in
// `conflicts` (theirs stays recoverable in git history).
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pick(base, theirs, mine, state) {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(theirs, mine)) return mine;
  state.conflicts++;
  return mine;
}

function mergeList(base = [], theirs = [], mine = [], mergeItem, state) {
  const byId = (l) => new Map(l.map(x => [x.id, x]));
  const b = byId(base), t = byId(theirs), m = byId(mine);
  const out = [];
  const take = (id) => {
    const bi = b.get(id), ti = t.get(id), mi = m.get(id);
    if (!bi) return ti ?? mi; // added by one side (or both: keep theirs)
    if (!ti) return same(mi, bi) ? null : mi; // they deleted; keep only if I edited it
    if (!mi) return same(ti, bi) ? null : ti; // I deleted; keep only if they edited it
    return mergeItem(bi, ti, mi, state);
  };
  const seen = new Set();
  for (const id of [...t.keys(), ...m.keys()]) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = take(id);
    if (item) out.push(item);
  }
  return out;
}

function mergeBlock(base, theirs, mine, state) {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(theirs, mine)) return mine;
  if (mine.type === 'subsection' && theirs.type === 'subsection') {
    return {
      ...mine,
      heading: pick(base.heading, theirs.heading, mine.heading, state),
      blocks: mergeList(base.blocks, theirs.blocks, mine.blocks, mergeBlock, state),
    };
  }
  state.conflicts++;
  return mine;
}

function mergeSection(base, theirs, mine, state) {
  if (same(mine, base)) return theirs;
  if (same(theirs, base) || same(theirs, mine)) return mine;
  return {
    ...mine,
    heading: pick(base.heading, theirs.heading, mine.heading, state),
    blocks: mergeList(base.blocks, theirs.blocks, mine.blocks, mergeBlock, state),
  };
}

export function mergeContent(base, theirs, mine) {
  const state = { conflicts: 0 };
  const merged = {
    ...mine,
    title: pick(base.title, theirs.title, mine.title, state),
    intro: pick(base.intro, theirs.intro, mine.intro, state),
    sections: mergeList(base.sections, theirs.sections, mine.sections, mergeSection, state),
  };
  return { merged, conflicts: state.conflicts };
}

// ponytail: self-check, run with `node src/lib/merge.js`
if (typeof process !== 'undefined' && process.argv[1]?.endsWith('merge.js')) {
  const blk = (id, markdown) => ({ id, type: 'text', markdown });
  const sec = (blocks) => ({ id: 's', heading: 'H', blocks });
  const base = { title: '', intro: '', sections: [sec([blk('a', '1'), blk('b', '2')])] };
  const theirs = { ...base, sections: [sec([blk('a', '1'), blk('b', 'THEIRS'), blk('c', 'new')])] };
  const mine = { ...base, sections: [sec([blk('a', 'MINE'), blk('b', '2')])] };
  const { merged, conflicts } = mergeContent(base, theirs, mine);
  const bl = merged.sections[0].blocks;
  console.assert(conflicts === 0, 'no conflicts');
  console.assert(bl.find(x => x.id === 'a').markdown === 'MINE', 'my edit kept');
  console.assert(bl.find(x => x.id === 'b').markdown === 'THEIRS', 'their edit kept');
  console.assert(bl.some(x => x.id === 'c'), 'their new block kept');
  console.log('merge ok');
}
