import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styles = readFileSync(join(here, "../../../styles/analysis-coach-bento.css"), 'utf8');
const routeBlock = styles.match(
  /#root \.analysis-coach-bento__reasons ol \{[^}]*\}/,
)?.[0];

assert.ok(routeBlock, 'Coach Insight should have a route-scoped reason-list style block.');
assert.match(routeBlock, /gap:\s*10px;/, 'Coach Insight reasons should have visible space between rows.');
assert.match(styles, /#root \.analysis-coach-bento > section,\s*#root \.analysis-coach-bento__signal\s*\{[^}]*padding:\s*22px 24px;/, 'Coach Insight reason tiles should retain padding around the list.');
assert.match(
  source,
  /<section className="analysis-coach-bento__reasons">\s*<h3>\{coachSystem\.copy\.reasonsTitle\}<\/h3>\s*<ol>\s*\{coachSystem\.reasons\.map\(\(point\) => \(\s*<li key=\{point\}>\{point\}<\/li>/,
  'Coach Insight reasons should have a dedicated surface hook.',
);
assert.match(
  styles,
  /#root \.analysis-coach-bento > section,\s*#root \.analysis-coach-bento__signal\s*\{[^}]*background:\s*var\(--bento-card\);[^}]*box-shadow:\s*none;/,
  'Coach Insight reasons should retain the surrounding card surface.',
);
assert.match(
  routeBlock,
  /counter-reset:\s*reason;/,
  'Coach Insight reasons should retain ordered numbering.',
);
const titleBlock = styles.match(/#root \.analysis-coach-bento :is\(\.analysis-coach-bento__phase, \.analysis-coach-bento__reasons, \.analysis-coach-bento__recent\) h3\s*\{[^}]*\}/)?.[0];
assert.ok(titleBlock, 'Coach Insight reasons should retain dedicated heading styling.');
assert.doesNotMatch(titleBlock, /(?:background|border|box-shadow)\s*:/, 'Coach Insight reasons should retain a plain title without a panel strip.');
assert.match(styles, /#root \.analysis-coach-bento__reasons li::before\s*\{[^}]*content:\s*counter\(reason\);[^}]*flex:\s*0 0 20px;/, 'Coach Insight reason numbers should retain space beside their text.');

console.log('[PASS] Coach Insight reason grids have padded spacing.');
