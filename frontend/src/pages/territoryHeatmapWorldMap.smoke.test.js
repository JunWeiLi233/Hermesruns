import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  territorySource,
  /territory-page territory-heatmap-outline territory-map-only runner-dashboard-page/,
  'Territory should opt into the Heatmap-style full-world-map shell.',
);

assert.match(
  territorySource,
  /className:\s*'territory-real-world-tile'/,
  'Territory Leaflet tiles should be explicitly marked as real-world map tiles.',
);

assert.match(
  territorySource,
  /basemaps\.cartocdn\.com\/rastertiles\/voyager_nolabels/,
  'Territory should use a grayable street-map basemap so unclaimed land remains visible instead of becoming dark map voids.',
);

assert.doesNotMatch(
  territorySource,
  /basemaps\.cartocdn\.com\/dark_all/,
  'Territory should not use CARTO dark_all because it creates black areas that read as broken territory borders.',
);

assert.match(
  territorySource,
  /territory-map-only/,
  'Territory should opt into the map-only shell when the page is meant to show only land.',
);

assert.match(
  territorySource,
  /className="terr-map-utility-rail terr-map-utility-rail--navigation-only"/,
  'Territory map-only view should keep only the compact navigation rail over the land map.',
);

assert.match(
  territorySource,
  /className="terr-map-topbar terr-map-titlebar"/,
  'Territory should keep the Heatmap-style title strip over the land map.',
);

assert.match(
  territorySource,
  /MAP_CHROME_COPY[\s\S]*recenter:[\s\S]*viewRuns:[\s\S]*settings:/,
  'Territory title strip should include bilingual labels for recenter, runs, and settings.',
);

assert.match(
  territorySource,
  /navItems\.map\(\(item\) => \([\s\S]*<button[\s\S]*onClick=\{\(\) => navigate\(item\.route\)\}/,
  'Territory navigation buttons should be route buttons backed by the shared runner nav model.',
);

assert.doesNotMatch(
  territorySource,
  /terr-overlay-filters|terr-overlay-legend|terr-below-grid|terr-pill--view-toggle/,
  'Territory map-only view should not render filters, legends, or secondary panels.',
);

assert.match(
  territorySource,
  /showPolygons[\s\S]*recenterSignal=\{recenterSignal\}/,
  'Territory map-only view should force the concrete backend land masks and preserve the recenter title action.',
);

assert.doesNotMatch(
  territorySource,
  /<section className="terr-brief"/,
  'Territory should not render the obsolete terr-brief overlay on the full-screen world map.',
);

assert.doesNotMatch(
  territorySource,
  /DEMO_TERRITORY|Oakland Hills|Kai Chen|Mia Torres|Bay Farm Island|mode:\s*'demo'/,
  'Territory should not ship the old demo/test territory fixture at the beginning of the page.',
);

assert.match(
  territorySource,
  /const EMPTY_TERRITORY = \{[\s\S]*center: null,[\s\S]*leaderboard: \[\],[\s\S]*territories: \[\],[\s\S]*zones: \[\],/,
  'Territory should fall back to an empty shell without a placeholder test location when backend territory data is unavailable.',
);

assert.match(
  territorySource,
  /const territoryCenter = isValidMapCenter\(territory\?\.center\) \? territory\.center : null;[\s\S]*if \(!territoryCenter\) return;[\s\S]*const center = territoryCenter;/,
  'Territory map should mount directly from the authenticated backend territory center instead of a first-location test fallback.',
);

assert.match(
  territorySource,
  /\{center \? formatCenterLabel\(center\) : tc\('loadingTerritory'\)\}/,
  'Territory header should not format a fake coordinate while the authenticated territory center is still loading.',
);

assert.doesNotMatch(
  territorySource,
  /runnerMarkerPositions|L\.marker\(|terr-marker|L\.divIcon\(/,
  'Territory map should not render runner point markers over the concrete territory land layer.',
);

assert.doesNotMatch(
  territorySource,
  /fallbackZoneMaskPolygons|visibleCells|zoneCellCenter|zoneCellMeters/,
  'Territory map should not render broad fallback territory blobs from coarse zone cells.',
);

assert.match(
  territorySource,
  /const activePolygons = polygons\.filter\(\(poly\) => poly\?\.active === true\);[\s\S]*const ownerPolygons = mergeCellMaskPolygonsByOwner\(activePolygons\);/,
  'Territory map should draw the real authenticated user territory from backend polygon masks only.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container[\s\S]*background: #252b2d;[\s\S]*filter: none;/,
  'Territory full-screen map container should not filter territory overlays while the basemap is styled separately.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.territory-real-world-tile,[\s\S]*filter: saturate\(0\.56\) contrast\(1\.22\) brightness\(0\.46\);/,
  'Territory full-screen map should gray the real-world tiles under unclaimed land instead of creating black border gaps or washing out territory overlays.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.territory-real-world-tile,[\s\S]*mix-blend-mode: normal;/,
  'Territory real-world tiles should remain visible rather than being washed out by blend effects.',
);

assert.match(
  styleSource,
  /Territory full-bleed guard[\s\S]*\.territory-page\.territory-heatmap-outline\.runner-shell-page \.runner-shell-main,[\s\S]*margin: 0 !important;/,
  'Territory full-screen map should not inherit the hidden runner sidebar gutter.',
);

assert.match(
  styleSource,
  /\.territory-map-only \.leaflet-control-container[\s\S]*display: none !important;/,
  'Territory map-only view should suppress Leaflet chrome so only the land map remains.',
);

assert.match(
  styleSource,
  /\.territory-map-only \.terr-map-utility-rail--navigation-only[\s\S]*display: grid !important;/,
  'Territory map-only view should explicitly preserve the necessary navigation rail.',
);

assert.match(
  styleSource,
  /\.territory-map-only \.terr-map-titlebar[\s\S]*display: grid !important;/,
  'Territory map-only view should explicitly preserve the title/action strip.',
);

console.log('[PASS] Territory Heatmap world-map styling guard passed.');
