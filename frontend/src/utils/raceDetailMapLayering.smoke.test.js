import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /\.race-detail-map-canvas\s*\{[\s\S]*?z-index:\s*0;/,
  'Race detail map canvas shell should sit at the base of the stage while the live Leaflet host paints above it.',
);

assert.match(
  styleSource,
  /\.race-detail-map-leaflet\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*1;[\s\S]*?opacity:\s*0;/,
  'Race detail Leaflet host should sit above the fallback image layer so the real map remains the primary background once ready.',
);

assert.doesNotMatch(
  styleSource,
  /\.race-detail-map-image-fallback\s*\{/,
  'Race detail map styles should not keep an older image-fallback layer once the route stage is Leaflet-only.',
);

console.log('[PASS] Race detail map layering guardrails passed.');
