import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  racesDetailSource,
  /className="race-detail-map-canvas"[\s\S]*?<div[\s\S]*?ref=\{routeMapRef\}[\s\S]*?className=\{`race-detail-map-leaflet/,
  'RacesDetail should mount Leaflet on a dedicated inner map host so the race-detail card behaves like the working run detail map.',
);

assert.match(
  racesDetailSource,
  /const tilePane = map\.getPane\('tilePane'\);[\s\S]*tilePane\.style\.mixBlendMode = 'normal';[\s\S]*tilePane\.style\.opacity = '1';/,
  'RacesDetail should harden the Leaflet tile pane at runtime so basemap visibility does not depend on stylesheet injection order.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet\s*\{/,
  'Race detail map styles should target the direct Leaflet host element rather than only assuming a nested .leaflet-container child.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet[\s\S]*leaflet-tile[\s\S]*mix-blend-mode:\s*normal\s*!important;/,
  'Race detail map styles should force normal tile compositing with strong specificity so the basemap stays visible on the race-detail map stage.',
);

console.log('[PASS] Race detail map host regression guardrails passed.');
