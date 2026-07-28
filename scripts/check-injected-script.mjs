// Guards the iframe preview script in src/components/Preview.jsx.
//
// That script is written inside a JS template literal, so a stray backtick or
// dollar-brace in it terminates the literal early and turns prose into
// executable code. This actually shipped once: a comment reading
//   // several `.section-block` cards now
// became `(…).section - block`, which threw "ReferenceError: block is not
// defined" at runtime and left the whole editor as a blank white page. It built
// and minified without complaint, because the result is still valid syntax.
//
// Runs as part of `npm run build`, so it can never reach a deploy again.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'src/components/Preview.jsx');
const src = readFileSync(file, 'utf8');

const OPEN = 'const injectedScript = `<script>';
const CLOSE = '<\\/script>`;';

const start = src.indexOf(OPEN);
if (start === -1) {
  console.error('check-injected-script: could not find the injected script literal.');
  process.exit(1);
}
const end = src.indexOf(CLOSE, start);
if (end === -1) {
  console.error('check-injected-script: could not find the end of the injected script literal.');
  process.exit(1);
}

// The one interpolation that is meant to be there.
const ALLOWED = new Set(['${contentJson}']);

const body = src.slice(start + OPEN.length, end);
const problems = [];

body.split('\n').forEach((line, i) => {
  const lineNo = src.slice(0, start).split('\n').length + i;

  if (line.includes('`')) {
    problems.push({ lineNo, line, what: 'backtick' });
  }
  for (const match of line.matchAll(/\$\{[^}]*\}/g)) {
    if (!ALLOWED.has(match[0])) {
      problems.push({ lineNo, line, what: `interpolation ${match[0]}` });
    }
  }
});

if (problems.length) {
  console.error('\ncheck-injected-script: the preview iframe script must contain no backticks');
  console.error('and no interpolations other than ${contentJson} — they break out of the');
  console.error('template literal and become executable code.\n');
  for (const p of problems) {
    console.error(`  src/components/Preview.jsx:${p.lineNo}  (${p.what})`);
    console.error(`    ${p.line.trim()}`);
  }
  console.error('');
  process.exit(1);
}

console.log('check-injected-script: preview script clean.');
