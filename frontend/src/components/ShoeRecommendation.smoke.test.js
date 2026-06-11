import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'ShoeRecommendation.jsx'), 'utf8');

assert.match(
  source,
  /if \(!recommendedShoe\) return null;/,
  'ShoeRecommendation should stay inert when no recommendation exists.',
);

assert.match(
  source,
  /const isWarning = recommendedShoe\.currentDistanceKm > \(maxDist \* 0\.9\);/,
  'ShoeRecommendation should flag shoes above 90% of max mileage as warning state.',
);

assert.match(
  source,
  /const isCritical = recommendedShoe\.currentDistanceKm >= maxDist;/,
  'ShoeRecommendation should flag shoes at or above max mileage as critical state.',
);

assert.match(
  source,
  /to="\/shoes"/,
  'ShoeRecommendation should keep the direct gear-management escape hatch.',
);

assert.match(
  source,
  /Math\.min\(100, \(recommendedShoe\.currentDistanceKm \/ maxDist\) \* 100\)/,
  'ShoeRecommendation should clamp the progress bar width at 100%.',
);

console.log('[PASS] Shoe recommendation smoke coverage passed.');
