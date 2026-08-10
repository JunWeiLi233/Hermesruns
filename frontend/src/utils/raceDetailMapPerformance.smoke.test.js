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
  /const applyRouteMapViewport = \(\{ force = false \} = \{\}\) => \{/,
  'RacesDetail should define a dedicated viewport helper for the Leaflet race map with a force option.',
);

assert.match(
  racesDetailSource,
  /zoomAnimation: true,[\s\S]*fadeAnimation: false,[\s\S]*markerZoomAnimation: false,/,
  'RacesDetail should keep Leaflet zoom animation enabled so the previous tile level scales while the next level loads instead of exposing beige gaps.',
);

assert.match(
  racesDetailSource,
  /keepBuffer:\s*2,[\s\S]*updateWhenZooming:\s*true,[\s\S]*updateInterval:\s*75,/,
  'RacesDetail should keep a small warm tile buffer and request the next tile row during the zoom gesture instead of leaving the map blank until zoomend.',
);

assert.match(
  racesDetailSource,
  /let fallbackTileLayer = null;[\s\S]*const ensureFallbackTiles = \(\) => \{[\s\S]*fallbackTileLayer = attachTileLayer\(fallbackTileUrl, \{ isFallback: true \}\);/,
  'RacesDetail should keep a direct OSM tile layer warm alongside the proxy so a zoom never starts from a blank map.',
);

assert.match(
  racesDetailSource,
  /const refreshWarmFallbackTiles = \(\) => \{[\s\S]*ensureFallbackTiles\(\)\?\.redraw\?\.\(\);/,
  'RacesDetail should redraw its warm direct OSM layer on every zoom or pan so the next tile row is requested immediately.',
);

const viewChangeHandler = racesDetailSource.match(
  /const refreshCourseMapOverlayOnViewChange = \(\) => \{([\s\S]*?)\n\s*\};/,
);
assert.ok(viewChangeHandler, 'RacesDetail should keep a dedicated view-change handler for route and overlay redraws.');
assert.doesNotMatch(
  viewChangeHandler[1],
  /map\.invalidateSize\(\{\s*pan:\s*false\s*\}\);/,
  'RacesDetail should not invalidate the full map layout after every zoom or pan; size invalidation belongs to the initial and resize passes.',
);

assert.match(
  racesDetailSource,
  /const finalizeMapLayout = \(\) => \{[\s\S]*map\.invalidateSize\(\{ pan: false \}\);[\s\S]*applyRouteMapViewport\(\{ force: true \}\);[\s\S]*activeTileLayer\?\.redraw\?\.\(\);/,
  'RacesDetail should force a final route fit after invalidateSize so the map does not stay at the provisional broad viewport from its first mount.',
);

assert.match(
  racesDetailSource,
  /setTimeout\(finalizeMapLayout, 260\)/,
  'RacesDetail should keep a delayed post-layout pass so the real-world map can settle after the card finishes sizing.',
);

assert.match(
  racesDetailSource,
  /new ResizeObserver\(scheduleMapLayoutSettle\)[\s\S]*mapResizeObserver\.observe\(routeMapHost\)/,
  'RacesDetail should remeasure the Leaflet map when the lower card receives its final responsive dimensions.',
);

assert.match(
  racesDetailSource,
  /const settleMapLayout = \(\) => \{[\s\S]*map\.invalidateSize\(\{ pan: false \}\);[\s\S]*refreshCourseMapOverlayOnViewChange\(\);/,
  'RacesDetail should synchronize the explicit route renderer after Leaflet recalculates the map viewport.',
);

assert.match(
  racesDetailSource,
  /const settleMapLayout = \(\) => \{[\s\S]*if \(!hasUserInteractedWithMap\) \{[\s\S]*applyRouteMapViewport\(\{ force: true \}\);[\s\S]*map\.on\('dragstart', markMapInteraction\)[\s\S]*routeMapHost\.addEventListener\('pointerdown', markMapInteraction/,
  'RacesDetail should stop automatic refits after real pointer interaction while ignoring Leaflet zoom events emitted by its own initial fit.',
);

console.log('[PASS] Race detail map performance guardrails passed.');
