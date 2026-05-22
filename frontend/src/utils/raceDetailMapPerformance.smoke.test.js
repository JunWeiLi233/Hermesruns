import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /getBackendBaseUrl[\s\S]*\/api\/maps\/tiles\/\{z\}\/\{x\}\/\{y\}\.png/,
  'RacesDetail should use the same-origin Hermes tile endpoint for the real-world map so tile loading benefits from local caching and avoids slow direct third-party tile fetches.',
);

assert.match(
  racesDetailSource,
  /const applyRouteMapViewport = \(\) => \{/,
  'RacesDetail should define a dedicated viewport helper for the Leaflet race map.',
);

assert.match(
  racesDetailSource,
  /const finalizeMapLayout = \(\) => \{[\s\S]*map\.invalidateSize\(\{ pan: false \}\);[\s\S]*applyRouteMapViewport\(\);[\s\S]*activeTileLayer\?\.redraw\?\.\(\);/,
  'RacesDetail should reapply the Leaflet viewport after invalidateSize so the route map still lands on the real course when the card gets its final layout size.',
);

assert.match(
  racesDetailSource,
  /setTimeout\(finalizeMapLayout, 180\)/,
  'RacesDetail should keep the delayed post-layout pass so the real-world map can settle after the card finishes sizing.',
);

console.log('[PASS] Race detail map performance guardrails passed.');
