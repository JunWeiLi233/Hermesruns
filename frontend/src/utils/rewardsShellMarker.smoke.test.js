import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const requiredPages = [
  'Analysis.jsx',
  'PredictionDetail.jsx',
  'Rewards.jsx',
  'Schedule.jsx',
];

for (const page of requiredPages) {
  const source = readFileSync(path.join(here, '..', 'pages', page), 'utf8');
  assert.match(
    source,
    /runner-shell-topbar-profile-actions\s+analysis-stitch-topbar-profile-actions/,
    `${page} should include the analysis-stitch topbar marker on the runner shell profile actions.`
  );
}

console.log('[PASS] Runner-shell marker smoke test passed for required topbar pages.');
