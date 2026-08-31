import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '..', relativePath), 'utf8').replace(/\r\n/g, '\n');
const appIconSource = read('components/AppIcon.jsx');
const insightSource = read('pages/AnalysisInsightDetail.jsx').replace(/\r\n/g, '\n');

const runnerCase = appIconSource.match(/case 'load_balance_runner':[\s\S]*?case 'person':/);
assert.ok(runnerCase, 'AppIcon must define the dedicated Load Balance runner icon before the person icon.');
assert.match(runnerCase[0], /fill="currentColor"/, 'The Load Balance runner must use a filled silhouette.');
assert.ok(
  runnerCase[0].includes('M320 48a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z')
    && runnerCase[0].includes('M91.2 352L32 352c-17.7 0-32 14.3-32 32s14.3 32 32 32'),
  'The Load Balance runner must use the official Font Awesome person-running geometry.',
);
assert.match(
  runnerCase[0],
  /transform="translate\(1\.5 0\) scale\(0\.046875\)"/,
  'The Font Awesome 448x512 path must be centered in the existing 24x24 icon box.',
);
assert.match(
  insightSource,
  /: 'load_balance_runner',\n\s*loadLabel:/,
  'Load Balance generic sample rows must use the dedicated runner icon.',
);

console.log('[PASS] Load Balance runner icon contract passed.');
