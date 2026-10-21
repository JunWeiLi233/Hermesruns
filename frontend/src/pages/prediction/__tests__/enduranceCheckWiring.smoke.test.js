import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const css = read('./styles/endurance-check-v2.css');
const predictionCss = read('./styles/prediction-v2.css');
const component = read('./pages/prediction/EnduranceCheck.jsx');
const page = read('./pages/prediction/PredictionDetail.jsx');

// The stylesheet is part of the app's style graph.
assert.match(appCss, /@import '\.\/endurance-check-v2\.css';/, 'endurance-check-v2.css must be imported by app.css.');
assert.ok(
  appCss.indexOf("@import './endurance-check-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'endurance-check-v2.css must come before race-form-modal-v2.css, with the other v2 sheets.',
);

// The check is part of the prediction page, drawn from the runs the page already loaded and the distance it is showing.
assert.match(page, /import EnduranceCheck from '\.\/EnduranceCheck';/);
assert.match(page, /<EnduranceCheck runs=\{runs\} distanceMeters=\{distance\.meters\} \/>/, 'The prediction hero shows the long-run check.');

// Every class of its own that the component draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...component.matchAll(/endurance-check(?:__[-\w]+)?/g)].map((match) => match[0]));
assert.ok(classes.size >= 5, 'The component should draw with its own endurance-check classes.');
for (const name of classes) {
  assert.ok(css.includes(`.${name}`), `${name} is used by the long-run check but has no style.`);
}

// The colours are its own --ec-* tokens, which borrow the prediction page's --pv-* ones, and every --pv-* one it borrows is
// defined by the page in the light theme and in the midnight theme.
const own = new Set([...css.matchAll(/var\((--ec-[a-z0-9-]+)/g)].map((match) => match[1]));
for (const token of own) {
  assert.match(css, new RegExp(`${token}:`), `${token} is used but never defined.`);
}
const borrowed = new Set([...css.matchAll(/var\((--pv-[a-z0-9-]+)/g)].map((match) => match[1]));
const [light, midnight] = predictionCss.split('body:is(.theme-midnight, .theme-high-contrast) #root .prediction-v2 {');
const midnightBlock = midnight.slice(0, midnight.indexOf('}'));
for (const token of ['--pv-fill', '--pv-ink', '--pv-muted', '--pv-faint']) {
  assert.ok(borrowed.has(token), `The check should borrow ${token} from the page.`);
  assert.match(light, new RegExp(`${token}:`), `${token} has no light value in prediction-v2.css.`);
  assert.match(midnightBlock, new RegExp(`${token}:`), `${token} has no midnight value in prediction-v2.css.`);
}
assert.match(css, /theme-midnight[^{]*\.endurance-check \{ --ec-watch:/, 'The amber has a midnight value.');
assert.ok(!css.includes('!important'), 'The check should not need !important.');

console.log('[PASS] Long-run check wiring passed.');
