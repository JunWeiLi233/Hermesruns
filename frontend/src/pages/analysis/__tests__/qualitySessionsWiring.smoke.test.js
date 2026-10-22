import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const repoRoot = path.resolve(srcRoot, '../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const css = read('./styles/quality-sessions-v2.css');
const page = read('./pages/analysis/QualitySessions.jsx');
const analysis = read('./pages/analysis/Analysis.jsx');
const app = read('./App.jsx');
const preload = read('./utils/routePreload.js');
const doc = readFileSync(path.join(repoRoot, 'docs/README-ANALYSIS.md'), 'utf8');

// The stylesheet is part of the app's style graph, with the other v2 sheets.
assert.match(appCss, /@import '\.\/quality-sessions-v2\.css';/, 'quality-sessions-v2.css must be imported by app.css.');
assert.ok(
  appCss.indexOf("@import './quality-sessions-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'quality-sessions-v2.css must come before race-form-modal-v2.css, with the other v2 sheets.',
);

// Legacy addresses redirect into existing pages; the section never creates another page shell.
assert.ok(app.includes('path="/analysis/quality-sessions" element={<UserOnlyRoute><AnalysisFeatureRedirect pathname="/analysis/intensity" anchor="quality-sessions" />'));
assert.ok(preload.includes("'/analysis/quality-sessions': () => import('../pages/analysis/AnalysisInsightDetail.jsx')"));
assert.ok(!page.includes('AuthenticatedPageChrome'), 'Embedded analysis must reuse its parent shell.');
assert.ok(read('./pages/analysis/AnalysisInsightDetail.jsx').includes('<QualitySessions '));

// Every class of its own that the page draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...page.matchAll(/quality-sessions-v2__[-\w]+/g)].map((match) => match[0]));
assert.ok(classes.size >= 20, 'The page should draw with its own quality-sessions-v2__* classes.');
for (const name of classes) {
  assert.ok(css.includes(`.${name}`), `${name} is used by the Quality sessions page but has no style.`);
}
assert.ok(css.includes('.quality-sessions-v2 {'), 'The page has a root rule that defines its tokens.');

// Analysis links to the page, from the card that links to the others.
assert.match(analysis, /<Link className="analysis-v3-quality-link" to="\/analysis\/intensity#quality-sessions">/, 'Analysis links to the Quality sessions page.');

// Colours come from tokens, and every token has a value in the light theme and in the midnight theme.
const tokens = new Set([...css.matchAll(/var\((--qs-[a-z0-9-]+)/g)].map((match) => match[1]));
assert.ok(tokens.size >= 8, 'The page colours itself with its own --qs-* tokens.');
const [light, midnight] = css.split('body:is(.theme-midnight, .theme-high-contrast) #root .quality-sessions-v2 {');
const midnightBlock = midnight.slice(0, midnight.indexOf('}'));
for (const token of tokens) {
  assert.match(light, new RegExp(`${token}:`), `${token} has no light value.`);
}
for (const token of ['--qs-card', '--qs-ink', '--qs-muted', '--qs-faint', '--qs-line', '--qs-accent']) {
  assert.match(midnightBlock, new RegExp(`${token}:`), `${token} has no midnight value.`);
}
assert.ok(!css.includes('!important'), 'The page should not need !important.');

// The link that says how the numbers are worked out goes to a section that exists.
assert.match(page, /<MethodsLink anchor="quality-sessions" \/>/, 'The page links to the methods document.');
assert.match(doc, /^## Quality Sessions$/m, 'The methods document has the section the page links to.');

console.log('[PASS] Quality sessions wiring passed.');
