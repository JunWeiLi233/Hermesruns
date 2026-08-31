import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'PredictionDetail.jsx'), 'utf8');

assert.match(
  source,
  /const showConfidencePanel = distance\?\.key !== '5k' && distance\?\.key !== '10k' && distance\?\.key !== 'half' && distance\?\.key !== 'marathon';[\s\S]*?\{showConfidencePanel \? \(\s*<div className="prediction-forecast-hero-panel"[\s\S]*?\) : null\}/,
  'The half-marathon and marathon predictions should omit the confidence hero panel while retaining it for other distances.',
);

console.log('[PASS] Half-marathon prediction omits the confidence panel.');
