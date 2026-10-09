import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const css = read('./styles/run-detail-v2.css');
const sources = ['PaceChart.jsx', 'PaceDistribution.jsx', 'RunPaceAnalysis.jsx'].map((name) => ({ name, text: read(`./pages/runs/${name}`) }));
const marker = css.indexOf('/* Pace analysis */');
assert.ok(marker > 0, 'run-detail-v2.css should keep the pace analysis block.');
const paceCss = css.slice(marker);

// The splits table further down the page already owns these two class names, with a width of its own. A pace card that
// reused them was squeezed to 64 px and its bars were given a table cell's width.
for (const { name, text } of sources) {
  assert.doesNotMatch(text, /run-detail-v2__pace-bar\b/, `${name} must not reuse the splits table's pace-bar class.`);
  assert.doesNotMatch(text, /run-detail-v2__pace(?![-\w])/, `${name} must not reuse the splits table's pace cell class.`);
}
assert.match(css, /\.run-detail-v2__pace-bar \{ width: 40%/, 'The splits table keeps its own pace-bar rule.');

// Every class the pace card draws with has a rule, so nothing is left unstyled by a typo.
const used = new Set();
for (const { text } of sources) {
  for (const match of text.matchAll(/run-detail-v2__(?:pa|pace-analysis)[-\w]*/g)) used.add(match[0]);
}
assert.ok(used.size >= 15, 'The pace card should use its own run-detail-v2__pa-* classes.');
for (const name of used) {
  if (name === 'run-detail-v2__pace-analysis') continue; // the section itself, styled as a card
  assert.ok(paceCss.includes(name) || css.includes(`.${name}`), `${name} is used by the pace card but has no style.`);
}

// The card is a full-width section of the run page, not the splits table's narrow pace cell.
assert.match(read('./pages/runs/RunPaceAnalysis.jsx'), /className="run-detail-v2__card run-detail-v2__pace-analysis"/);

console.log('[PASS] Pace analysis styles do not collide with the splits table and every class has a rule.');
