import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /apiJson\('\/api\/activities\/analysis'\)/,
  'RacesDetail should use the lightweight activity summary endpoint for prediction data instead of the full activities payload.'
);

assert.doesNotMatch(
  racesDetailSource,
  /if \(loadState === 'loading'\)/,
  'RacesDetail should not blank the whole page while runner-specific data is still hydrating.'
);

assert.doesNotMatch(
  racesDetailSource,
  /if \(loadState === 'error'\)/,
  'RacesDetail should keep the race page visible even when supplemental runner data fails to load.'
);

console.log('[PASS] Race detail performance guardrails passed.');
