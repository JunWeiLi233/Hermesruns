import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');

const pageSource = read('../PredictionDetail.jsx');
const styleSource = read('../../../styles/prediction-profile-alignment.css');

assert.match(
  pageSource,
  /const showConfidencePanel = distance\?\.key !== '5k' && distance\?\.key !== '10k' && distance\?\.key !== 'half' && distance\?\.key !== 'marathon';[\s\S]*?prediction-forecast-hero\$\{showConfidencePanel \? '' : ' is-confidence-removed'\}/,
  'The prediction hero should mark itself when the redundant confidence grid is removed.',
);
assert.match(
  pageSource,
  /\{showConfidencePanel \? \([\s\S]*?prediction-forecast-hero-panel[\s\S]*?\) : null\}/,
  'The confidence grid should remain available only on prediction routes that still use it.',
);
assert.match(
  styleSource,
  /\.prediction-detail-page \.prediction-forecast-hero\.is-confidence-removed\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
  'Removing the 5K confidence grid should let the forecast hero use one full-width column.',
);

console.log('[PASS] Prediction 5K confidence grid removal guard passed.');
