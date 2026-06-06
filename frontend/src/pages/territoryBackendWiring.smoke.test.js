import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const territoryCss = readFileSync(path.join(here, '..', 'styles', '_split', 'territory.css'), 'utf8');
const runtimeVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-border-runtime.mjs'), 'utf8');
const liveProofCommandSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'territory-live-proof-command.mjs'), 'utf8');
const externalReferenceNamePattern = new RegExp(`function ${['in', 'tv', 'l'].join('')}BorderColor|hexColorToRgb|rgbToHsl|hslToHexColor`);
const externalReferenceLiteralPattern = new RegExp(['in', 'tv', 'l'].join(''), 'i');

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
  /function loadTerritoryShellData\(\)/,
  'Territory should load shell/profile/summary data separately so the first map paint is not blocked by heavy polygon masks.',
);

assert.match(
  source,
  /const TERRITORY_POLYGON_INITIAL_DELAY_MS = 120;/,
  'Territory should yield the first map paint before starting heavy land-mask polygon loading.',
);

assert.match(
  source,
  /function scheduleInitialPolygonLoad\(\)/,
  'Territory should schedule the initial polygon load instead of starting it in the same task as shell data loading.',
);

assert.match(
  source,
  /function loadTerritoryPolygons\(\)/,
  'Territory should load heavy land-mask polygons through a separate async path.',
);

assert.match(
  source,
  /window\.setTimeout\(loadTerritoryPolygons, TERRITORY_POLYGON_REFRESH_MS\)/,
  'Territory should schedule bounded polygon-only refreshes while own-route masks are being regenerated.',
);

assert.doesNotMatch(
  source,
  /const \[profileData, territoryData, polygonsData\] = await Promise\.all/,
  'Territory should not include /api/territory/polygons in the first shell Promise.all because it can delay the whole page load.',
);

assert.doesNotMatch(
  source,
  /loadTerritoryShellData\(\);\s*loadTerritoryPolygons\(\);/,
  'Territory should not start the heavy polygon request immediately beside the shell request.',
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
  /let mountedMapContainer = null;[\s\S]*?mountedMapContainer = mapContainer;[\s\S]*?Object\.defineProperty\(mapContainer, '__hermesTerritoryMap'[\s\S]*?enumerable: false,[\s\S]*?value: map,[\s\S]*?const mapContainer = mountedMapContainer;[\s\S]*?delete mapContainer\.__hermesTerritoryMap/,
  'Territory should expose a non-enumerable map handle for browser proof tooling and clean it up on unmount.',
);

assert.match(
  source,
  /const TERRITORY_LAYER_PANES = \[[\s\S]*?'territory-rival-fill-pane'[\s\S]*?'territory-rival-contour-pane'[\s\S]*?'territory-active-fill-pane'[\s\S]*?'territory-active-contour-pane'[\s\S]*?\];[\s\S]*?function territoryLayerRenderers\(L, map\)[\s\S]*?L\.svg\(\{ padding: 0\.65, pane: 'territory-rival-fill-pane' \}\)[\s\S]*?L\.svg\(\{ padding: 0\.65, pane: 'territory-active-contour-pane' \}\)/,
  'Territory should route concrete fill and contour layers through explicit SVG panes so ownership layers cannot render out of order.',
);

assert.match(
  source,
  /const territoryCenter = isValidMapCenter\(territory\?\.center\) \? territory\.center : null;[\s\S]*?if \(!mapRef\.current \|\| mapInstanceRef\.current\) return;[\s\S]*?if \(!territoryCenter\) return;[\s\S]*?}\s*, \[territoryCenter\?\.latitude, territoryCenter\?\.longitude, territoryCenter\?\.zoom\]\);/,
  'TerritoryMap should wait for a real backend territory center and still avoid remounting once the Leaflet map exists.',
);

assert.match(
  source,
  /function hasCellMaskPolygon\(poly\)/,
  'Territory should recognize backend land-mask polygon records that provide cells instead of coordinates.',
);

assert.match(
  source,
  /function polygonOwnerMergeKey\(poly, fallbackIndex\)/,
  'Territory should derive a stable owner merge key so same-user land-mask rows do not render as separate territories.',
);

assert.match(
  source,
  /function mergeCellMaskPolygonsByOwner\(polygons\)/,
  'Territory should merge backend cell-mask polygons by owner before tracing visible regions.',
);

assert.match(
  source,
  /function territoryMaskRenderGrid\(polygons\)/,
  'Territory should use one shared cell-mask render grid so neighboring owner boundaries do not drift into each other.',
);

assert.match(
  source,
  /const localPolygons = polygonsNearActiveTerritory\(polygons\);[\s\S]*?const ownerPolygons = mergeCellMaskPolygonsByOwner\(localPolygons\);[\s\S]*?const renderGrid = territoryMaskRenderGrid\(ownerPolygons\);[\s\S]*?const renderEntries = resolveMaskTileOwnership\(ownerPolygons, renderGrid\)\.slice\(\)\.reverse\(\);/,
  'Territory should render active plus local-overlapping rival masks so mock competitors appear without pulling distant global territories into the current viewport.',
);

assert.doesNotMatch(
  source,
  /const activePolygons = polygons\.filter\(\(poly\) => poly\?\.active === true\);/,
  'Territory should not drop rival backend masks before the owner merge/render pipeline.',
);

assert.match(
  source,
  /function polygonsNearActiveTerritory\(polygons\)[\s\S]*?poly\?\.active === true \|\| boundsOverlap\(polygonRenderBounds\(poly\), activeBounds\)/,
  'Territory should keep local rival masks that overlap the active territory while filtering distant mock territories.',
);

assert.doesNotMatch(
  source,
  /mergedPolygons\.sort\(\(a, b\) => Number\(Boolean\(b\?\.active\)\) - Number\(Boolean\(a\?\.active\)\)\)/,
  'Territory should not sort active/self masks ahead of rivals because that can paint older rival land above newer active land.',
);

assert.match(
  source,
  /MAX_MASK_CELLS_TO_RENDER/,
  'Territory should throttle large backend land-mask cell collections with concrete tile aggregation.',
);

assert.match(
  source,
  /const LAND_MASK_RENDER_SUBDIVISION = 3;[\s\S]*?const LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR = 9;/,
  'Territory should preserve an adaptive sub-cell render grid so concrete land borders can become smoother without unbounded tile growth.',
);

assert.match(
  source,
  /const canSubdivide = totalCellCount > 0[\s\S]*?totalCellCount \* LAND_MASK_SUBDIVIDED_CELL_TILE_FACTOR <= MAX_MASK_CELLS_TO_RENDER[\s\S]*?1 \/ LAND_MASK_RENDER_SUBDIVISION/,
  'Territory should only render finer concrete territory cells when the mask remains inside the frontend render budget.',
);

assert.match(
  source,
  /sourceCellMeters: baseCellMeters,[\s\S]*?tileMeters: baseCellMeters \* bucketScale/,
  'Territory should remember the original backend source-cell size when it renders a finer grid.',
);

assert.match(
  source,
  /function aggregateMaskCells\(cells, cellMeters, renderGrid = \{\}\)/,
  'Territory polygon view should aggregate backend cell masks into concrete land tiles.',
);

assert.match(
  source,
  /const LAND_MASK_SOURCE_BRUSH_RADIUS_RATIO = 1\.45;[\s\S]*?const sourceRadiusMeters = tileMeters < baseCellMeters \? baseCellMeters \* LAND_MASK_SOURCE_BRUSH_RADIUS_RATIO : 0;[\s\S]*?distanceMeters > sourceRadiusMeters[\s\S]*?continue;/,
  'Territory should brush source mask cells into the finer concrete grid with enough radius that sparse GPS samples become continuous land.',
);

assert.match(
  source,
  /const contourBaseMeters = Math\.max\([\s\S]*?tileMeters[\s\S]*?sourceCellMeters[\s\S]*?\);[\s\S]*?const simplifyToleranceMeters = contourBaseMeters[\s\S]*?const cornerRadiusMeters = contourBaseMeters/,
  'Territory should smooth sub-cell concrete borders from source-cell scale so finer fills do not turn into noisy micro-stairs.',
);

assert.match(
  source,
  /function resolveMaskTileOwnership\(polygons, renderGrid\)/,
  'Territory should remove render-tile conflicts from older owners before Leaflet polygons are traced.',
);

assert.match(
  source,
  /aggregateMaskCells\(poly\.cells, poly\.cellMeters, renderGrid\)/,
  'Territory should aggregate every owner onto the same frontend grid so latest-owner boundaries do not blend with older land.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_ROUTE_RADIUS_FALLBACK_METERS|LAND_MASK_ROUTE_MIN_RADIUS_RATIO|function routeTraceLandMaskTiles/,
  'Territory should not brush route traces into extra frontend land because that turns concrete game territory into oversized blobs.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONCRETE_SEAM_CLAIM_RADIUS_TILES|function expandConcreteMaskTiles|function maskTileAtGrid/,
  'Territory should not keep seam-expansion helpers because those tile buffers appear as pixelated ownership bands.',
);

assert.match(
  source,
  /const concreteTiles = aggregateMaskCells\(poly\.cells, poly\.cellMeters, renderGrid\);[\s\S]*?concreteTiles\.forEach[\s\S]*?claimedTiles\.has\(key\)/,
  'Territory visible land should come directly from backend concrete mask cells, then participate in latest-wins tile ownership resolution.',
);

assert.match(
  source,
  /claimedTiles\.has\(key\)[\s\S]*?claimedTiles\.add\(key\)/,
  'Territory should let the first/latest owner claim a shared render tile and block older owners from drawing it.',
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
  /bounds: sealedMaskTileBounds\(latitude, longitude, tileMeters, renderCosLat\)/,
  'Territory should use sealed tile bounds at the land-mask cell level instead of smoothing with route polylines.',
);

assert.match(
  source,
  /function smoothMaskBoundaryLoop\(loop/,
  'Territory should smooth backend land-mask boundaries before rendering so claimed land no longer reads as square pixels.',
);

assert.match(
  source,
  /const LAND_MASK_CONTOUR_SIMPLIFY_RATIO = 12;/,
  'Territory should simplify beyond fine sub-cell stair noise before rounding so concrete borders avoid pixelated edges.',
);

assert.match(
  source,
  /function simplifyClosedMaskLoop\(points, toleranceMeters, cosLat\)/,
  'Territory should simplify closed mask loops before corner rounding so borders are continuous territory contours.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_RELAXATION_PASSES|function relaxClosedMaskLoop|relaxClosedMaskLoop\(/,
  'Territory should not relax land-mask loops because relaxation can move a border across a newer owner cell and create visible conflict bands.',
);

assert.match(
  source,
  /const LAND_MASK_SMOOTHING_PASSES = 8;/,
  'Territory should use enough boundary smoothing passes for reference-style continuous territory borders.',
);

assert.match(
  source,
  /const LAND_MASK_CURVE_PASSES = 3;[\s\S]*?function curveClosedMaskLoop\(points, passes\)[\s\S]*?interpolateMaskPoint\(current, following, 0\.25\)[\s\S]*?interpolateMaskPoint\(current, following, 0\.75\)[\s\S]*?curveClosedMaskLoop\(smoothed, curvePasses\)/,
  'Territory final contours should run through limited straight subdivision after corner rounding; cardinal splines are banned because they distorted ownership geometry in visual proof.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_SPLINE_TENSION|clampMaskSplinePoint|tangentScale|h00|h10|h01|h11/,
  'Territory should not use cardinal spline sampling until it can prove no self-crossing or cross-owner distortion on live territory geometry.',
);

assert.match(
  source,
  /const LAND_MASK_SMALL_LOOP_POINT_LIMIT = 44;[\s\S]*?const LAND_MASK_TINY_LOOP_POINT_LIMIT = 24;/,
  'Territory should classify tiny and small land-mask loops so narrow claims do not smooth into round bubbles.',
);

assert.match(
  source,
  /const LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP = 3600;/,
  'Territory should cap generated boundary vertices so smoother regions do not create a frontend rendering regression.',
);

assert.match(
  source,
  /function maskSmoothingPassCount\(pointCount, requestedPasses\)[\s\S]*?pointCount <= LAND_MASK_TINY_LOOP_POINT_LIMIT[\s\S]*?Math\.min\(effectivePasses, 2\)[\s\S]*?pointCount <= LAND_MASK_SMALL_LOOP_POINT_LIMIT[\s\S]*?Math\.min\(effectivePasses, 3\)[\s\S]*?pointCount \* \(3 \*\* effectivePasses\) > LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP/,
  'Territory should adapt smoothing pass count to boundary size instead of rounding small masks into blobs.',
);

assert.match(
  source,
  /const contourSimplifyRatio = open\.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT[\s\S]*?LAND_MASK_CONTOUR_SIMPLIFY_RATIO \* 0\.45[\s\S]*?open\.length <= LAND_MASK_SMALL_LOOP_POINT_LIMIT[\s\S]*?LAND_MASK_CONTOUR_SIMPLIFY_RATIO \* 0\.7/,
  'Territory should simplify small loops less aggressively so the border stays map-shaped instead of circular.',
);

assert.match(
  source,
  /const LAND_MASK_CORNER_RADIUS_RATIO = 18;/,
  'Territory rounded-corner contours should soften cell stair-steps into broader reference-like territory edges without adding halo or synthetic bridge geometry.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_STAIR_STEP_PRUNE_RATIO|pruneTinyStairStepCorners/,
  'Territory should not keep the tiny stair-step prune path because proof showed it did not improve the rendered border.',
);

assert.match(
  source,
  /const LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS = 10;/,
  'Territory should keep tiny isolated mask islands out of the dominant neon contour layer.',
);

assert.match(
  source,
  /const LAND_MASK_MIN_VISIBLE_COMPACTNESS = 0\.032;/,
  'Territory should keep narrow but real claimed corridors visible instead of filtering them into empty map gaps.',
);

assert.match(
  source,
  /const LAND_MASK_MAX_VISIBLE_ASPECT_RATIO = 8;/,
  'Territory should allow elongated real territory components to draw concrete fill and one border like the reference.',
);

assert.match(
  source,
  /const LAND_MASK_CONTOUR_PRUNE_PASSES = 2;[\s\S]*?const LAND_MASK_CONTOUR_PRUNE_MIN_NEIGHBORS = 3;[\s\S]*?const LAND_MASK_CONTOUR_CORE_MIN_NEIGHBORS = 4;/,
  'Territory should prune attached skinny corridors from the dominant visual contour while preserving exact ownership layers.',
);

assert.match(
  source,
  /const LAND_MASK_LARGE_COMPONENT_MIN_TILES = 40;/,
  'Territory should treat large connected land components differently from small noisy components without collapsing them into owner-wide hulls.',
);

assert.match(
  source,
  /function pruneMaskContourTiles\(tiles\)[\s\S]*?neighborCount >= LAND_MASK_CONTOUR_PRUNE_MIN_NEIGHBORS[\s\S]*?const coreKeys = new Set\(\);[\s\S]*?neighborCount >= LAND_MASK_CONTOUR_CORE_MIN_NEIGHBORS[\s\S]*?const openedKeys = new Set\(coreKeys\)[\s\S]*?return Array\.from\(activeKeys\)/,
  'Territory should remove low-neighbor visual contour tiles and run a core/opening pass before tracing the reference-style border.',
);

assert.match(
  source,
  /function maskLoopCompactness\(points, cosLat\)[\s\S]*?maskLoopAreaMetersSquared\(points, cosLat\)[\s\S]*?maskLoopPerimeterMeters\(points, cosLat\)[\s\S]*?\(4 \* Math\.PI \* area\) \/ \(perimeter \* perimeter\)/,
  'Territory should measure visual-loop compactness before promoting backend mask geometry into the reference-style contour layer.',
);

assert.match(
  source,
  /function maskLoopAspectRatio\(points, cosLat\)[\s\S]*?const shortest = Math\.min\(width, height\)[\s\S]*?return longest \/ shortest;/,
  'Territory should measure visual-loop aspect ratio so long rectangular route strips stay below the dominant territory border.',
);

assert.match(
  source,
  /function maskTileConnectedComponents\(tiles\)[\s\S]*?const remainingKeys = new Set\(tilesByKey\.keys\(\)\);[\s\S]*?neighborKeys\(tile\)\.forEach\(\(neighborKey\) => \{[\s\S]*?components\.push\(component\);[\s\S]*?return components;/,
  'Territory should split each owner mask into connected components so distant land cannot collapse into a world-spanning rectangle.',
);

assert.match(
  source,
  /function visualMaskRegions\(tiles, options = \{\}\)[\s\S]*?maskTileConnectedComponents\(tiles\)\.flatMap[\s\S]*?const contourComponent = component\.length >= LAND_MASK_LARGE_COMPONENT_MIN_TILES[\s\S]*?\? component[\s\S]*?: pruneMaskContourTiles\(component\);[\s\S]*?const componentRegions = maskBoundaryLoops\(contourComponent, options\)[\s\S]*?visibleMaskContourRegions\(componentRegions, options\)/,
  'Territory should preserve complete visual coverage for large latest-wins connected components, using pruning only as a small-component fallback to avoid black seam voids.',
);

assert.doesNotMatch(
  source,
  /expandedMaskCoverageEntries|LAND_MASK_COVERAGE_EXPANSION_RADIUS|coverageTilesByEntry|coverageOwnerByKey|visualMaskHullRegion|maskConvexHullVertices|maskTileCornerVertices|maskCrossProduct/,
  'Territory should not use expanded coverage or convex hulls for visible borders because they create geometric covers instead of real territory outlines.',
);

assert.match(
  source,
  /function quadraticMaskPoint\(start, control, end, fraction\)[\s\S]*?function roundClosedMaskLoopCorners\(points, radiusMeters, cosLat, passes\)[\s\S]*?const cornerDistance = Math\.min\(radiusMeters, previousDistance \* 0\.49, nextDistance \* 0\.49\)[\s\S]*?const chordMidpoint = interpolateMaskPoint\(approach, leave, 0\.5\)[\s\S]*?const arcControl = interpolateMaskPoint\(current, chordMidpoint, 0\.82\)[\s\S]*?quadraticMaskPoint\(approach, arcControl, leave, 0\.17\)[\s\S]*?quadraticMaskPoint\(approach, arcControl, leave, 0\.33\)[\s\S]*?quadraticMaskPoint\(approach, arcControl, leave, 0\.5\)[\s\S]*?quadraticMaskPoint\(approach, arcControl, leave, 0\.67\)[\s\S]*?quadraticMaskPoint\(approach, arcControl, leave, 0\.83\)/,
  'Territory should round mask-loop corners with local quadratic arcs that cut hard cell corners without global spline distortion.',
);

assert.doesNotMatch(
  source,
  /current\[0\] \* 0\.75 \+ following\[0\] \* 0\.25|current\[0\] \* 0\.25 \+ following\[0\] \* 0\.75/,
  'Territory should not use global Chaikin shrink smoothing because it can over-round narrow claims and open conflict gaps.',
);

assert.match(
  source,
  /function visibleMaskContourRegions\(exactRegions, options = \{\}\)[\s\S]*?loop\.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS[\s\S]*?maskLoopCompactness\(loop, cosLat\) >= LAND_MASK_MIN_VISIBLE_COMPACTNESS[\s\S]*?maskLoopAspectRatio\(loop, cosLat\) <= LAND_MASK_MAX_VISIBLE_ASPECT_RATIO[\s\S]*?smoothMaskBoundaryLoop\(loop, options\)/,
  'Territory should render visible-size compact backend mask contours without painting pixel-like surface fills.',
);

assert.match(
  source,
  /function maskBoundaryLoops\(tiles, options = \{\}\)/,
  'Territory should trace the real backend land-mask tiles without adding synthetic same-owner bridge corridors.',
);

assert.match(
  source,
  /const exactRegions = maskTileConnectedComponents\(tiles\)\.flatMap\(\(component\) => maskBoundaryLoops\(component, \{ globalOccupied \}\)\)[\s\S]*?const sourceCellMeters = Number\(renderGrid\.sourceCellMeters\);[\s\S]*?const concreteRegions = visualMaskRegions\(tiles, \{[\s\S]*?tileMeters,[\s\S]*?sourceCellMeters,[\s\S]*?cosLat,[\s\S]*?globalOccupied,[\s\S]*?\}\);[\s\S]*?const visibleConcreteRegions = visibleMaskStrokeRegions\(concreteRegions, \{ cosLat \}\);[\s\S]*?exactRegions\.forEach\(\(region\) => \{[\s\S]*?region\.forEach\(\(coord\) => allCoords\.push\(coord\)\);[\s\S]*?contourRenderEntries\.push\([\s\S]*?landRegions: visibleConcreteRegions,[\s\S]*?contourRegions: visibleConcreteRegions,/,
  'Territory should derive smooth concrete land from resolved latest-wins ownership and only show area-qualified regions.',
);

assert.doesNotMatch(
  source,
  /const visualHullRegion = visualMaskHullRegion\(tiles\);[\s\S]*?const visualRegions = visualHullRegion/,
  'Territory should not build one owner-wide visible hull from every tile because distant claims can collapse into world-spanning rectangles.',
);

assert.doesNotMatch(
  source,
  /const surface = L\.polygon\(region|fillRegions: concreteRegions|LAND_MASK_SURFACE_OPACITY/,
  'Territory backend land masks should not render SVG surface fills because they can appear as a pixelated inner band.',
);

assert.doesNotMatch(
  source,
  /className: 'terr-land-mask-region'(?! terr-land-mask-region-surface)/,
  'Territory should not render generic unsmoothed land-mask regions.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_SURFACE_SKIRT|LAND_MASK_CONTOUR_GLOW|LAND_MASK_CONTOUR_FALLOFF/,
  'Territory should not keep decorative skirt, glow, or falloff layers; the only visible edge is the concrete contour border.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_SURFACE_SEAL_WEIGHT|LAND_MASK_SURFACE_SEAL_OPACITY/,
  'Territory should not keep secondary surface-stroke seal tokens after narrowing the visual stack to fill-only land plus one border.',
);

assert.match(
  source,
  /const LAND_MASK_CONTOUR_WEIGHT = \{ active: 4\.4, rival: 1\.25 \};[\s\S]*?const LAND_MASK_CONTOUR_OPACITY = \{ active: 0\.98, rival: 0\.26 \};/,
  'Territory should keep a crisp active runner contour that reads as the territory edge while keeping rival territory secondary.',
);

assert.doesNotMatch(
  source,
  externalReferenceNamePattern,
  'Territory should not transform owner colors into a highlighted border; the single contour should use the real owner color.',
);

assert.doesNotMatch(
  runtimeVerifierSource,
  externalReferenceLiteralPattern,
  'Territory runtime verifier script should not reference the external product name.',
);

assert.doesNotMatch(
  liveProofCommandSource,
  externalReferenceLiteralPattern,
  'Territory live proof script should not reference the external product name.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONCRETE_BORDER|LAND_MASK_FLOOR|LAND_MASK_EXACT|LAND_MASK_RESOLVED_UNDERLAY|LAND_MASK_COVERAGE_(WASH|BAND)|LAND_MASK_CONFLICT_SEAM|LAND_MASK_SHARED_BOUNDARY/,
  'Territory should not keep hidden helper-layer constants after narrowing the visual stack to concrete fill plus one border.',
);

assert.match(
  source,
  /const renderEntries = resolveMaskTileOwnership\(ownerPolygons, renderGrid\)\.slice\(\)\.reverse\(\);[\s\S]*?const globalOccupied = new Set\(renderEntries\.flatMap[\s\S]*?const exactRegions = maskTileConnectedComponents\(tiles\)\.flatMap[\s\S]*?const concreteRegions = visualMaskRegions\(tiles, \{[\s\S]*?tileMeters,[\s\S]*?sourceCellMeters,[\s\S]*?cosLat,[\s\S]*?globalOccupied,[\s\S]*?\}\);[\s\S]*?const visibleConcreteRegions = visibleMaskStrokeRegions\(concreteRegions, \{ cosLat \}\);[\s\S]*?landRegions: visibleConcreteRegions,[\s\S]*?contourRegions: visibleConcreteRegions,/,
  'Territory visible land should use smoothed resolved concrete ownership, with tiny fragments suppressed at this map scale.',
);

assert.doesNotMatch(
  source,
  /const renderEntries = expandedMaskCoverageEntries\(|visualMaskRegions\(coverageTiles/,
  'Territory should not use expanded coverage tiles for visible land after the concrete-land fix.',
);

assert.match(
  source,
  /const LAND_MASK_CONCRETE_LAND_OPACITY = \{ active: 0\.68, rival: 0\.12 \};[\s\S]*?function paintLandRegions\(entries, renderer\)[\s\S]*?entries\.forEach\(\(\{ active, color, landRegions \}\) => \{[\s\S]*?const concreteLand = L\.polygon\(region,[\s\S]*?renderer,[\s\S]*?stroke: false,[\s\S]*?fillRule: 'nonzero'[\s\S]*?className: `terr-land-mask-concrete-land\$\{active \? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'\}`/,
  'Territory backend render should paint active concrete land as the primary surface while keeping rival land subdued and separately targetable in CSS.',
);

assert.match(
  source,
  /function paintContourRegions\(entries, renderer\)[\s\S]*?entries\.forEach\(\(\{ active, borderColor, contourRegions \}\) => \{[\s\S]*?const contourLine = L\.polyline\(region,[\s\S]*?renderer,[\s\S]*?weight: active \? LAND_MASK_CONTOUR_WEIGHT\.active : LAND_MASK_CONTOUR_WEIGHT\.rival,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}`/,
  'Territory contour helper should draw through the requested pane renderer with active and rival contour classes.',
);

assert.match(
  source,
  /const rivalEntries = contourRenderEntries\.filter\(\(entry\) => !entry\.active\);[\s\S]*?const activeEntries = contourRenderEntries\.filter\(\(entry\) => entry\.active\);[\s\S]*?paintLandRegions\(rivalEntries, renderers\.rivalFill\);[\s\S]*?paintContourRegions\(rivalEntries, renderers\.rivalContour\);[\s\S]*?paintLandRegions\(activeEntries, renderers\.activeFill\);[\s\S]*?paintContourRegions\(activeEntries, renderers\.activeContour\);/,
  'Territory should draw rival fill and rival contour before active fill and active contour so opponent borders cannot cut through owned land.',
);

assert.match(
  source,
  /borderColor: color,[\s\S]*?color: borderColor,/,
  'Territory should curve the existing contour line on the same land geometry instead of drawing a separate halo or highlight path.',
);

assert.doesNotMatch(
  source,
  /function maskSharedBoundaryBands|function maskTileEdgeSegment|owner\.entryIndex >= neighbor\.entryIndex \? owner : neighbor/,
  'Territory should not create separate conflict underpaint geometry once latest-wins ownership is resolved before the visual surface.',
);

assert.match(
  source,
  /weight: active \? LAND_MASK_CONTOUR_WEIGHT\.active : LAND_MASK_CONTOUR_WEIGHT\.rival,[\s\S]*?opacity: active \? LAND_MASK_CONTOUR_OPACITY\.active : LAND_MASK_CONTOUR_OPACITY\.rival,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}`/,
  'Territory final contour branch should prioritize the active runner border and reduce rival border emphasis.',
);

assert.match(
  source,
  /const LAND_MASK_CONTOUR_SCREEN_SIMPLIFY_PX = 8;[\s\S]*?const LAND_MASK_CONTOUR_CUBIC_TENSION = 0\.42;[\s\S]*?const LAND_MASK_CONTOUR_CONTROL_PADDING_RATIO = 0\.72;[\s\S]*?function dedupeLayerPoints\(points, tolerancePixels = 0\.75\)[\s\S]*?function simplifyClosedLayerPoints\(points, tolerancePixels = LAND_MASK_CONTOUR_SCREEN_SIMPLIFY_PX\)[\s\S]*?function clampLayerControlPoint\(control, start, end\)[\s\S]*?segmentLength \* LAND_MASK_CONTOUR_CONTROL_PADDING_RATIO[\s\S]*?function cubicContourControls\(previous, current, next, following\)[\s\S]*?function smoothContourSvgPath\(map, region\)[\s\S]*?simplifyClosedLayerPoints\(dedupeLayerPoints\(closedMaskLoopOpenPoints\(region\)[\s\S]*?map\.latLngToLayerPoint\(point\)[\s\S]*?path \+= `C\$\{first\.x\} \$\{first\.y\} \$\{second\.x\} \$\{second\.y\} \$\{next\.x\} \$\{next\.y\}`[\s\S]*?return `\$\{path\}Z`;/,
  'Territory should rewrite fill and contour paths with cubic SVG curves and enough screen simplification to suppress tiny pixel-grid steps.',
);

assert.match(
  source,
  /const LAND_MASK_AXIS_SEGMENT_SOFTEN_PX = 64;[\s\S]*?const LAND_MASK_AXIS_SEGMENT_MIN_PX = 10;[\s\S]*?function softenAxisAlignedLayerSegments\(points\)[\s\S]*?axisSkew > 0\.12[\s\S]*?segmentLength \* 0\.24[\s\S]*?const points = softenAxisAlignedLayerSegments\(basePoints\)/,
  'Territory should soften long tile-derived axis segments on both outer and shared paths so inner territory borders do not read as pixel-grid edges.',
);

assert.match(
  source,
  /const LAND_MASK_SHARED_EDGE_CURVE_RATIO = 0\.38;[\s\S]*?function maskSharedEdgeMidpoint\(from, to\)[\s\S]*?segmentLength \* LAND_MASK_SHARED_EDGE_CURVE_RATIO[\s\S]*?loop\.push\(maskVertexToLatLng\(maskSharedEdgeMidpoint\(edge\.from, endpoint\), tileMeters, cosLat\)\)/,
  'Territory should curve shared owner boundaries with deterministic geometry points that both neighboring fills can share without dark gaps.',
);

assert.match(
  source,
  /const globalOccupied = new Set\(renderEntries\.flatMap[\s\S]*?maskTileClaimKey\(tile\)[\s\S]*?maskBoundaryLoops\(component, \{ globalOccupied \}\)[\s\S]*?visualMaskRegions\(tiles, \{[\s\S]*?globalOccupied,/,
  'Territory should know global latest-wins occupied tiles so shared owner boundaries stay concrete and cannot be softened into dark seams.',
);

assert.match(
  source,
  /function attachSmoothTerritoryPath\(map, territoryPath, region\)[\s\S]*?pathElement\.setAttribute\('d', path\)[\s\S]*?map\.off\('zoomend viewreset moveend', updatePath\)[\s\S]*?map\.on\('zoomend viewreset moveend', updatePath\)/,
  'Territory should keep the curved border path synchronized with Leaflet zoom and movement without adding a second helper layer.',
);

assert.match(
  source,
  /const contourLine = L\.polyline\(region,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}`[\s\S]*?\}\)\.addTo\(layer\);[\s\S]*?attachSmoothTerritoryPath\(map, contourLine, region\);/,
  'Territory should curve the existing contour line on the same land geometry instead of drawing a separate halo or highlight path.',
);

assert.doesNotMatch(
  source,
  /contourRenderEntries\.forEach\(\(\{ active, color, fillRegions \}\)|L\.polygon\(region,[\s\S]*?terr-land-mask-region-surface/,
  'Territory should not paint exact concrete land fill before the contour because that fill is the pixel-band regression.',
);

assert.match(
  source,
  /smoothFactor: 0\.35,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}`/,
  'Territory should keep Leaflet simplification low enough that rounded concrete land contours do not render as pixelated stair steps.',
);

assert.doesNotMatch(
  source,
  /terr-land-mask-contour-glow|terr-land-mask-contour-falloff|terr-land-mask-region-floor|terr-land-mask-region-exact|terr-land-mask-resolved-underlay|terr-land-mask-coverage|terr-land-mask-conflict-seam|terr-land-mask-shared-boundary/,
  'Territory should not render hidden helper layer classes after the concrete-land fix.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-region-surface \{[\s\S]*?filter: none;/,
  'Territory visible territory fill should stay crisp rather than filtered into a halo.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-region-surface \{[\s\S]*?fill-opacity: 0 !important;[\s\S]*?fill: transparent !important;[\s\S]*?stroke: none !important;[\s\S]*?stroke-opacity: 0 !important;/,
  'Territory visible territory fill should be forced transparent in CSS so real account mask overlaps cannot paint a pixelated band.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-concrete-land--active \{[\s\S]*?filter: drop-shadow\(0 0 12px rgba\(240, 117, 97, 0\.24\)\)[\s\S]*?\.territory-page \.terr-land-mask-contour--active \{[\s\S]*?filter: drop-shadow\(0 0 10px rgba\(240, 117, 97, 0\.52\)\) drop-shadow\(0 1px 0 rgba\(255, 244, 225, 0\.28\)\);[\s\S]*?\}/,
  'Territory CSS should separate the active border from the fill so the territory edge reads crisply without dashed or marching boundary noise.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-contour \{[\s\S]*?mix-blend-mode: normal;/,
  'Territory top contour should stay a single normal SVG stroke without screen-blended highlight treatment.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-contour \{[\s\S]*?shape-rendering: geometricPrecision;[\s\S]*?stroke-linecap: round;[\s\S]*?stroke-linejoin: round;[\s\S]*?vector-effect: non-scaling-stroke;/,
  'Territory contour should render as a crisp SVG territory line instead of a zoom-scaled fuzzy map highlight.',
);

assert.doesNotMatch(
  territoryCss,
  /terr-land-mask-region-floor|terr-land-mask-region-exact|terr-land-mask-resolved-underlay|terr-land-mask-coverage|terr-land-mask-conflict-seam|terr-land-mask-shared-boundary|terr-land-mask-contour-glow|terr-land-mask-contour-falloff/,
  'Territory CSS should not preserve deleted halo, underpaint, wash, or helper layer classes.',
);

assert.doesNotMatch(
  territoryCss,
  /terr-land-mask-contour-glow|terr-land-mask-contour-falloff/,
  'Territory CSS should not keep halo/falloff contour classes after those layers are removed.',
);

assert.match(
  runtimeVerifierSource,
  /const helperSelectors = \[[\s\S]*?'\.terr-land-mask-contour-glow'[\s\S]*?'\.terr-land-mask-contour-falloff'[\s\S]*?'\.terr-land-mask-border'[\s\S]*?'\.terr-land-mask-border-halo'[\s\S]*?'\.terr-land-mask-region-floor'[\s\S]*?'\.terr-land-mask-region-exact'[\s\S]*?'\.terr-land-mask-resolved-underlay'[\s\S]*?'\.terr-land-mask-coverage'[\s\S]*?'\.terr-land-mask-conflict-seam'[\s\S]*?'\.terr-land-mask-shared-boundary'/,
  'Runtime proof should reject decorative halo, highlight, underpaint, coverage, and shared-boundary helper layers.',
);

assert.match(
  runtimeVerifierSource,
  /hasC: \/C\/\.test\(node\.getAttribute\('d'\) \|\| ''\),[\s\S]*?hasLineCommands: \/\[LHV\]\/\.test\(node\.getAttribute\('d'\) \|\| ''\)/,
  'Runtime proof should inspect SVG path commands so the visible border cannot regress to pixel-like line segments.',
);

assert.match(
  runtimeVerifierSource,
  /assert\(sample\.hasC === true,[\s\S]*?assert\(sample\.hasLineCommands === false,/,
  'Runtime proof should require every sampled contour to use cubic-smoothed paths and reject line-command fallback.',
);

assert.match(
  runtimeVerifierSource,
  /assert\(proof\?\.surfaces === 0,[\s\S]*?Territory land surfaces should not render because they can paint a pixelated inner band[\s\S]*?assert\(proof\.surfaceSample\.length === 0,/,
  'Runtime proof should reject any territory surface fill so only the contour can paint the ownership edge.',
);

assert.match(
  runtimeVerifierSource,
  /genericRegions = q\('\.terr-land-mask-region:not\(\.terr-land-mask-region-surface\)'\)[\s\S]*?genericRegions: genericRegions\.length[\s\S]*?genericRegions === 0/,
  'Runtime proof should reject any old generic unsmoothed territory fill paths.',
);

assert.match(
  runtimeVerifierSource,
  /activeContours = q\('\.terr-land-mask-contour--active'\)[\s\S]*?activeConcreteLands = q\('\.terr-land-mask-concrete-land--active'\)[\s\S]*?assert\(proof\?\.activeContours > 0[\s\S]*?sample\.strokeWidth === \(isActive \? '4\.4' : '1\.25'\)[\s\S]*?sample\.strokeOpacity === \(isActive \? '0\.98' : '0\.26'\)/,
  'Runtime proof should require active territory classes and a crisp active contour that remains stronger than rival territory.',
);

assert.match(
  runtimeVerifierSource,
  /const activeContourSample = proof\.contourSample\.find\(\(sample\) => sample\.className\.includes\('terr-land-mask-contour--active'\)\);[\s\S]*?assert\(activeContourSample,[\s\S]*?assert\(activeContourSample\.strokeWidth === '4\.4'[\s\S]*?assert\(activeContourSample\.strokeOpacity === '0\.98'/,
  'Runtime proof should explicitly sample the active contour stroke, not only count active paths.',
);

assert.match(
  runtimeVerifierSource,
  /paneProof = Object\.fromEntries\([\s\S]*?terr-leaflet-territory-pane--rival-fill[\s\S]*?terr-leaflet-territory-pane--active-contour[\s\S]*?Number\(proof\.paneProof\.rivalFill\.zIndex\) < Number\(proof\.paneProof\.rivalContour\.zIndex\)[\s\S]*?Number\(proof\.paneProof\.activeFill\.zIndex\) < Number\(proof\.paneProof\.activeContour\.zIndex\)/,
  'Runtime proof should verify Territory pane z-order so rival contours cannot sit above active owned land.',
);

assert.match(
  runtimeVerifierSource,
  /strokeLinecap: getComputedStyle\(node\)\.strokeLinecap[\s\S]*?strokeLinejoin: getComputedStyle\(node\)\.strokeLinejoin[\s\S]*?sample\.strokeLinecap === 'round'[\s\S]*?sample\.strokeLinejoin === 'round'/,
  'Runtime proof should verify the live single contour has rounded caps and joins like a game territory edge.',
);

assert.match(
  runtimeVerifierSource,
  /territoryColorMetrics\.generated\.edgeLike\.averageSat >= 0\.42[\s\S]*?territoryColorMetrics\.generated\.colored\.averageSat >= 0\.32/,
  'Runtime proof should keep the concrete land visible while preventing the border from returning to halo-style saturation.',
);

assert.match(
  runtimeVerifierSource,
  /edgeLikePixelRatioDelta:[\s\S]*?Math\.abs\(territoryColorMetrics\.edgeLikePixelRatioDelta\) <= 0\.62/,
  'Runtime proof should keep measuring border color coverage after active territory emphasis changes.',
);

assert.match(
  runtimeVerifierSource,
  /coloredPixelRatioDelta:[\s\S]*?Math\.abs\(territoryColorMetrics\.coloredPixelRatioDelta\) <= 0\.54/,
  'Runtime proof should keep concrete filled-land coverage bounded while allowing the premium map substrate to remain visible.',
);

assert.match(
  runtimeVerifierSource,
  /function measureImageTerritorySeams\(imageFile\)[\s\S]*?betweenTerritoryDarkPerColored[\s\S]*?compareTerritorySeamsToReference\(screenshotResult\.path\)[\s\S]*?betweenTerritoryDarkPerColored <= 0\.14/,
  'Runtime proof should reject obvious dark cracks between concrete territories without treating intentional unclaimed gaps as helper-layer regressions.',
);

assert.match(
  runtimeVerifierSource,
  /function measureImageEdgeAngularity\(imageFile\)[\s\S]*?axisToDiagonal[\s\S]*?compareEdgeAngularityToReference\(screenshotResult\.path\)[\s\S]*?axisToDiagonalDelta <= 0\.6/,
  'Runtime proof should keep a screenshot-level angularity guard while the DOM proof rejects line-command pixel fallback.',
);

assert.match(
  runtimeVerifierSource,
  /const proofUrl = argValue\('--url', fixtureProofUrl\);[\s\S]*?const proofMode = process\.argv\.includes\('--url'\) \? 'real-runtime-url' : 'fixture-server';[\s\S]*?const setViewArg = argValue\('--set-view'[\s\S]*?const referencePath = resolveRootPath\(argValue\('--reference'[\s\S]*?const clipArg = argValue\('--clip'\)/,
  'Runtime proof should support authenticated real territory URLs in addition to the fixture server.',
);

assert.match(
  runtimeVerifierSource,
  /const server = proofMode === 'fixture-server'[\s\S]*?spawn\(nodeBin, \['\.tools\/territory-visual-proof-server\.mjs'\][\s\S]*?: null;[\s\S]*?const requestedView = parseSetViewArg\(setViewArg\)/,
  'Runtime proof should only launch the fixture server in fixture mode and allow a supplied live map crop view.',
);

assert.match(
  runtimeVerifierSource,
  /function parseClipArg\(value\)[\s\S]*?Invalid --clip value[\s\S]*?const requestedClip = parseClipArg\(clipArg\)[\s\S]*?const screenshotClip = \{ x: cropX, y: cropY, width: cropWidth, height: cropHeight \}[\s\S]*?referencePath,[\s\S]*?screenshotClip,/,
  'Runtime proof should support same-crop screenshots and custom references for exact territory parity checks.',
);

assert.match(
  liveProofCommandSource,
  /verify-territory-border-runtime\.mjs[\s\S]*?--url[\s\S]*?--set-view[\s\S]*?--reference[\s\S]*?--clip[\s\S]*?--screenshot/,
  'Live proof command helper should emit a ready-to-run verifier command with URL, map view, reference, crop, and screenshot arguments.',
);

assert.match(
  liveProofCommandSource,
  /document\.querySelector\('\.terr-leaflet-map'\)[\s\S]*?__hermesTerritoryMap[\s\S]*?map\.getCenter\(\)[\s\S]*?map\.getZoom\(\)/,
  'Live proof command helper should read the actual mounted territory Leaflet view instead of guessing the crop target.',
);

assert.match(
  liveProofCommandSource,
  /no territory map mounted[\s\S]*?currentUrl:[\s\S]*?nextStep:/,
  'Live proof command helper should clearly report unauthenticated or non-territory pages instead of pretending fixture proof is live proof.',
);

assert.match(
  liveProofCommandSource,
  /function runVerifier\(args\)[\s\S]*?const commandArgs[\s\S]*?const shouldExecute = hasFlag\('--execute'\)[\s\S]*?verifierResult[\s\S]*?if \(verifierResult && !verifierResult\.ok\)/,
  'Live proof command helper should optionally execute the exact emitted verifier command and fail when live proof fails.',
);

assert.match(
  source,
  /if \(!hasCellMaskPolygon\(poly\) && hasCoordinatePolygon\(poly\)\) \{[\s\S]*?contourRenderEntries\.push\(\{[\s\S]*?contourRegions: \[poly\.coordinates\],[\s\S]*?\}\);[\s\S]*?poly\.coordinates\.forEach\(\(coord\) => allCoords\.push\(coord\)\);/,
  'Territory coordinate-polygon fallback should render as a smoothed contour only, not a pixel-edge fill region.',
);

assert.doesNotMatch(
  source,
  /if \(hasCoordinatePolygon\(poly\)\) \{/,
  'Territory should not let coordinate fallback bypass backend cell-mask unioning when cells are present.',
);

assert.match(
  source,
  /function territoryCellFallbackPolygons\(territory\)[\s\S]*?territory\.territories[\s\S]*?\.filter\(ownsTerritoryCell\)[\s\S]*?active: true,[\s\S]*?coordinates: cell\.polygon/,
  'Territory should keep a real authenticated-user /api/territory fallback so the map does not go blank while concrete polygon masks are warming.',
);

assert.match(
  source,
  /const hasActiveBackendPolygon = backendPolygons\.some\(\(poly\) => poly\?\.active === true\);[\s\S]*?hasActiveBackendPolygon \? backendPolygons : territoryCellFallbackPolygons\(territory\)/,
  'Territory should prefer concrete backend masks and only fall back to authenticated-user territory cells when no active mask is available.',
);

assert.doesNotMatch(
  source,
  /fallbackZoneMaskPolygons|visibleCells|zoneCellCenter|zoneCellMeters/,
  'Territory should not restore the old broad zone fallback helpers because they created oversized fake territory blobs.',
);

assert.doesNotMatch(
  source,
  /L\.polygon\(cell\.polygon,/,
  'Territory zone fallback should not paint each coarse sector polygon directly because that is the visible square/pixel fallback.',
);

assert.match(
  source,
  /polygons=\{polygons\}[\s\S]*?showPolygons=\{polygons\.length > 0\}/,
  'Territory should paint only when backend polygon masks are present instead of falling back to broad territory cells.',
);

assert.doesNotMatch(
  source,
  /polygons=\{polygons\}\s+showPolygons\s+recenterSignal/,
  'Territory should not force polygon mode before polygon data exists because that suppresses the fallback path.',
);

assert.doesNotMatch(
  source,
  /className: 'terr-land-mask-region terr-land-mask-region-surface'/,
  'Territory should not emit the old land-mask surface class in any render path.',
);

assert.doesNotMatch(
  source,
  /coordinateSurface|fillOpacity: poly\.active \? LAND_MASK_SURFACE_OPACITY/,
  'Territory coordinate fallback regions should not reintroduce a filled surface path.',
);

assert.match(
  source,
  /MAX_MASK_CELLS_TO_RENDER = 200000/,
  'Territory should preserve backend concrete land-mask resolution instead of re-aggregating real territory into coarse frontend pixels.',
);

assert.match(
  source,
  /function maskBoundaryLoops\(tiles, options = \{\}\)/,
  'Territory should trace continuous land-mask boundary loops instead of leaving only blocky tile edges.',
);

assert.doesNotMatch(
  source,
  /L\.rectangle\(tile\.bounds,/,
  'Territory should not paint each aggregated mask cell as a rectangle because that creates the visible pixel/block effect.',
);

assert.doesNotMatch(
  source,
  /routeTraceLatLngs/,
  'Territory should not restore the old route-highlight helper; backend routeTraces are reserved for future concrete territory geometry.',
);

assert.doesNotMatch(
  source,
  /terr-land-mask-border|terr-land-mask-border-halo/,
  'Territory should not draw highlight border layers around land masks.',
);

assert.doesNotMatch(
  source,
  /L\.polyline\(loop,/,
  'Territory should not draw smoothed land-mask outlines as highlight borders.',
);

assert.doesNotMatch(
  source,
  /const shouldDrawConcreteBorder = smoothRegions\.length > 0;/,
  'Territory should not keep the old highlight-border branch after switching to one smooth contour border.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_OWNER_BRIDGE|connectOwnerMaskTiles|displayTiles|gridLineBetweenTiles/,
  'Territory should not synthesize bridge corridors between disconnected same-owner land components.',
);

assert.doesNotMatch(
  source,
  /buildOwnedClusters|terr-land-mask-anchor|L\.circleMarker\(/,
  'Territory should not add anchor circle markers that appear as colored dots on claimed land.',
);

assert.doesNotMatch(
  source,
  /weight: cell\.contested \? 2\.2 : 1\.5|dashArray: cell\.contested/,
  'Territory zone fallback should not use contested strokes or dashed highlight borders.',
);

assert.doesNotMatch(
  source,
  /weight: 2,\s*opacity: 0\.88/,
  'Territory coordinate polygons should not keep the old visible stroke style.',
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

assert.doesNotMatch(
  source,
  /\[territory, filter, leaderboard, mapReady, showPolygons\]/,
  'Territory should not keep the coarse zone-layer effect that paints oversized fallback blobs.',
);

assert.match(
  source,
  /\[polygons, showPolygons, mapReady, recenterSignal\]/,
  'Polygon layer effect should repaint after mapReady flips true and when the title-strip recenter action fires.',
);

console.log('[PASS] Territory backend wiring guard passed.');
