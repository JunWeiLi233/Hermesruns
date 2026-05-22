import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'Races.jsx'), 'utf8');

assert.match(
  source,
  /distanceKm:\s*String\(catalogRace\.distanceKm\)/,
  'Catalog add-to-plan should preserve precise catalog race distances.',
);

assert.match(
  source,
  /<input\s+type="number"\s+min="1"\s+step="any"\s+value=\{form\.distanceKm\}/,
  'Race distance input must accept precise marathon and half-marathon catalog distances such as 42.195 and 21.0975.',
);

console.log('[PASS] Races catalog distance precision guard passed.');
