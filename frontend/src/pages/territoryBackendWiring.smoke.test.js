import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');

assert.match(
  source,
  /const \[mapReady, setMapReady\] = useState\(false\);/,
  'TerritoryMap should track Leaflet readiness so backend data paints after async map creation.',
);

assert.match(
  source,
  /const \{ isAuthenticated, authHydrated \} = useAuth\(\);/,
  'Territory should wait for auth hydration before requesting route and land-mask data.',
);

assert.match(
  source,
  /if \(!authHydrated\) \{\s*return;\s*\}/,
  'Territory should not fall back to demo/no-overlay data before URL token persistence completes.',
);

assert.match(
  source,
  /shouldRefreshTerritoryPolygons\(polygonsData\)/,
  'Territory should poll again when the backend says polygon backfill is still warming so active personal routes do not disappear after mask-version recompute.',
);

assert.match(
  source,
  /window\.setTimeout\(loadTerritoryData, TERRITORY_POLYGON_REFRESH_MS\)/,
  'Territory should schedule a bounded polygon refresh while own-route masks are being regenerated.',
);

assert.match(
  source,
  /setMapReady\(true\);/,
  'TerritoryMap should trigger a repaint once the Leaflet map exists.',
);

assert.match(
  source,
  /preferCanvas: true,/,
  'TerritoryMap should use Canvas rendering for backend land-mask cell overlays.',
);

assert.match(
  source,
  /}\s*, \[\]\);/,
  'TerritoryMap should mount Leaflet once instead of remounting during backend data hydration.',
);

assert.match(
  source,
  /function hasCellMaskPolygon\(poly\)/,
  'Territory should recognize backend land-mask polygon records that provide cells instead of coordinates.',
);

assert.match(
  source,
  /MAX_MASK_CELLS_TO_RENDER/,
  'Territory should throttle large backend land-mask cell collections with concrete tile aggregation.',
);

assert.match(
  source,
  /function aggregateMaskCells\(cells, cellMeters\)/,
  'Territory polygon view should aggregate backend cell masks into concrete land tiles.',
);

assert.match(
  source,
  /const LAND_MASK_TILE_OVERLAP_RATIO = 0\.18;/,
  'Territory should seal tiny visual gaps between adjacent backend land-mask tiles without drawing route highlights.',
);

assert.match(
  source,
  /function sealedMaskTileBounds\(latitude, longitude, tileMeters, cosLat\)/,
  'Territory should expand concrete land tile bounds slightly so diagonal straight territory does not fragment visually.',
);

assert.match(
  source,
  /bounds: sealedMaskTileBounds\(latitude, longitude, tileMeters, cosLat\)/,
  'Territory should use sealed tile bounds at the land-mask cell level instead of smoothing with route polylines.',
);

assert.match(
  source,
  /L\.rectangle\(tile\.bounds,[\s\S]*className: 'terr-land-mask-tile'/,
  'Territory polygon view should render backend cell masks as filled map tiles, not dotted point markers.',
);

assert.match(
  source,
  /fillOpacity: poly\.active \? 0\.9 : 0\.46/,
  'Territory land tiles should be opaque enough to hide distracting background map lines inside conquered land.',
);

assert.match(
  source,
  /MAX_MASK_CELLS_TO_RENDER = 14000/,
  'Territory should render a denser concrete land mask so borders are less pixelized at city scale.',
);

assert.match(
  source,
  /function maskBoundaryLoops\(tiles\)/,
  'Territory should trace continuous land-mask border loops instead of leaving only blocky tile edges.',
);

assert.match(
  source,
  /className: 'terr-land-mask-border'/,
  'Territory should draw a smooth anti-aliased concrete border over backend mask tiles.',
);

assert.match(
  source,
  /function routeTraceLatLngs\(trace\)/,
  'Territory may keep backend route traces for bounds during warmup, but must not paint them as route highlights.',
);

assert.match(
  source,
  /const shouldDrawConcreteBorder = !poly\.active \|\| tiles\.length >= 1500;/,
  'Small active red territory components should not get a heavy border halo that makes them look like map pins.',
);

assert.match(
  source,
  /lineJoin: 'round'/,
  'Territory concrete borders should use rounded joins so the visible edge is not pixelized.',
);

assert.doesNotMatch(
  source,
  /terr-land-route-skin/,
  'Territory should not draw route-skin underlays that show as background route lines inside occupied land.',
);

assert.doesNotMatch(
  source,
  /terr-land-corridor-bridge/,
  'Territory should not draw same-color route corridor bridges because they still read as unnecessary route highlighting.',
);

assert.doesNotMatch(
  source,
  /territoryCorridorWeightPx/,
  'Territory should not derive route polyline widths for land continuity; continuity must come from the concrete land mask.',
);

assert.doesNotMatch(
  source,
  /L\.polyline\(points,/,
  'Territory should not paint backend route traces as polylines on the land-first map.',
);

assert.doesNotMatch(
  source,
  /opacity: poly\.active \? 0\.14 : 0\.1/,
  'Territory should not keep the old subtle route skin opacity layer under active land.',
);

assert.doesNotMatch(
  source,
  /terr-personal-route-centerline/,
  'Territory should not draw the bright personal route highlight over conquered land.',
);

assert.doesNotMatch(
  source,
  /routeTraceCenterlineWeightPx/,
  'Territory should not keep a separate centerline highlighter once the map is land-first.',
);

assert.doesNotMatch(
  source,
  /#fff4e6/,
  'Territory should not paint a white route highlight over active land masks.',
);

assert.doesNotMatch(
  source,
  /terr-land-route-core/,
  'Territory should not draw a bright route-core overlay over concrete land masks.',
);

assert.doesNotMatch(
  source,
  /L\.circleMarker\(coord,/,
  'Territory concrete land should no longer render as dotted circle markers.',
);

assert.match(
  source,
  /\[territory, filter, leaderboard, mapReady, showPolygons\]/,
  'Zone layer effect should repaint after mapReady flips true and clear itself when concrete land masks are shown.',
);

assert.match(
  source,
  /\[polygons, showPolygons, mapReady, recenterSignal\]/,
  'Polygon layer effect should repaint after mapReady flips true and when the title-strip recenter action fires.',
);

console.log('[PASS] Territory backend wiring guard passed.');
