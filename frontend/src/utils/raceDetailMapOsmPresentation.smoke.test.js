import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /\.race-detail-map-stage\s*\{[\s\S]*background:\s*#ece7df;/,
  'Race detail map stage should present as a light stone-neutral frame instead of a green fill.',
);

assert.match(
  styleSource,
  /\.race-detail-map-canvas\s*\{[\s\S]*background:\s*#ece7df;/,
  'Race detail map canvas should use a plain stone-neutral backing so the Leaflet basemap reads like standard OpenStreetMap instead of a green panel.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet \.leaflet-control-zoom a\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.96\);/,
  'Race detail Leaflet zoom controls should stay on a light OSM-style control chrome instead of a dark branded treatment.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet \.leaflet-control-attribution\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\);/,
  'Race detail Leaflet attribution should remain visible on a light OSM-style attribution chip.',
);

console.log('[PASS] Race detail OSM presentation guardrails passed.');
