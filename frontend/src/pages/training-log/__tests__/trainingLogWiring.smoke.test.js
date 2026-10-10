import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const repoRoot = path.resolve(srcRoot, '../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const logCss = read('./styles/training-log-v2.css');
const labelsCss = read('./styles/run-labels-v2.css');
const runCss = read('./styles/run-detail-v2.css');

// The two stylesheets are part of the app's style graph.
assert.match(appCss, /@import '\.\/training-log-v2\.css';/, 'training-log-v2.css must be imported by app.css.');
assert.match(appCss, /@import '\.\/run-labels-v2\.css';/, 'run-labels-v2.css must be imported by app.css.');

// Every class the training log draws with has a rule, so nothing is left unstyled by a typo.
const logSources = ['TrainingLog.jsx', 'LogWeek.jsx', 'LogFilters.jsx'].map((name) => read(`./pages/training-log/${name}`)).join('\n');
const logClasses = new Set([...logSources.matchAll(/training-log-v2__[-\w]+/g)].map((match) => match[0]));
assert.ok(logClasses.size >= 30, 'The training log should draw with its own training-log-v2__* classes.');
for (const name of logClasses) {
  assert.ok(logCss.includes(`.${name}`), `${name} is used by the training log but has no style.`);
}

// So does the run page's card.
const labelsSource = read('./pages/runs/RunLabelsCard.jsx');
const labelClasses = new Set([...labelsSource.matchAll(/run-labels__[-\w]+/g)].map((match) => match[0]));
assert.ok(labelClasses.size >= 12, 'The run labels card should draw with its own run-labels__* classes.');
for (const name of labelClasses) {
  assert.ok(labelsCss.includes(`.${name}`), `${name} is used by the run labels card but has no style.`);
}
for (const shared of ['run-detail-v2__card', 'run-detail-v2__card-head', 'run-detail-v2__link', 'run-detail-v2__muted']) {
  assert.ok(runCss.includes(`.${shared}`), `${shared}, which the run labels card shares, lost its rule.`);
}

// Colours come from tokens: the training log's own (light and midnight), the run page's for the card.
const logTokens = new Set([...logCss.matchAll(/var\((--tl-[a-z0-9-]+)/g)].map((match) => match[1]));
const logDefined = new Set([...logCss.matchAll(/(--tl-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of logTokens) assert.ok(logDefined.has(token), `${token} is used by the training log but never defined.`);
assert.match(logCss, /body:is\(\.theme-midnight, \.theme-high-contrast\) #root \.training-log-v2 \{/, 'The training log must have a midnight palette.');
const labelTokens = new Set([...labelsCss.matchAll(/var\((--v2-[a-z0-9-]+)/g)].map((match) => match[1]));
const runDefined = new Set([...runCss.matchAll(/(--v2-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of labelTokens) assert.ok(runDefined.has(token), `${token} is used by the run labels card but the run page does not define it.`);

// A chosen chip stays chosen under the pointer: its rule must outrank the hover rule, which also excludes the plain link.
assert.ok(logCss.includes('#root .training-log-v2__chips button:not(.training-log-v2__link)[aria-pressed="true"]'), 'A pressed chip must outrank the hover rule.');
assert.ok(logCss.indexOf('button:not(.training-log-v2__link):hover') < logCss.indexOf('button:not(.training-log-v2__link)[aria-pressed="true"]'), 'The pressed rule must come after the hover rule.');

// No raw colours outside the token blocks: after the palette blocks, the rules use var(--...) only.
const afterPalette = (css, marker) => css.slice(css.indexOf(marker));
const rawColour = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
const logRules = afterPalette(logCss, '#root .training-log-v2 :is(h1, h2, h3, p, dl, dd, ol, ul)');
assert.doesNotMatch(logRules, rawColour, 'The training log rules must use tokens, not raw colours.');
assert.doesNotMatch(labelsCss, rawColour, 'The run labels card must use the run page tokens, not raw colours.');

// The page is routed, preloaded and served: a refresh on /training-log must get the app, not the API's 401.
const app = read('./App.jsx');
assert.match(app, /const TrainingLog = React\.lazy\(routePreloaders\['\/training-log'\]\);/);
assert.match(app, /<Route path="\/training-log" element=\{<UserOnlyRoute><TrainingLog \/><\/UserOnlyRoute>\} \/>/);
assert.match(read('./utils/routePreload.js'), /'\/training-log': \(\) => import\('\.\.\/pages\/training-log\/TrainingLog\.jsx'\)/);
const spaController = readFileSync(path.join(repoRoot, 'backend/src/main/java/com/hermes/backend/infrastructure/web/SpaForwardingController.java'), 'utf8');
assert.ok(spaController.includes('"/training-log"'), 'SpaForwardingController must serve the app for /training-log.');

// The run page mounts the card once, for the run on screen, and the run page gained no request of its own for it.
const runDetail = read('./pages/runs/RunDetail.jsx');
assert.equal((runDetail.match(/<RunLabelsCard\b/g) ?? []).length, 1, 'RunDetail should mount the labels card once.');
assert.match(runDetail, /<RunLabelsCard key=\{`labels-\$\{run\.id\}`\} runId=\{run\.id\} \/>/);
assert.doesNotMatch(runDetail, /\/labels/, 'RunDetail must not fetch the labels itself; the card does.');

// The shared shell can be given a title and a parent without changing what Settings pages get.
const chrome = read('./components/AuthenticatedPageChrome.jsx');
assert.match(chrome, /parentLabel \|\| t\('settings\.heading'\)/);
assert.match(chrome, /parentRoute \|\| '\/settings'/);

console.log('[PASS] Training log and run labels wiring, styles and tokens.');
