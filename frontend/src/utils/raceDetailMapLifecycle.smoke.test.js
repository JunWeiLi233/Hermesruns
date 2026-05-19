import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /let cancelled = false;/,
  'RacesDetail should track whether a stale Leaflet init effect has been cancelled before later layout work runs.',
);

assert.match(
  racesDetailSource,
  /if \(cancelled \|\| !routeMapRef\.current\) return undefined;/,
  'RacesDetail should ignore stale map initialization work once a newer render has cancelled the previous init.',
);

assert.match(
  racesDetailSource,
  /if \(!cancelled\) \{[\s\S]*routeMapInstanceRef\.current = map;[\s\S]*setRouteMapReady\(true\);[\s\S]*\}/,
  'RacesDetail should make the Leaflet host visible as soon as the active map instance is installed, so the map stage does not remain blank while later layout finalization runs.',
);

const viewportIndex = racesDetailSource.indexOf('applyRouteMapViewport({ force: true });');
const preAttachInvalidateIndex = racesDetailSource.indexOf('map.invalidateSize({ pan: false });');
const tileAttachIndex = racesDetailSource.indexOf('activeTileLayer = attachTileLayer(tileUrl);');
assert.ok(
  viewportIndex !== -1 && tileAttachIndex !== -1 && viewportIndex < tileAttachIndex,
  'RacesDetail should apply the real map viewport before attaching the primary tile layer so Leaflet requests the street basemap for the active race bounds instead of leaving the stage blank.',
);
assert.ok(
  preAttachInvalidateIndex !== -1 && tileAttachIndex !== -1 && preAttachInvalidateIndex < tileAttachIndex,
  'RacesDetail should invalidate the Leaflet map size before attaching the primary tile layer so street tiles request against the real mounted stage dimensions.',
);

assert.match(
  racesDetailSource,
  /map\.fitBounds\(polyline\.getBounds\(\)\.pad\(0\.1[0-9]\), \{ padding: \[26, 26\], maxZoom: 16 \}\);/,
  'RacesDetail should fit the Leaflet map to the actual route bounds with a tight pad so the street basemap stays at real city-street scale instead of zooming out to a broad overlay box.',
);

assert.match(
  racesDetailSource,
  /if \(createdMap && routeMapInstanceRef\.current === createdMap\) \{[\s\S]*routeMapInstanceRef\.current\.remove\(\);/,
  'RacesDetail cleanup must not call remove() on a null routeMapInstanceRef when an effect is cancelled before Leaflet creates a map.',
);

console.log('[PASS] Race detail map lifecycle guardrails passed.');
