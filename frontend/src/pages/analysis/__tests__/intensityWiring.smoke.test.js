import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const css = read('./styles/training-intensity-v2.css');
const section = read('./pages/analysis/IntensitySection.jsx');
const page = read('./pages/analysis/AnalysisInsightDetail.jsx');

// The stylesheet is part of the app's style graph, and the Load balance page draws the card.
assert.match(appCss, /@import '\.\/training-intensity-v2\.css';/, 'training-intensity-v2.css must be imported by app.css.');
assert.ok(
  appCss.indexOf("@import './training-intensity-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"),
  'training-intensity-v2.css must come before race-form-modal-v2.css, with the other v2 sheets.',
);
assert.match(page, /import IntensitySection from '\.\/IntensitySection';/, 'The Load balance page must import the time-in-zones card.');
assert.match(page, /<IntensitySection \/>/, 'The Load balance page must draw the time-in-zones card.');
assert.ok(
  page.indexOf('<WeeklyEffortSection />') < page.indexOf('<IntensitySection />'),
  'The time-in-zones card follows the weekly effort on the Load balance page.',
);

// Every class of its own that the card draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...section.matchAll(/training-intensity-v2(?:__[-\w]+)?/g)].map((match) => match[0]));
assert.ok(classes.size >= 4, 'The card should draw with its own training-intensity-v2 classes.');
for (const name of classes) {
  assert.ok(css.includes(`.${name}`), `${name} is used by the time-in-zones card but has no style.`);
}
for (let zone = 1; zone <= 5; zone += 1) {
  assert.ok(css.includes(`.training-intensity-v2__segment.is-zone-${zone}`), `zone ${zone} has no bar colour.`);
  assert.ok(css.includes(`i.training-intensity-v2__swatch.is-zone-${zone}`), `zone ${zone} has no key colour.`);
}

// Colours come from tokens, and every token has a value in the light theme and in the midnight theme.
const tokens = new Set([...css.matchAll(/var\((--ti-zone-\d)\)/g)].map((match) => match[1]));
assert.equal(tokens.size, 5, 'The five zones each have a colour token.');
const light = css.split('body:is(.theme-midnight, .theme-high-contrast)')[0];
const midnight = css.split('body:is(.theme-midnight, .theme-high-contrast)')[1] ?? '';
for (const token of tokens) {
  assert.match(light, new RegExp(`${token}:\\s*#[0-9a-f]{6}`, 'i'), `${token} has no light value.`);
  assert.match(midnight, new RegExp(`${token}:\\s*#[0-9a-f]{6}`, 'i'), `${token} has no midnight value.`);
}
assert.ok(!css.includes('!important'), 'The card should not need !important.');

console.log('[PASS] Time in zones wiring passed.');
