import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  racesDetailSource,
  /zoomControl:\s*true/,
  'RacesDetail should keep Leaflet zoom controls enabled so the city map card reads like a normal Leaflet map.',
);

assert.doesNotMatch(
  styleSource,
  /\.race-detail-map-leaflet \.leaflet-control-container,[\s\S]*display:\s*none;/,
  'Race detail styles should not hide the Leaflet control regions when the city map is meant to look like a standard map stage.',
);

assert.match(
  styleSource,
  /\.race-detail-map-stage\s*\{[\s\S]*(?:min-height|height):\s*clamp\(/,
  'Race detail map stage should stay tall enough to read as the main world-map block instead of a compressed utility card.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet\s*\{[\s\S]*filter:\s*none;/,
  'Race detail Leaflet host should not apply grayscale or cinematic dimming when the target is a normal city map.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-hud"/,
  'RacesDetail should not keep the older map HUD overlay once the user asks for a bare map stage.',
);

assert.match(
  styleSource,
  /\.race-detail-map-canvas\s*\{[\s\S]*background:\s*#ece7df;/,
  'Race detail map canvas should keep only a very light atmospheric wash so the OpenStreetMap layer reads as the true bottom layer.',
);

assert.doesNotMatch(
  styleSource,
  /\.race-detail-map-canvas\s*\{[\s\S]*radial-gradient\(circle at 16% 18%/,
  'Race detail map canvas should not keep the stronger decorative radial tints once OpenStreetMap is meant to be the clear bottom layer.',
);

assert.match(
  racesDetailSource,
  /const courseImagePane = map\.createPane\('race-detail-course-image'\);[\s\S]*const routeShadowPane = map\.createPane\('race-detail-route-shadow'\);[\s\S]*const routePane = map\.createPane\('race-detail-route'\);[\s\S]*const routeMarkerPane = map\.createPane\('race-detail-route-marker'\);/,
  'RacesDetail should create dedicated Leaflet panes so the transparent course-map image sits above the basemap and below the AI-scanned route.',
);

assert.match(
  racesDetailSource,
  /L\.polyline\(routeMapPoints,\s*\{[\s\S]*pane:\s*'race-detail-route-shadow'[\s\S]*\}\)\.addTo\(map\);[\s\S]*polyline = L\.polyline\(routeMapPoints,\s*\{[\s\S]*pane:\s*'race-detail-route'[\s\S]*\}\)\.addTo\(map\);/,
  'RacesDetail should render the AI route with a dedicated top-layer route line and a backing stroke so it reads clearly over OpenStreetMap tiles.',
);

assert.match(
  racesDetailSource,
  /L\.circleMarker\(routeMapPoints\[0\],\s*\{[\s\S]*pane:\s*'race-detail-route-marker'/,
  'RacesDetail should place AI-route start markers in the dedicated top marker pane above the basemap.',
);

assert.doesNotMatch(
  racesDetailSource,
  /L\.imageOverlay\(courseMapData\.imageUrl,/,
  'RacesDetail should not draw the raw course-map image over the runner-facing Leaflet map when the goal is an extracted route on a real basemap.',
);

assert.doesNotMatch(
  racesDetailSource,
  /!routeMapReady && courseMapData\.imageUrl \?/,
  'RacesDetail should not keep a raw course-map image fallback inside the runner-facing map canvas.',
);

console.log('[PASS] Race detail visual map baseline guardrails passed.');
