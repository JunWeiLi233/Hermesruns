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
  /basemaps\.cartocdn\.com\/dark_all\/\{z\}/,
  'Territory should use the same dark real-world tile family as Heatmap so ownership color stays readable over the map.',
);

assert.doesNotMatch(
  territorySource,
  /basemaps\.cartocdn\.com\/rastertiles\/voyager/,
  'Territory should not use Voyager tiles because the light street-map treatment competes with territory ownership color.',
);

assert.match(
  territorySource,
  /territory-map-only/,
  'Territory should opt into the map-only shell when the page is meant to show only land.',
);

assert.match(
  territorySource,
  /className="terr-map-utility-rail terr-map-utility-rail--navigation-only"/,
  'Territory keeps the legacy route-button rail mounted so navigation actions remain wired even when map-only CSS hides the old chrome.',
);

assert.match(
  territorySource,
  /className="terr-map-topbar terr-map-titlebar"/,
  'Territory keeps the legacy title strip mounted so recenter and route actions remain wired even when map-only CSS hides the old chrome.',
);

assert.match(
  territorySource,
  /MAP_CHROME_COPY[\s\S]*recenter:[\s\S]*viewRuns:[\s\S]*settings:/,
  'Territory title strip should include bilingual labels for recenter, runs, and settings.',
);

assert.match(
  territorySource,
  /MAP_CHROME_COPY[\s\S]*loadingKicker:[\s\S]*ownTerritory:[\s\S]*globalTerritory:[\s\S]*ownerInfoTitle:/,
  'Territory loading state, scope switch, and owner inspector should use bilingual local copy instead of hardcoded text.',
);

assert.doesNotMatch(
  territorySource,
  /terr-game-campaign-panel|terr-game-campaign-title|terr-game-campaign-primary|terr-game-campaign-actions|terr-game-campaign-strip/,
  'Territory should not render the removed campaign panel overlay on top of the map.',
);

assert.match(
  territorySource,
  /<TerritoryOwnerInfoPanel[\s\S]*<TerritoryScopeSwitch/,
  'Territory should keep the website owner inspector and two-button scope switch without the old campaign overlay.',
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
  /terr-game-bottom-nav|terr-game-side-actions|terr-game-dock-tabs/,
  'Territory should not add phone-app bottom navigation, side action bubbles, or mobile sheet tabs.',
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

assert.doesNotMatch(
  territorySource,
  /bindTooltip\(|permanent:\s*true|terr-zone-label/,
  'Territory should not restore overlap-prone permanent Leaflet zone labels over dense real data.',
);

assert.doesNotMatch(
  styleSource,
  /terr-zone-label/,
  'Territory split CSS should not keep styles for removed permanent zone labels.',
);

assert.match(
  territorySource,
  /const ownerPolygons = renderCellMaskPolygonsBySource\(polygons\);/,
  'Territory map should preserve every returned backend activity mask as a source before owner-level paint union.',
);

assert.doesNotMatch(
  territorySource,
  /LAND_MASK_FIELD_|territoryFieldRegions|paintTerritoryFieldRegions|terr-land-mask-territory-field|blockNotchedPlateLoop|districtPlateBounds|maskTileGridQuantileBounds|componentPlateLoops|quantileSorted/,
  'Territory should not generate fake INTVL district plates; the displayed territory must come from real concrete owned land.',
);

assert.doesNotMatch(
  territorySource,
  /fieldRegions:/,
  'Territory render entries should not carry synthetic field regions separate from concrete land regions.',
);

assert.match(
  territorySource,
  /const renderPolygons = selectedOwnerKeyValue[\s\S]*?const renderGrid = territoryMaskRenderGrid\(renderPolygons\);[\s\S]*?const sourceRenderEntries = resolveMaskTileOwnership\(renderPolygons, renderGrid\)\.slice\(\)\.reverse\(\);[\s\S]*?const renderEntries = mergeResolvedMaskEntriesByOwner\(sourceRenderEntries, renderGrid\);[\s\S]*?const globalOccupied = new Set\(\);[\s\S]*?renderEntries\.forEach\(\(\{ tiles \}\) => \{[\s\S]*?globalOccupied\.add\(maskTileClaimKey\(tile\)\);[\s\S]*?const componentRecords = visibleMaskConnectedComponents\(maskTileConnectedComponents\(tiles\)[\s\S]*?options: \{ largeLandmass, routeCorridor, preserveAll: active \}[\s\S]*?const exactRegionGroups = componentRecords\.map\(\(record\) => record\.regions\);[\s\S]*?const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?\);[\s\S]*?const concreteLandRegions = visibleMaskStrokeRegions\(concreteLandRegionGroups\.flat\(\), \{ cosLat \}\);[\s\S]*?const concreteContourRegions = concreteLandRegions;[\s\S]*?landRegions: concreteLandRegions,[\s\S]*?landRegionGroups: concreteLandRegionGroups,[\s\S]*?contourRegions: concreteContourRegions[\s\S]*?const rivalEntries = contourRenderEntries\.filter\(\(entry\) => !entry\.active\);[\s\S]*?const activeEntries = contourRenderEntries\.filter\(\(entry\) => entry\.active\);[\s\S]*?paintLandRegions\(rivalEntries, renderers\.rivalFill\);[\s\S]*?paintContourRegions\(rivalEntries, renderers\.rivalContour\);[\s\S]*?paintLandRegions\(activeEntries, renderers\.activeFill\);[\s\S]*?paintContourRegions\(activeEntries, renderers\.activeContour\);/,
  'Territory should route-repair concrete owned land per backend activity source, seam-clean by owner, then use component-level grouped regions for fill and border.',
);

assert.match(
  territorySource,
  /function routeTraceConcreteMaxSegmentMeters\(renderGrid = \{\}\)[\s\S]*?LAND_MASK_ROUTE_TRACE_MAX_SEGMENT_RATIO[\s\S]*?function routeTraceSegments\(poly, renderGrid = \{\}, options = \{\}\)[\s\S]*?gridSegmentLengthMeters\(segment, tileMeters\) > maxSegmentMeters[\s\S]*?function routeSegmentSpatialIndex\(segments, thresholdMeters, tileMeters\)[\s\S]*?function routeSegmentCandidatesForTile\(tile, segments, segmentIndex\)[\s\S]*?function consistentMaskTiles\(poly, renderGrid, concreteTiles\)[\s\S]*?const segments = routeTraceSegments\(poly, renderGrid, \{ maxSegmentMeters \}\);[\s\S]*?const routeTiles = routeTraceUniformTiles\(poly, renderGrid, concreteTiles, segments\);[\s\S]*?const interiorDistanceMeters = sourceCellMeters \* LAND_MASK_ROUTE_INTERIOR_DISTANCE_RATIO;[\s\S]*?const segmentIndex = routeSegmentSpatialIndex\(segments, interiorDistanceMeters, tileMeters\);[\s\S]*?const candidateSegments = routeSegmentCandidatesForTile\(tile, segments, segmentIndex\);[\s\S]*?if \(!poly\?\.active && tileIsNearRouteSegments\(tile, candidateSegments, interiorDistanceMeters, tileMeters\)\) return;[\s\S]*?return repairConsistentMaskTiles\(Array\.from\(tilesByKey\.values\(\)\), renderGrid, repairOptions\);/,
  'Territory should preserve exact bounded route-trace repair while active source masks retain every backend concrete cell and segment candidates stay spatially indexed.',
);

assert.doesNotMatch(
  territorySource,
  /fastRender|coalescedCellMaskPolygonsForRender|TERRITORY_OWNER_SOURCE_COALESCE_THRESHOLD/,
  'Territory should not restore the coalesced fast-render shortcut that fills unclosed park runs as fake land.',
);

assert.match(
  territorySource,
  /const rivalEntries|paintLandRegions\(rivalEntries|paintContourRegions\(rivalEntries/,
  'Territory map should paint other returned owners because the map is global.',
);

assert.match(
  territorySource,
  /className: `terr-land-mask-concrete-land\$\{active \? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-concrete-land'\)\}`[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-contour'\)\}`/,
  'Territory map should expose active and rival land layers separately so the owned territory can lead the composition.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container[\s\S]*background: #05070a;[\s\S]*filter: none;/,
  'Territory full-screen map container should use the dark runtime-proof substrate without filtering overlays.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*opacity: 1 !important;[\s\S]*filter: none !important;/,
  'Territory full-screen map should keep real-world Leaflet tiles sharp behind the ownership overlays.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*mix-blend-mode: normal;/,
  'Territory real-world tiles should remain visible rather than being washed out by blend effects.',
);

assert.doesNotMatch(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*?\.territory-heatmap-outline \.terr-map-section::after[\s\S]*?filter:\s*saturate\(0\.9\) contrast\(1\.16\) brightness\(0\.84\);/,
  'Territory real-world tiles should not be softened or dimmed with color-processing filters.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.terr-map-section::after \{[\s\S]*?content: none;[\s\S]*?display: none;[\s\S]*?background: none;/,
  'Territory map-only view should not render the stale full-map pseudo overlay above the real world map.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline\.territory-map-only \.terr-map-section::after,[\s\S]*?\.territory-heatmap-outline\.territory-map-only \.territory-map-section::after \{[\s\S]*?content: none !important;[\s\S]*?display: none !important;[\s\S]*?background: none !important;/,
  'Territory map-only view should explicitly suppress pseudo overlay layers that can look like extra territory.',
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
  /\.territory-map-only \.terr-map-titlebar[\s\S]*display: grid !important;/,
  'Territory map-only view should remain a website map and preserve the title/action strip.',
);

assert.match(
  styleSource,
  /\.territory-page \.terr-land-mask-concrete-land--active \{[\s\S]*?filter: none;[\s\S]*?fill: var\(--terr-active-color, #f07561\) !important;[\s\S]*?fill-opacity: 0\.72 !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--active \{[\s\S]*?filter: none;[\s\S]*?stroke: rgba\(255, 158, 132, 0\.86\) !important;/,
  'Territory split CSS should render Hermes Shared Account as one crisp coral map plate without changing page chrome.',
);

assert.doesNotMatch(
  styleSource,
  /terr-leaflet-territory-pane--active-fill \.terr-land-mask-concrete-land--active:nth-of-type/,
  'Territory split CSS should not palette-cycle one active Hermes account into multiple owner colors.',
);

assert.doesNotMatch(
  styleSource,
  /terr-land-mask-territory-field/,
  'Territory split CSS should not style synthetic field plates because the visible territory must be real concrete land.',
);

assert.doesNotMatch(
  styleSource,
  /--terr-phone-width|--terr-phone-height|territory-canvas::before|territory-canvas::after|terr-game-bottom-nav|terr-game-side-actions|terr-game-dock-tabs|width: min\(520px, calc\(100vw - 36px\)\)|width: calc\(100vw - 24px\)/,
  'Territory should not force a portrait phone-stage frame or mobile-app bottom sheet chrome.',
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
