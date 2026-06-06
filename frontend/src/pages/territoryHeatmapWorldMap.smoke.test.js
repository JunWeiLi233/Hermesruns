import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/_split/territory.css'), 'utf8');
const externalReferenceNamePattern = new RegExp(['in', 'tv', 'l'].join(''), 'i');

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
  /basemaps\.cartocdn\.com\/rastertiles\/voyager\/\{z\}/,
  'Territory should use labelled street-map tiles so the territory view reads as a real game map with place context.',
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
  /MAP_CHROME_COPY[\s\S]*gameHud:[\s\S]*localBattle:[\s\S]*playerTerritory:[\s\S]*ownedSectors:[\s\S]*campaignTitle:[\s\S]*sectorValue:/,
  'Territory game HUD, campaign panel, and personal territory dock should use bilingual local copy instead of hardcoded text.',
);

assert.match(
  territorySource,
  /className="terr-game-campaign-panel"[\s\S]*className="terr-game-campaign-title"[\s\S]*className="terr-game-campaign-primary"[\s\S]*navigate\('\/today-run'\)[\s\S]*className="terr-game-hud"[\s\S]*className="terr-game-territory-dock"/,
  'Territory should render a neutral campaign-quality game panel with real navigation before the HUD and user-territory dock.',
);

assert.match(
  territorySource,
  /function ownedTerritoryZones\(territory, activeName\)[\s\S]*ownerName === 'you'[\s\S]*controlPct[\s\S]*sampleCount/,
  'Territory should derive the personal sector list from live owned-zone data.',
);

assert.doesNotMatch(
  territorySource,
  /terr-game-leaderboard-drawer|terr-game-drawer-tabs|terr-game-stat-pills/,
  'Territory should not keep the oversized leaderboard drawer after switching to the personal territory dock.',
);

assert.doesNotMatch(
  territorySource,
  externalReferenceNamePattern,
  'Territory script should not reference the external product name in identifiers or copy.',
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
  /const localPolygons = polygonsNearActiveTerritory\(polygons\);[\s\S]*const ownerPolygons = mergeCellMaskPolygonsByOwner\(localPolygons\);/,
  'Territory map should draw authenticated territory plus local-overlapping rival backend polygon masks only.',
);

assert.match(
  territorySource,
  /className: `terr-land-mask-concrete-land\$\{active \? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'\}`[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}`/,
  'Territory map should expose active and rival land layers separately so the owned territory can lead the composition.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container[\s\S]*background: #05070a;[\s\S]*filter: none;/,
  'Territory full-screen map container should use the dark runtime-proof substrate without filtering overlays.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*filter: invert\(1\) hue-rotate\(185deg\) saturate\(0\.78\) brightness\(0\.72\) contrast\(1\.12\);/,
  'Territory full-screen map should use a dark labelled tile treatment behind the ownership overlays.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*mix-blend-mode: normal;/,
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

assert.match(
  styleSource,
  /\.territory-page \.terr-land-mask-concrete-land--active \{[\s\S]*?filter: drop-shadow\(0 0 18px rgba\(240, 117, 97, 0\.38\)\)[\s\S]*?\.territory-page \.terr-land-mask-contour--active \{[\s\S]*?stroke-dasharray: 18 8;[\s\S]*?\.territory-map-only \.terr-game-campaign-panel[\s\S]*width: min\(318px, calc\(100vw - 760px\)\);[\s\S]*\.territory-map-only \.terr-game-campaign-title[\s\S]*font-size: clamp\(1\.55rem, 2\.15vw, 2\.55rem\);[\s\S]*\.territory-map-only \.terr-game-hud[\s\S]*width: min\(350px, calc\(100vw - 132px\)\);[\s\S]*\.territory-map-only \.terr-game-territory-dock[\s\S]*width: min\(356px, calc\(100vw - 132px\)\);/,
  'Territory split CSS should make active owned land the premium surface and reduce surrounding campaign/HUD chrome.',
);

assert.match(
  styleSource,
  /@media \(max-width: 760px\)[\s\S]*\.territory-map-only \.terr-game-campaign-panel[\s\S]*top: 240px;[\s\S]*\.territory-map-only \.terr-map-utility-rail--navigation-only[\s\S]*right: 14px;[\s\S]*width: calc\(100vw - 28px\);[\s\S]*max-width: none;[\s\S]*margin-left: 0;[\s\S]*\.territory-map-only \.terr-game-hud[\s\S]*display: none;[\s\S]*max-height: 22vh;/,
  'Territory mobile layout should keep the owned territory visible first while retaining compact controls without rail overflow.',
);

assert.doesNotMatch(
  styleSource,
  /terr-game-leaderboard-drawer|terr-game-drawer-tabs|terr-game-stat-pills/,
  'Territory split CSS should not keep stale oversized drawer selectors after the dock redesign.',
);

assert.doesNotMatch(
  styleSource,
  externalReferenceNamePattern,
  'Territory split CSS should not reference the external product name.',
);

console.log('[PASS] Territory Heatmap world-map styling guard passed.');
