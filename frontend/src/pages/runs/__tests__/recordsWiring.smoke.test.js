import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');

const runDetail = read('./pages/runs/RunDetail.jsx');
const profile = read('./pages/profile/ProfileDashboard.jsx');
const analysis = read('./pages/profile/BestEffortsAnalysis.jsx');
const analysisHook = read('./pages/profile/useBestEffortsAnalysis.js');

// The run page gains no request of its own: each card fetches what it draws, once the stream is there.
assert.doesNotMatch(runDetail, /best-efforts|\/matches/, 'RunDetail.jsx must leave the best efforts and the matches to their cards.');
for (const [hook, url] of [['useRunBestEfforts', 'best-efforts'], ['useRunMatches', 'matches']]) {
  const text = read(`./pages/runs/${hook}.js`);
  assert.ok(text.includes('`/api/activities/${runId}/' + url + '`'), `${hook} should read /api/activities/{id}/${url}.`);
  assert.match(text, /\{ enabled \}/, `${hook} must hold its request back until the run's stream is there.`);
}
for (const component of ['RunBestEfforts', 'RunMatches']) {
  const text = read(`./pages/runs/${component}.jsx`);
  assert.doesNotMatch(text, /apiJson\(['"`]\/api\/activities\/[^'"`]*\/(?:matches)/, `${component} reads through its hook.`);
  assert.match(text, /streamReady/, `${component} must wait for the run's stream.`);
}

// The best-efforts section sits between the progression chart and the bottom grid of the Profile page, once.
assert.ok(profile.includes("import BestEffortsAnalysis from './BestEffortsAnalysis';"), 'The Profile page imports the best-efforts analysis.');
assert.equal((profile.match(/<BestEffortsAnalysis \/>/g) || []).length, 1, 'The Profile page shows the best-efforts analysis once.');
assert.ok(
  profile.indexOf('<ProgressionChart') < profile.indexOf('<BestEffortsAnalysis />')
    && profile.indexOf('<BestEffortsAnalysis />') < profile.indexOf('hd-bottom-grid'),
  'The best-efforts analysis follows the progression chart and comes before the bottom grid.',
);

// First paint is what it was: the dashboard makes no best-efforts request, and the section makes none until opened.
assert.doesNotMatch(profile, /best-efforts/, 'ProfileDashboard.jsx must not fetch the best efforts itself.');
assert.match(analysis, /const \[wanted, setWanted\] = useState\(false\);/, 'The section starts without asking for anything.');
assert.match(analysis, /useBestEffortsAnalysis\(\{ enabled: wanted, distance, year \}\)/, 'The section holds its request back until it is opened.');
assert.match(analysis, /setWanted\(true\)/, 'Opening the section is what asks for the analysis.');
assert.doesNotMatch(analysis, /apiJson|cachedApiJson|fetch\(/, 'The section reads through its hook only.');
assert.match(analysisHook, /useRunResource\(`\/api\/training\/best-efforts\$\{text \? `\?\$\{text\}` : ''\}`, isAnalysis, \{ enabled \}\)/, 'The hook reads /api/training/best-efforts and passes the hold-back flag on.');

console.log('[PASS] The records cards and the Profile section are wired in without extra first-paint requests.');
