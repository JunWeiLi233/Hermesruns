import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const appCss = read('./styles/app.css');
const summaryCss = read('./styles/run-summary-v2.css');
const runCss = read('./styles/run-detail-v2.css');
const card = read('./pages/runs/RunSummaryCard.jsx');
const detail = read('./pages/runs/RunDetail.jsx');

// The stylesheet is part of the app's style graph, and app.css still ends with the dialog stylesheet the other contracts expect.
assert.match(appCss, /@import '\.\/run-summary-v2\.css';/, 'run-summary-v2.css must be imported by app.css.');
assert.ok(appCss.indexOf("@import './run-summary-v2.css';") < appCss.indexOf("@import './race-form-modal-v2.css';"), 'run-summary-v2.css must come before race-form-modal-v2.css, which stays last.');

// Every class the card draws with has a rule, so nothing is left unstyled by a typo.
const classes = new Set([...card.matchAll(/run-summary__[-\w]+/g)].map((match) => match[0]));
assert.ok(classes.size >= 10, 'The summary card should draw with its own run-summary__* classes.');
for (const name of classes) assert.ok(summaryCss.includes(`.${name}`), `${name} is used by the summary card but has no style.`);
for (const shared of ['run-detail-v2__card', 'run-detail-v2__card-head', 'run-detail-v2__link', 'run-detail-v2__muted']) {
  assert.ok(runCss.includes(`.${shared}`), `${shared}, which the summary card shares, lost its rule.`);
}

// Colours come from the run page's own tokens (light and midnight), never raw values.
const tokens = new Set([...summaryCss.matchAll(/var\((--v2-[a-z0-9-]+)/g)].map((match) => match[1]));
const defined = new Set([...runCss.matchAll(/(--v2-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of tokens) assert.ok(defined.has(token), `${token} is used by the summary card but the run page does not define it.`);
assert.doesNotMatch(summaryCss, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, 'The summary card must use the run page tokens, not raw colours.');

// The shell restyles every label and span on the run page as a small muted caption, so the card's text is not in either.
const spans = card.match(/<span\b[^>]*>/g) ?? [];
assert.ok(spans.every((tag) => tag.includes('page-skeleton__block')), 'The summary card must not put text in a span: the shell turns every span into a caption.');
assert.doesNotMatch(card, /<label\b/, 'The summary card must not use a label: the shell turns every label into a caption.');

// The run page mounts it once, for the run on screen, after the overview, holding it back until the stream has been asked for.
assert.equal((detail.match(/<RunSummaryCard\b/g) ?? []).length, 1, 'RunDetail should mount the summary card once.');
assert.match(detail, /<RunSummaryCard key=\{`summary-\$\{run\.id\}`\} runId=\{run\.id\} streamReady=\{streamCheckedFor === run\.id\} refreshToken=\{paceRefresh\} \/>/);
assert.ok(detail.indexOf('<RunSummaryCard') > detail.indexOf('id="run-detail-overview"'), 'The summary comes after the overview.');
assert.ok(detail.indexOf('<RunSummaryCard') < detail.indexOf('id="run-detail-coach"'), 'The summary comes before the coach card.');
assert.doesNotMatch(detail, /\/summary/, 'RunDetail must not fetch the summary itself; the card does.');

// The request is made through the shared resource hook, the only place the summary is asked for.
assert.match(read('./pages/runs/useRunSummary.js'), /\/api\/activities\/\$\{runId\}\/summary/);
assert.doesNotMatch(card, /apiJson|apiFetch/, 'The card asks for the summary through useRunSummary only.');

// The switch for every run is in Settings, next to the other display choices, and kept in the browser like them.
const settings = read('./components/SettingsAtlasLayout.jsx');
assert.match(settings, /useRunSummariesEnabled/);
assert.match(settings, /settings\.run_summaries_title/);
assert.match(read('./utils/runSummaryPreference.js'), /localStorage/);

console.log('[PASS] Run summary wiring, styles and tokens.');
