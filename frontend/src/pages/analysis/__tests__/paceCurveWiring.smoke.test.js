import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const css = read('./styles/pace-curve-v2.css');
const page = read('./pages/analysis/PaceCurve.jsx');
const link = read('./components/PaceCurveLink.jsx');
const app = read('./App.jsx');
const preload = read('./utils/routePreload.js');

// The stylesheet is part of the app's style graph.
assert.match(appCss, /@import '\.\/pace-curve-v2\.css';/, 'pace-curve-v2.css must be imported by app.css.');
assert.ok(
  appCss.indexOf("@import './pace-curve-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'pace-curve-v2.css must come before race-form-modal-v2.css, with the other v2 sheets.',
);

// Legacy addresses redirect into existing pages; the section never creates another page shell.
assert.ok(app.includes('path="/analysis/pace-curve" element={<UserOnlyRoute><AnalysisFeatureRedirect pathname="/analysis" anchor="pace-curve" />'));
assert.ok(preload.includes("'/analysis/pace-curve': () => import('../pages/analysis/Analysis.jsx')"));
assert.ok(!page.includes('AuthenticatedPageChrome'), 'Embedded analysis must reuse its parent shell.');
assert.ok(read('./pages/analysis/AnalysisFeatures.jsx').includes('<PaceCurve '));

// Every class of its own that the page draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...page.matchAll(/pace-curve-v2__[-\w]+/g)].map((match) => match[0]));
assert.ok(classes.size >= 20, 'The page should draw with its own pace-curve-v2__* classes.');
for (const name of classes) {
  assert.ok(css.includes(`.${name}`), `${name} is used by the pace curve page but has no style.`);
}
assert.ok(css.includes('.pace-curve-v2 {'), 'The page has a root rule that defines its tokens.');
assert.match(link, /pace-curve-link/);
assert.ok(css.includes('.pace-curve-link'), 'The link to the page has a rule.');

// Colours come from tokens, and every token has a value in the light theme and in the midnight theme.
const tokens = new Set([...css.matchAll(/var\((--pc-[a-z0-9-]+)/g)].map((match) => match[1]));
assert.ok(tokens.size >= 10, 'The page colours itself with its own --pc-* tokens.');
const [light, midnight] = css.split('body:is(.theme-midnight, .theme-high-contrast) #root .pace-curve-v2 {');
const midnightBlock = midnight.slice(0, midnight.indexOf('}'));
for (const token of tokens) {
  assert.match(light, new RegExp(`${token}:`), `${token} has no light value.`);
}
for (const token of ['--pc-card', '--pc-ink', '--pc-muted', '--pc-faint', '--pc-line', '--pc-accent', '--pc-critical', '--pc-out']) {
  assert.match(midnightBlock, new RegExp(`${token}:`), `${token} has no midnight value.`);
}
assert.ok(!css.includes('!important'), 'The page should not need !important.');

console.log('[PASS] Pace curve wiring passed.');
