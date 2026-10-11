import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const runCss = read('./styles/run-detail-v2.css');
const profileCss = read('./styles/_split/profile-dashboard-redesign.css');
const marker = runCss.indexOf('/* Best efforts and same-route runs */');
assert.ok(marker > 0, 'run-detail-v2.css should keep the best efforts and same-route block.');
const recordsCss = runCss.slice(marker);

const runSources = ['RunBestEfforts.jsx', 'RunMatches.jsx'].map((name) => ({ name, text: read(`./pages/runs/${name}`) }));

// Every class the two run cards draw with has a rule, so nothing is left unstyled by a typo. The shared ones (card,
// card head, link, button, muted text, segmented control, training state) are the page's own.
const own = new Set();
for (const { text } of runSources) {
  for (const match of text.matchAll(/run-detail-v2__(?:be|rm)-[-\w]+/g)) own.add(match[0]);
}
assert.ok(own.size >= 25, 'The run cards should draw with their own run-detail-v2__be-* and run-detail-v2__rm-* classes.');
for (const name of own) {
  assert.ok(recordsCss.includes(`.${name}`), `${name} is used by a run card but has no style.`);
}
for (const shared of ['run-detail-v2__card', 'run-detail-v2__card-head', 'run-detail-v2__link', 'run-detail-v2__btn', 'run-detail-v2__muted', 'run-detail-v2__segmented', 'run-detail-v2__training-state']) {
  assert.ok(runCss.includes(`.${shared}`), `${shared}, which the run cards share, lost its rule.`);
}

// The card styles do not reuse a class another section of the page already owns.
for (const { name, text } of runSources) {
  for (const taken of ['run-detail-v2__pace-bar', 'run-detail-v2__pa-', 'run-detail-v2__zone', 'run-detail-v2__splits-table']) {
    assert.ok(!text.includes(taken), `${name} must not reuse ${taken}.`);
  }
}

// The two cards sit on the page as full-width sections with their own anchors.
assert.match(read('./pages/runs/RunBestEfforts.jsx'), /className="run-detail-v2__card run-detail-v2__best-efforts"/);
assert.match(read('./pages/runs/RunMatches.jsx'), /className="run-detail-v2__card run-detail-v2__matches"/);

// The tables lose to the legacy table styles unless they win on specificity and say so.
assert.match(recordsCss, /#root \.run-detail-runner-page \.run-detail-v2 :is\(\.run-detail-v2__be-table, \.run-detail-v2__rm-table\) thead th/);
assert.match(recordsCss, /tbody :is\(th, td\)/);

// Colours come from the page's own tokens, so the dark themes follow.
const tokens = new Set([...recordsCss.matchAll(/var\((--v2-[a-z0-9-]+)/g)].map((match) => match[1]));
const defined = new Set([...runCss.matchAll(/(--v2-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of tokens) {
  assert.ok(defined.has(token), `${token} is used by the records cards but never defined.`);
}
assert.doesNotMatch(recordsCss.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b/, 'The records cards should not hard-code colours.');

// The Profile section: classes with a rule, tokens it defines, and no colour of its own except the error red.
const profileMarker = profileCss.indexOf('/* ── Records: best efforts analysis ── */');
assert.ok(profileMarker > 0, 'The Profile stylesheet should keep the records block.');
const profileBlock = profileCss.slice(profileMarker, profileCss.indexOf('/* Pale coral actions', profileMarker));
const profileSource = read('./pages/profile/BestEffortsAnalysis.jsx');
const profileClasses = new Set([...profileSource.matchAll(/hd-records[-\w]*/g)].map((match) => match[0]));
assert.ok(profileClasses.size >= 15, 'The Profile section should draw with its own hd-records-* classes.');
for (const name of profileClasses) {
  assert.ok(profileBlock.includes(`.${name}`), `${name} is used by the Profile section but has no style.`);
}
const profileTokens = new Set([...profileBlock.matchAll(/var\((--hd-[a-z0-9-]+)/g)].map((match) => match[1]));
const profileDefined = new Set([...profileCss.matchAll(/(--hd-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
for (const token of profileTokens) {
  assert.ok(profileDefined.has(token), `${token} is used by the Profile section but never defined.`);
}

console.log('[PASS] Records styles: every class has a rule, tokens are defined and nothing collides with the rest of the page.');
