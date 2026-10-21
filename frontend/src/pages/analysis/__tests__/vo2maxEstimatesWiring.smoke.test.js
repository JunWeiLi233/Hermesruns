import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const css = read('./styles/vo2max-estimates-v2.css');
const embeddedCss = read('./styles/analysis-redesign-v3.css');
const page = read('./pages/analysis/Vo2maxEstimates.jsx');
const link = read('./components/Vo2maxEstimatesLink.jsx');
const analysis = read('./pages/analysis/Analysis.jsx');
const prediction = read('./pages/prediction/PredictionDetail.jsx');
const app = read('./App.jsx');
const preload = read('./utils/routePreload.js');

// The stylesheet is part of the app's style graph.
assert.match(appCss, /@import '\.\/vo2max-estimates-v2\.css';/, 'vo2max-estimates-v2.css must be imported by app.css.');
assert.ok(
  appCss.indexOf("@import './vo2max-estimates-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'vo2max-estimates-v2.css must come before race-form-modal-v2.css, with the other v2 sheets.',
);

// Legacy addresses redirect into existing pages; the section never creates another page shell.
assert.ok(app.includes('path="/analysis/vo2max-estimates" element={<UserOnlyRoute><AnalysisFeatureRedirect pathname="/analysis" anchor="vo2max-estimates" />'));
assert.ok(preload.includes("'/analysis/vo2max-estimates': () => import('../pages/analysis/Analysis.jsx')"));
assert.ok(!page.includes('AuthenticatedPageChrome'), 'Embedded analysis must reuse its parent shell.');
assert.ok(read('./pages/analysis/AnalysisFeatures.jsx').includes('<Vo2maxEstimates '));

// Every class of its own that the page draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...page.matchAll(/vo2max-estimates-v2__[-\w]+/g)].map((match) => match[0]));
assert.ok(classes.size >= 20, 'The page should draw with its own vo2max-estimates-v2__* classes.');
for (const name of classes) {
  assert.ok((css + embeddedCss).includes(`.${name}`), `${name} is used by the VO2max estimates page but has no style.`);
}
assert.ok(css.includes('.vo2max-estimates-v2 {'), 'The page has a root rule that defines its tokens.');
assert.match(link, /vo2max-estimates-link/);
assert.ok(css.includes('.vo2max-estimates-link'), 'The link to the page has a rule.');

// The cards that show the number link to the page.
assert.match(analysis, /<Link to="\/analysis#vo2max-estimates" aria-label=\{t\('vo2max_estimates.link'\)\}/, 'The VO2max card title links to its evidence.');
assert.match(prediction, /<Vo2maxEstimatesLink \/>/, 'The prediction page, made from the same estimates, links to the page.');

// Colours come from tokens, and every token has a value in the light theme and in the midnight theme.
const tokens = new Set([...css.matchAll(/var\((--ve-[a-z0-9-]+)/g)].map((match) => match[1]));
assert.ok(tokens.size >= 10, 'The page colours itself with its own --ve-* tokens.');
const [light, midnight] = css.split('body:is(.theme-midnight, .theme-high-contrast) #root .vo2max-estimates-v2 {');
const midnightBlock = midnight.slice(0, midnight.indexOf('}'));
for (const token of tokens) {
  assert.match(light, new RegExp(`${token}:`), `${token} has no light value.`);
}
for (const token of ['--ve-card', '--ve-ink', '--ve-muted', '--ve-faint', '--ve-line', '--ve-accent', '--ve-mean', '--ve-other']) {
  assert.match(midnightBlock, new RegExp(`${token}:`), `${token} has no midnight value.`);
}
assert.ok(!css.includes('!important'), 'The page should not need !important.');

console.log('[PASS] VO2max estimates wiring passed.');
