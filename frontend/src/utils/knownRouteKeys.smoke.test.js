// BUG-016, BUG-017: /analysis/<unknown> and /prediction/<unknown> go back to Analysis. App.jsx holds the keys those two pages know;
// this keeps its lists equal to the ones in the pages themselves, so a key added to a page is not turned away at the door.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(src, relative), 'utf8');
const listIn = (source, pattern) => {
  const match = source.match(pattern);
  assert.ok(match, `no list found for ${pattern}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
};

const app = read('App.jsx');

assert.deepEqual(
  listIn(app, /ANALYSIS_INSIGHT_KEYS = \[([^\]]*)\]/),
  listIn(read('pages/analysis/AnalysisInsightDetail.jsx'), /VALID_INSIGHT_KEYS = \[([^\]]*)\]/),
  'App.jsx must let exactly the analysis pages that exist through',
);

const offered = [...read('utils/vdot.js').matchAll(/key: '([^']+)', meters:/g)].map((entry) => entry[1]);
assert.ok(offered.length >= 4, 'the race distances were found in utils/vdot.js');
assert.deepEqual(
  listIn(app, /PREDICTION_DISTANCE_KEYS = \[([^\]]*)\]/),
  offered,
  'App.jsx must let exactly the race distances the prediction page offers through',
);

assert.match(app, /<KnownKeyRoute param="insightKey" keys=\{ANALYSIS_INSIGHT_KEYS\}><AnalysisInsightDetail \/>/, 'the analysis route is wrapped');
assert.match(app, /<KnownKeyRoute param="distKey" keys=\{PREDICTION_DISTANCE_KEYS\}><PredictionDetail \/>/, 'the prediction route is wrapped');
assert.match(app, /if \(!keys\.includes\(params\[param\]\)\) return <Navigate to="\/analysis" replace \/>;/, 'an unknown key goes back to Analysis');

console.log('known route keys: ok');
