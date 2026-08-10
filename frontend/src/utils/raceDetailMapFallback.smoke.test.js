import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, '../pages/RacesDetail.jsx'), 'utf8');

assert.match(
  racesDetailSource,
  /const tileUrl = useMemo\(\(\) => `\$\{getBackendBaseUrl\(\)\}\/api\/maps\/tiles\/\{z\}\/\{x\}\/\{y\}\.png/, 
  'RacesDetail should use the same-origin tile proxy as its first basemap attempt so the race-detail stage reliably opens on real OSM streets in the local runtime.',
);

assert.match(
  racesDetailSource,
  /const fallbackTileUrl = useMemo\(\(\) => 'https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png', \[\]\);/,
  'RacesDetail should keep a direct OpenStreetMap fallback basemap so the map still has a recovery path if the local proxy fails at runtime.',
);

assert.match(
  racesDetailSource,
  /const switchToFallbackTiles = \(\) => \{/,
  'RacesDetail should centralize tile fallback switching so blank proxy tiles can be replaced decisively.',
);

assert.match(
  racesDetailSource,
  /layer\.on\('tileerror', \(\) => \{[\s\S]*if \(isFallback\) return;[\s\S]*switchToFallbackTiles\(\);[\s\S]*\}\);/,
  'RacesDetail should switch to fallback tiles when the primary tile layer emits tile errors, while ignoring errors from the direct OSM fallback itself.',
);

assert.match(
  racesDetailSource,
  /const ensureFallbackTiles = \(\) => \{[\s\S]*fallbackTileLayer = attachTileLayer\(fallbackTileUrl, \{ isFallback: true \}\);[\s\S]*ensureFallbackTiles\(\);/,
  'RacesDetail should mount the native direct OSM layer during initial map setup so it is already warm before the first zoom.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-image-fallback"/,
  'RacesDetail should rely on a real Leaflet tile fallback path instead of reviving the older DOM image fallback layer.',
);

assert.match(
  racesDetailSource,
  /const switchToFallbackTiles = \(\) => \{[\s\S]*?const layer = ensureFallbackTiles\(\);/,
  'RacesDetail should reuse the warm native Leaflet fallback layer instead of painting a static DOM snapshot outside Leaflet view transforms.',
);

assert.match(
  racesDetailSource,
  /map\.on\('zoomstart moveend', refreshWarmFallbackTiles\)/,
  'RacesDetail should refresh the warm fallback layer on every zoom or pan instead of waiting for a one-time startup timeout.',
);

assert.doesNotMatch(
  racesDetailSource,
  /streetTileFallback|buildStreetTileFallbackSnapshot|race-detail-map-street-fallback/,
  'RacesDetail should not render a React-managed tile snapshot that can remain pinned while the Leaflet map moves.',
);

assert.doesNotMatch(
  racesDetailSource,
  /map\.on\('moveend zoomend resize viewreset', refreshStreetTileFallbackOnViewChange\)/,
  'RacesDetail should not maintain a separate DOM fallback viewport listener once Leaflet owns every tile layer.',
);

assert.doesNotMatch(
  racesDetailSource,
  /\.catch\(\(\)\s*=>\s*\{\s*\}\)/,
  'RacesDetail should not silently swallow Leaflet initialization failures because that leaves the map card blank with no evidence.',
);

assert.match(
  racesDetailSource,
  /console\.error\(/,
  'RacesDetail should log Leaflet initialization failures so race-detail map regressions are diagnosable.',
);

console.log('[PASS] Race detail map fallback guardrails passed.');
