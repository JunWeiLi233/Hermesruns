import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, "../pages/races/RacesDetail.jsx"), 'utf8');

assert.match(
  racesDetailSource,
  /apiJson\('\/api\/activities\/analysis'\)/,
  'RacesDetail should use the lightweight activity summary endpoint for prediction data instead of the full activities payload.'
);

assert.doesNotMatch(
  racesDetailSource,
  /setLoadState\('loading'\)/,
  'Supplemental runner data must not reset the ready race page to its initial skeleton.'
);

assert.match(
  racesDetailSource,
  /if \(loadState === 'loading'\) return <PageSkeleton variant="race-detail" \/>/,
  'The initial race data wait should use the same layout as the route chunk fallback.'
);

assert.doesNotMatch(
  racesDetailSource,
  /if \(loadState === 'error'\)/,
  'RacesDetail should keep the race page visible even when supplemental runner data fails to load.'
);

console.log('[PASS] Race detail performance guardrails passed.');
