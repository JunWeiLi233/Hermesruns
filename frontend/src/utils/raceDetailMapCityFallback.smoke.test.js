import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /const fallbackMapLatitude = useMemo\(/,
  'RacesDetail should derive a dedicated fallback latitude for the city Leaflet map instead of trusting sparse route state outright.',
);

assert.match(
  racesDetailSource,
  /asFiniteNumber\(race\?\.lat\) \?\? asFiniteNumber\(catalogRace\?\.lat\)/,
  'RacesDetail should preserve catalog latitude when navigation state is sparse so the city Leaflet basemap still has a real center.',
);

assert.match(
  racesDetailSource,
  /asFiniteNumber\(race\?\.lng\) \?\? asFiniteNumber\(catalogRace\?\.lng\)/,
  'RacesDetail should preserve catalog longitude when navigation state is sparse so the city Leaflet basemap still has a real center.',
);

console.log('[PASS] Race detail city-map fallback guardrails passed.');
