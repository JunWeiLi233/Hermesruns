import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'PredictionDetail.jsx'), 'utf8');

assert.match(
  source,
  /const showConfidencePanel = distance\?\.key !== '5k' && distance\?\.key !== '10k' && distance\?\.key !== 'half' && distance\?\.key !== 'marathon';/,
  'The marathon prediction should disable the confidence hero panel.',
);
assert.match(
  source,
  /prediction-forecast-hero\$\{showConfidencePanel \? '' : ' is-confidence-removed'\}/,
  'The marathon hero should expand after its confidence panel is removed.',
);
assert.match(
  source,
  /\{showConfidencePanel \? \([\s\S]*?prediction-forecast-hero-panel[\s\S]*?\) : null\}/,
  'The confidence panel should remain conditionally rendered for routes that still use it.',
);

console.log('[PASS] Marathon prediction confidence panel removal guard passed.');
