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
  /layer\.on\('tileerror', \(\) => \{[\s\S]*if \(url === fallbackTileUrl\) return;[\s\S]*switchToFallbackTiles\(\);[\s\S]*\}\);/,
  'RacesDetail should switch to fallback tiles when the primary tile layer emits tile errors, while avoiding loops once already on the direct OSM fallback.',
);

assert.match(
  racesDetailSource,
  /tileFallbackTimer = setTimeout\(\(\) => \{[\s\S]*if \(!tileLoadConfirmed && !switchedToFallbackTiles\) \{[\s\S]*activeTileLayer\?\.redraw\?\.\(\);[\s\S]*\}[\s\S]*\},\s*\d+\);/,
  'RacesDetail should retry the same-origin proxy basemap on a short timeout instead of immediately switching to a browser-direct tile source that can leave the stage blank.',
);

assert.match(
  racesDetailSource,
  /layer\.on\('tileload', \(\) => \{[\s\S]*tileLoadConfirmed = true;/,
  'RacesDetail should record successful tile loads so the timeout fallback only fires when the basemap is genuinely blank.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-image-fallback"/,
  'RacesDetail should rely on a real Leaflet tile fallback path instead of reviving the older DOM image fallback layer.',
);

assert.match(
  racesDetailSource,
  /const buildStreetTileFallbackSnapshot = \(map, tileUrlTemplate\) => \{/,
  'RacesDetail should define a real street-tile fallback snapshot builder so the map can still show actual OSM streets when Leaflet tiles fail to paint.',
);

assert.match(
  racesDetailSource,
  /className="race-detail-map-street-fallback"/,
  'RacesDetail should render a dedicated street-tile fallback layer rather than dropping to a pure color map stage.',
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
