import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const territoryCss = readFileSync(path.join(here, '..', 'styles', '_split', 'territory.css'), 'utf8');
const heatmapCss = readFileSync(path.join(here, '..', 'styles', '_split', 'heatmap.css'), 'utf8');
const runtimeVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-border-runtime.mjs'), 'utf8');
const liveProofCommandSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'territory-live-proof-command.mjs'), 'utf8');
const liveSharedVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-live-shared-runtime.mjs'), 'utf8');
const cacheRuntimeVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-cache-runtime.mjs'), 'utf8');
const cellRenderVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-cell-render-runtime.mjs'), 'utf8');
const designRuntimeVerifierSource = readFileSync(path.join(here, '..', '..', '..', '.tools', 'verify-territory-design-runtime.mjs'), 'utf8');
const territoryRuntimeVerifierSources = [
  'verify-territory-border-runtime.mjs',
  'verify-territory-cache-runtime.mjs',
  'verify-territory-cell-render-runtime.mjs',
  'verify-territory-design-runtime.mjs',
  'verify-territory-flushing-conquest-runtime.mjs',
  'verify-territory-live-shared-runtime.mjs',
  'verify-territory-loading-runtime.mjs',
  'verify-territory-open-route-runtime.mjs',
  'verify-territory-parks-runtime.mjs',
  'verify-territory-theme-runtime.mjs',
  'verify-territory-world-runtime.mjs',
].map((file) => ({
  file,
  source: readFileSync(path.join(here, '..', '..', '..', '.tools', file), 'utf8'),
}));
const territoryServiceSource = readFileSync(path.join(here, '..', '..', '..', 'backend', 'src', 'main', 'java', 'com', 'hermes', 'backend', 'TerritoryService.java'), 'utf8');
const territoryPolygonRepositorySource = readFileSync(path.join(here, '..', '..', '..', 'backend', 'src', 'main', 'java', 'com', 'hermes', 'backend', 'TerritoryPolygonRepository.java'), 'utf8');
const activityPointRepositorySource = readFileSync(path.join(here, '..', '..', '..', 'backend', 'src', 'main', 'java', 'com', 'hermes', 'backend', 'ActivityPointRepository.java'), 'utf8');
const backendApplicationProperties = readFileSync(path.join(here, '..', '..', '..', 'backend', 'src', 'main', 'resources', 'application.properties'), 'utf8');
const externalReferenceNamePattern = new RegExp(`function ${['in', 'tv', 'l'].join('')}BorderColor|hexColorToRgb|rgbToHsl|hslToHexColor`);
const externalReferenceLiteralPattern = new RegExp(['in', 'tv', 'l'].join(''), 'i');

assert.match(
  source,
  /const \[mapReady, setMapReady\] = useState\(false\);/,
  'TerritoryMap should track Leaflet readiness so backend data paints after async map creation.',
);

assert.match(
  source,
  /const \{ isAuthenticated, authHydrated, email, logout \} = useAuth\(\);/,
  'Territory should wait for auth hydration before requesting route and land-mask data, and share the app logout path for expired raw territory fetches.',
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
  /function TerritoryInitialLoading\(\{[\s\S]*?label,[\s\S]*?copy,[\s\S]*?kicker,[\s\S]*?\}\)[\s\S]*?className="heatmap-page territory-loading-page"[\s\S]*?className="heatmap-page-map-shell"[\s\S]*?className="heatmap-page-map-canvas"[\s\S]*?className="heatmap-page-map-vignette"[\s\S]*?<header className="heatmap-page-topbar"[\s\S]*?className="heatmap-page-brand-pill"[\s\S]*?className="heatmap-page-search-pill"[\s\S]*?className="heatmap-page-action-strip"[\s\S]*?className="heatmap-page-empty"[\s\S]*?className="heatmap-page-empty-copy"[\s\S]*?className="heatmap-page-card-kicker"/,
  'Territory should render the same Heatmap loading-page canvas, topbar, and empty-card structure for its first page load.',
);

assert.match(
  source,
  /if \(!authHydrated \|\| !isAuthenticated \|\| territory === null\) \{[\s\S]*?return \([\s\S]*?<TerritoryInitialLoading[\s\S]*?label=\{tc\('loadingTerritory'\)\}[\s\S]*?copy=\{tc\('loadingCopy'\)\}[\s\S]*?kicker=\{tc\('loadingKicker'\)\}[\s\S]*?centerLabel=\{tc\('recenter'\)\}[\s\S]*?runsLabel=\{tc\('viewRuns'\)\}[\s\S]*?settingsLabel=\{tc\('settings'\)\}[\s\S]*?\);[\s\S]*?\}/,
  'Territory should show the startup loading animation until auth and initial territory shell data are ready.',
);

assert.match(
  source,
  /const TERRITORY_POLYGON_INITIAL_DELAY_MS = 120;/,
  'Territory should yield the first map paint before starting heavy land-mask polygon loading.',
);

assert.match(
  source,
  /const TERRITORY_CACHE_VERSION = 'global-owner-territory-cache-v97-concrete-boundary-sampling';/,
  'Territory should version its browser cache so stale render-contract payloads can be invalidated safely.',
);

assert.match(
  cacheRuntimeVerifierSource,
  /const cacheVersion = readArg\("--cache-version", "global-owner-territory-cache-v97-concrete-boundary-sampling"\);/,
  'Territory cache runtime proof should default to the same cache contract as the page.',
);

assert.match(
  territoryServiceSource,
  /private static final String POLYGON_CACHE_VERSION = "land-mask-union-v54-mask-v30-concrete-boundary-sampling";/,
  'Territory backend should invalidate cached polygon responses when land-mask rows must recompute with the current route-closure contract.',
);

assert.match(
  territoryServiceSource,
  /private static final double MAX_REAL_USER_LAND_MASK_RESPONSE_CELL_METERS = 16\.0;[\s\S]*?return Math\.min\(\s*Math\.ceil\(meters \* scale\),\s*MAX_REAL_USER_LAND_MASK_RESPONSE_CELL_METERS\s*\);/,
  'Territory backend should cap real-user visual response cells so sparse open routes do not re-coarsen into broad slabs.',
);

assert.match(
  territoryServiceSource,
  /LocalDateTime maskTime = ownershipTimeFor\(newestRow, activityTimes\);[\s\S]*?maskTime != null \? maskTime\.toString\(\) : null/,
  'Territory polygon createdAt should use effective activity time so frontend focus and cache metadata match original runs.',
);

assert.match(
  territoryServiceSource,
  /private static final String TERRITORY_MAP_CACHE_VERSION = "territory-map-v25-activity-split-render";/,
  'Territory map shell should invalidate cached leaderboard and center data when land masks split owner render sources by activity.',
);

assert.match(
  territoryServiceSource,
  /private static final int MAX_TERRITORY_ROUTE_TRACE_POINTS = 180;/,
  'Territory active route traces should keep enough samples to follow original park-run geometry instead of drawing long chords.',
);

assert.match(
  territoryServiceSource,
  /private static final int SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT = 4;[\s\S]*?List<Long> synchronousWarmupActivityIds = localSharedRunner[\s\S]*?missingOwnActivityIds\.stream\(\)\.limit\(SYNC_POLYGON_WARMUP_ACTIVITY_LIMIT\)\.toList\(\);[\s\S]*?computeMissingPolygonsSynchronously\(synchronousWarmupActivityIds\);/,
  'Territory should synchronously recompute a bounded batch of the active user newest stale masks so version bumps do not leave the page blank.',
);

assert.match(
  territoryPolygonRepositorySource,
  /findAllLiveLandMasksOrderByActivityTimeDesc[\s\S]*?runner\.deleted = false/,
  'Territory global land masks should include every non-deleted real runner with territory.',
);

assert.match(
  territoryPolygonRepositorySource,
  /select count\(p\), max\(p\.id\), max\(p\.createdAt\),[\s\S]*?lower\(runner\.email\) not like 'territory-%@hermes\.local'[\s\S]*?Object\[\] findGlobalLiveLandMaskSignature\(\);/,
  'Territory global land-mask signature should ignore local generated fixture owners so normal users do not replay mock plates.',
);

assert.match(
  territoryServiceSource,
  /private static boolean isLocalTerritoryFixtureRunner\(Runner runner\)[\s\S]*?email\.endsWith\("@hermes\.local"\) && email\.startsWith\("territory-"\)/,
  'Territory polygon responses should filter known local fixture accounts from normal global mode while keeping real signed-up runners.',
);

assert.match(
  territoryServiceSource,
  /List<TerritoryPolygon> relevantRows = relevantLiveLandMaskRows\(liveRows, userId\);/,
  'Territory polygon responses should pass live global land masks through the real-user visibility filter before ownership coloring.',
);

assert.match(
  territoryServiceSource,
  /private List<TerritoryPolygon> relevantLiveLandMaskRows\(List<TerritoryPolygon> rows, Long activeUserId\)[\s\S]*?runnerRepository\.findAllById\(userIds\)[\s\S]*?row\.getUserId\(\)\.equals\(activeUserId\)[\s\S]*?!isLocalTerritoryFixtureRunner\(runnersById\.get\(row\.getUserId\(\)\)\)/,
  'Territory polygon responses should keep the active user but suppress other generated fixture accounts in normal global mode.',
);

assert.doesNotMatch(
  territoryServiceSource,
  /OPTIONAL_TERRITORY_RIVAL_YELLOW_EMAIL|findMissingLocalTerritoryRivalActivityIds|appendMissingLocalTerritoryRivalActivityIds/,
  'Territory should not retain a dead local fixture-rival warmup path that can reintroduce mock owners into the global map.',
);

assert.match(
  activityPointRepositorySource,
  /select[\s\S]*?runner\.stravaUsername[\s\S]*?lower\(runner\.email\) not like 'territory-%@hermes\.local'[\s\S]*?findTerritorySamples/,
  'Territory map leaderboard and center samples should exclude local generated territory mock accounts.',
);

assert.match(
  backendApplicationProperties,
  /app\.local-territory-world\.enabled=\$\{APP_LOCAL_TERRITORY_WORLD_ENABLED:false\}[\s\S]*?app\.local-territory-world\.seed-mock-data=\$\{APP_LOCAL_TERRITORY_WORLD_SEED_MOCK_DATA:false\}/,
  'World territory mock account seeding should be opt-in and must not be enabled by default for the user-facing global map.',
);

assert.match(
  source,
  /import \{ apiFetch, apiJson \} from '\.\.\/api';/,
  'Territory should use apiFetch for polygon refreshes so 304 Not Modified responses can keep the cached render without throwing.',
);

assert.match(
  source,
  /function normalizeTerritoryServerSignature\(value\)[\s\S]*?function territoryPolygonRefreshHeaders\(signature\)[\s\S]*?'If-None-Match': normalizedSignature[\s\S]*?function territoryPolygonResponseSignature\(response\)/,
  'Territory should keep backend polygon signatures and send If-None-Match before downloading the heavy land-mask payload.',
);

assert.match(
  source,
  /const TERRITORY_CACHED_RENDER_PREVIEW_MAX_POINTS_PER_OWNER = 5200;[\s\S]*?const TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER = 12;[\s\S]*?const TERRITORY_CACHED_RENDER_PREVIEW_TOLERANCE_METERS = 24;/,
  'Territory cached preview render geometry should cap rival previews while preserving active owner geometry fidelity.',
);

assert.match(
  source,
  /const TERRITORY_MAX_AUTO_FIT_SPAN_METERS = 8_000;/,
  'Territory should use a meter-based auto-fit span so city-scale current-user territory focuses the recent cluster instead of zooming out to every distant island.',
);

assert.match(
  source,
  /function territoryShellCacheKey\(\)[\s\S]*?TERRITORY_SHELL_CACHE_KEY_PREFIX[\s\S]*?function readCachedTerritoryShell\(\)[\s\S]*?readTerritoryStoredValue\(cacheKey\)/,
  'Territory should synchronously read cached shell data so repeat visits do not wait on /api/territory before mounting the map.',
);

assert.match(
  source,
  /function openTerritoryPolygonCacheDb\(\)[\s\S]*?return territoryPolygonDbPromise\.then\(\(db\) =>[\s\S]*?territoryPolygonDbPromise = new Promise\(\(resolve\) => \{[\s\S]*?indexedDB\.open\(TERRITORY_POLYGON_CACHE_DB[\s\S]*?return territoryPolygonDbPromise;[\s\S]*?function readCachedTerritoryPolygons\(\)/,
  'Territory should read heavy polygon payloads from IndexedDB so repeat visits can paint concrete land before /api/territory/polygons returns.',
);

assert.match(
  source,
  /const initialTerritoryShell = readCachedTerritoryShell\(\);[\s\S]*?const \[territory, setTerritory\] = useState\(\(\) => initialTerritoryShell\?\.data \|\| null\);[\s\S]*?const territoryShellSignatureRef = useRef\(initialTerritoryShell\?\.signature \|\| ''\);/,
  'Territory should seed its initial state from cached shell data and track the cache signature to avoid redundant repainting.',
);

assert.match(
  source,
  /readCachedTerritoryPolygons\(\)\.then\(\(cached\) => \{[\s\S]*?polygonSignatureRef\.current = cached\.signature;[\s\S]*?setPolygonData\(cached\.data\);/,
  'Territory should apply cached polygon data before the background polygon refresh completes.',
);

assert.match(
  source,
  /function selectCachedPreviewRegions\(scoredRegions, maxRegions\)[\s\S]*?const cappedRegionCount = Math\.max\(1, Math\.floor\(Number\(maxRegions\) \|\| 1\)\);[\s\S]*?const sortedRegions = scoredRegions\.slice\(\)\.sort\(\(a, b\) => b\.score - a\.score\);[\s\S]*?selected\.length >= cappedRegionCount/,
  'Territory cached preview should select largest landmasses first instead of preserving scattered chips.',
);

assert.doesNotMatch(
  source,
  /previewRegionBucket|selectedBuckets/,
  'Territory cached preview should not bucket-spread small fragments across the map.',
);

assert.match(
  source,
  /function previewRegionSet\(regions, options = \{\}\)[\s\S]*?const maxRegions = Math\.max\(1, Math\.floor\(Number\(options\?\.maxRegions\) \|\| 1\)\);[\s\S]*?selectCachedPreviewRegions\(simplifiedRegions[\s\S]*?\), maxRegions\);[\s\S]*?let remainingPointBudget = TERRITORY_CACHED_RENDER_PREVIEW_MAX_POINTS_PER_OWNER;[\s\S]*?function cachedPreviewRenderEntries\(entries\)[\s\S]*?entry\.active[\s\S]*?entry\.landRegions[\s\S]*?previewRegionSet\(entry\.landRegions, \{ maxRegions: TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER \}\)[\s\S]*?entry\.active[\s\S]*?entry\.contourRegions[\s\S]*?previewRegionSet\(entry\.contourRegions, \{ maxRegions: TERRITORY_CACHED_RENDER_PREVIEW_MAX_RIVAL_REGIONS_PER_OWNER \}\)/,
  'Territory cached preview should preserve active geometry fidelity while still bounding rival preview regions.',
);

assert.doesNotMatch(
  source,
  /contourRenderEntries\s*=\s*previewContourRenderEntries;[\s\S]*?writeCachedTerritoryRender\(polygonSignature,[\s\S]*?contourRenderEntries,/,
  'Territory must not replace the final cached render with the capped preview; final render cache must preserve all additive run coverage.',
);

assert.match(
  source,
  /const fullContourRenderEntries = contourRenderEntries;[\s\S]*?const fullCoords = allCoords;[\s\S]*?const previewContourRenderEntries = cachedPreviewRenderEntries\(fullContourRenderEntries\);[\s\S]*?const renderData = \{[\s\S]*?allCoords: fullCoords,[\s\S]*?contourRenderEntries: fullContourRenderEntries,[\s\S]*?previewContourRenderEntries,[\s\S]*?writeCachedTerritoryRender\(polygonSignature, renderData\)/,
  'Territory should cache full additive render entries separately from the capped instant preview entries.',
);

assert.match(
  source,
  /const TERRITORY_INTERACTIVE_RENDER_MAX_ACTIVE_POINTS_PER_OWNER = Number\.POSITIVE_INFINITY;[\s\S]*?const TERRITORY_INTERACTIVE_RENDER_MAX_RIVAL_POINTS_PER_OWNER = 5200;[\s\S]*?function interactiveDisplayRenderEntries\(entries\)[\s\S]*?interactiveDisplayRegionGroups\(entry\?\.landRegionGroups, maxPoints\)[\s\S]*?contourRegions = landRegionGroups\.length > 0[\s\S]*?contourRenderEntries = territoryAssignLocalOwnerColors[\s\S]*?contourRenderEntries = interactiveDisplayRenderEntries\(contourRenderEntries\);/,
  'Territory should preserve full active interactive geometry while keeping rival SVG geometry bounded for responsive scope switching.',
);

assert.match(
  source,
  /const fullCachedEntries = Array\.isArray\(cachedRender\.data\.contourRenderEntries\)[\s\S]*?const previewCachedEntries = renderMode === 'preview'[\s\S]*?const focusCachedOwnerKey = selectedOwnerKeyValue \|\| focusOwnerKeyValue;[\s\S]*?const focusedFullCachedEntries = focusCachedOwnerKey[\s\S]*?const cachedEntries = selectedOwnerKeyValue[\s\S]*?previewCachedEntries\.filter\(\(entry\) => String\(entry\?\.ownerKey \|\| ''\) !== focusCachedOwnerKey\)[\s\S]*?\.\.\.focusedFullCachedEntries/,
  'Territory cached replay should keep the focused owner full geometry during instant preview so small recent regions are not dropped.',
);

assert.match(
  territoryServiceSource,
  /Map<Long, LocalDateTime> activityTimes = effectiveActivityTimesForIds\(routeActivityIds\);[\s\S]*?LocalDateTime activityTime = activityTimes\.get\(entry\.getKey\(\)\);[\s\S]*?activityTime != null \? activityTime\.toString\(\) : mask\.createdAt\(\)/,
  'Territory route traces should sort by actual activity time, not polygon row creation time.',
);

assert.match(
  source,
  /function territoryTraceFocusScore\(traceInfo\)[\s\S]*?territoryBoundsSpanMeters\(traceInfo\.bounds\)[\s\S]*?const hasDistinctTraceTimes = traceRecencies\.length > 1[\s\S]*?> 60_000;[\s\S]*?hasDistinctTraceTimes[\s\S]*?b\.recency - a\.recency[\s\S]*?territoryTraceFocusScore\(b\) - territoryTraceFocusScore\(a\)/,
  'Territory frontend should ignore near-identical batch trace timestamps and focus the stronger route footprint instead of a tiny stale Central/Prospect fragment.',
);

assert.match(
  source,
  /const TERRITORY_RENDER_INDEX_CACHE_KEY_PREFIX = 'hermes_territory_render_index_';[\s\S]*?function territoryRenderIndexCacheKey\(\)[\s\S]*?function readCachedTerritoryLatestRender\(\)[\s\S]*?readCachedTerritoryRender\(cachedIndex\.signature\)/,
  'Territory should keep a lightweight latest-render index so repeat visits can fetch compact render geometry without first loading the full polygon payload.',
);

assert.match(
  source,
  /function writeCachedTerritoryRender\(polygonSignature, data\)[\s\S]*?writeTerritoryIndexedCache\([\s\S]*?TERRITORY_RENDER_CACHE_STORE[\s\S]*?\)\.then\(\(\) => writeCachedTerritoryRenderIndex\(polygonSignature\)\)/,
  'Territory should update the latest-render index after writing processed render geometry.',
);

assert.match(
  source,
  /function isDrawableTerritoryRegion\(region\)[\s\S]*?region\.length >= 4[\s\S]*?function hasDrawableTerritoryRenderData\(data\)[\s\S]*?data\.allCoords\.some\(isDrawableTerritoryCoordinate\)[\s\S]*?data\.contourRenderEntries\.some\(isDrawableTerritoryRenderEntry\)/,
  'Territory cached render payloads should be considered usable only when they contain drawable coordinate regions.',
);

assert.match(
  source,
  /function hasDrawableTerritoryPolygon\(poly\)[\s\S]*?return hasCellMaskPolygon\(poly\);[\s\S]*?function hasDrawableTerritoryPolygonData\(data\)[\s\S]*?data\.polygons\.some\(hasDrawableTerritoryPolygon\)/,
  'Territory raw polygon payloads should be considered usable only when at least one polygon has concrete backend mask cells.',
);

assert.match(
  source,
  /function readCachedTerritoryPolygons\(\) \{[\s\S]*?readTerritoryIndexedCache\(TERRITORY_POLYGON_CACHE_STORE[\s\S]*?hasDrawableTerritoryPolygonData\(cached\?\.data\) \? cached : null/,
  'Territory should discard metadata-only raw polygon cache entries instead of treating owner chips as drawable land.',
);

assert.match(
  source,
  /function readCachedTerritoryRender\(polygonSignature\) \{[\s\S]*?readTerritoryIndexedCache\(TERRITORY_RENDER_CACHE_STORE[\s\S]*?hasDrawableTerritoryRenderData\(cached\?\.data\) \? cached : null/,
  'Territory should discard orphaned or non-drawable render cache entries instead of letting them suppress a fresh polygon fetch.',
);

assert.match(
  source,
  /const \[cachedRenderSnapshot, setCachedRenderSnapshot\] = useState\(null\);[\s\S]*?readCachedTerritoryLatestRender\(\)\.then\(\(cached\) => \{[\s\S]*?const hasPreviewEntries = Array\.isArray\(cached\.data\?\.previewContourRenderEntries\)[\s\S]*?setCachedRenderSnapshot\(\{ signature: cached\.signature, data: cached\.data, mode: hasPreviewEntries \? 'preview' : 'full' \}\);[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?setCachedRenderSnapshot\(\{ signature: cached\.signature, data: cached\.data, mode: 'full' \}\);/,
  'Territory should hydrate compact preview geometry directly from cache, then replay full additive cached geometry before the background polygon refresh completes.',
);

assert.doesNotMatch(
  source,
  /readCachedTerritoryLatestRender\(\)\.then\(\(cached\) => \{[\s\S]*?polygonSignatureRef\.current = cached\.signature;/,
  'Territory render-only cache must not write polygonSignatureRef because that can make the later full polygon payload look unchanged and skip painting.',
);

assert.match(
  source,
  /setCachedRenderSnapshot\(\(current\) => \([\s\S]*?current\?\.signature === nextSignature \? current : null[\s\S]*?\)\);/,
  'Territory should keep the same-signature processed render cache in state while raw polygon hydration completes.',
);

assert.match(
  source,
  /const processedRenderCacheRef = useRef\(null\);[\s\S]*?const shouldUseProcessedRenderCache = !hasRawPolygons \|\| \(shouldUseGlobalRenderCache && Boolean\(polygonSignature\)\);[\s\S]*?const memoryRenderSnapshot = processedRenderCacheRef\.current;[\s\S]*?const memoryRenderData = shouldUseProcessedRenderCache[\s\S]*?memoryRenderSnapshot\.signature === polygonSignature[\s\S]*?const snapshotData = memoryRenderData[\s\S]*?shouldUseProcessedRenderCache[\s\S]*?cachedRenderSnapshot\?\.signature[\s\S]*?const cachedRender = snapshotData[\s\S]*?: \(shouldUseProcessedRenderCache && \(shouldUseGlobalRenderCache \|\| selectedOwnerKeyValue\) && polygonSignature[\s\S]*?readCachedTerritoryRender\(polygonSignature\)[\s\S]*?processedRenderCacheRef\.current = \{[\s\S]*?data: cachedRender\.data[\s\S]*?const renderData = \{[\s\S]*?contourRenderEntries: fullContourRenderEntries[\s\S]*?processedRenderCacheRef\.current = \{[\s\S]*?data: renderData[\s\S]*?writeCachedTerritoryRender\(polygonSignature, renderData\)/,
  'Territory should reuse same-signature processed Global render geometry even after raw polygons load, so zoom does not reselect and flash owner loops.',
);

assert.match(
  source,
  /function territoryFitEntryInfo\(entry\)[\s\S]*?const declaredArea = Number\(entry\?\.areaSquareMeters\);[\s\S]*?Math\.sqrt\(declaredArea\)[\s\S]*?function territoryDefaultBoundsCoords\(entries, allCoords\)[\s\S]*?territoryBoundsSpanMeters\(allBounds\) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS[\s\S]*?const entryInfos = \(Array\.isArray\(entries\) \? entries : \[\]\)[\s\S]*?let bestCluster = null;[\s\S]*?entryInfos\.forEach\(\(candidate\) => \{[\s\S]*?territoryCenterDistanceMeters\(entryInfo\.center, candidate\.center\) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS[\s\S]*?score > bestCluster\.score[\s\S]*?cachedPreviewBoundsCoords\(\(bestCluster\?\.localInfos \|\| \[\]\)\.map\(\(entryInfo\) => entryInfo\.entry\)\)/,
  'Territory default bounds should fit the dominant local cluster using meter distance when all-user render coordinates span too much geography.',
);

assert.match(
  source,
  /const TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS = 96;[\s\S]*?function initialGlobalTerritoryRenderPolygons\(ownerPolygons\)[\s\S]*?const activeEntries = polygonsWithInfo\.filter\(\(entry\) => entry\.poly\?\.active === true\);[\s\S]*?const activeKeys = new Set[\s\S]*?rawTerritoryBoundsDistanceMeters\(activeBounds, entry\.bounds\)[\s\S]*?sort\(\(a, b\) => a\.distanceMeters - b\.distanceMeters \|\| b\.areaSquareMeters - a\.areaSquareMeters \|\| a\.index - b\.index\);[\s\S]*?slice\(0, Math\.max\(0, TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS - activeKeys\.size\)\)[\s\S]*?initialGlobalTerritoryRenderPolygons\(ownerPolygons\)/,
  'Territory global scope should reserve the initial-render cap by active owner count and include ranked rival owners instead of hiding valid global owners.',
);

assert.doesNotMatch(
  source,
  /TERRITORY_GLOBAL_INITIAL_RENDER_RADIUS_METERS|TERRITORY_GLOBAL_INITIAL_RENDER_MAX_OWNERS - activeEntries\.length/,
  'Territory global initial render must not use nearby-only rival pruning or active polygon-count budgeting.',
);

assert.match(
  source,
  /function territoryMapViewportInfo\(map\)[\s\S]*?radiusMeters: Math\.max\(900, radiusMeters \* 1\.2\)[\s\S]*?function territoryMapViewportKey\(map\)[\s\S]*?const \[mapViewportKey, setMapViewportKey\] = useState\(''\);[\s\S]*?map\.on\('moveend zoomend', updateMountedMapViewportKey\)[\s\S]*?const renderViewport = territoryMapViewportInfo\(map\)[\s\S]*?const shouldUseViewportRegionPriority = Boolean\(selectedOwnerKeyValue\);[\s\S]*?viewport: shouldUseViewportRegionPriority \? renderViewport : null[\s\S]*?mapViewportKey,/,
  'Territory should keep viewport-prioritized loop pruning for selected/Own focus while keeping Global geometry stable across zoom.',
);

assert.match(
  source,
  /const LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER = 32;[\s\S]*?const LAND_MASK_GLOBAL_ACTIVE_VISIBLE_REGIONS_PER_OWNER = Number\.POSITIVE_INFINITY;[\s\S]*?const LAND_MASK_MAX_LOCAL_VIEW_REGIONS_PER_OWNER = 144;[\s\S]*?const shouldUseViewportRegionPriority = Boolean\(selectedOwnerKeyValue\);[\s\S]*?const useLocalViewportRegionBudget = shouldUseViewportRegionPriority[\s\S]*?&& viewportMovedAfterFitRef\.current[\s\S]*?&& lastFittedConcreteBoundsKeyRef\.current !== null[\s\S]*?&& Number\(renderViewport\?\.zoom\) > 12;[\s\S]*?const activeRegionBudget = LAND_MASK_GLOBAL_ACTIVE_VISIBLE_REGIONS_PER_OWNER;[\s\S]*?const standardRegionBudget = useLocalViewportRegionBudget[\s\S]*?LAND_MASK_MAX_LOCAL_VIEW_REGIONS_PER_OWNER[\s\S]*?LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER[\s\S]*?const concreteLandRegionBudget = active \? activeRegionBudget : standardRegionBudget;[\s\S]*?preserveAll: active,[\s\S]*?maxGroups: concreteLandRegionBudget,[\s\S]*?limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?concreteLandRegionBudget[\s\S]*?\)/,
  'Territory should preserve all active owner regions and use region budgets only for rival/readability paths.',
);

assert.match(
  source,
  /function territoryMaskRegionGroupLimit\(maxGroups, options = \{\}\)[\s\S]*?if \(options\?\.preserveAll \|\| numericLimit === Number\.POSITIVE_INFINITY\) \{[\s\S]*?return Number\.POSITIVE_INFINITY;[\s\S]*?function selectDiverseMaskRegionGroups\(entries, maxGroups = LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER, options = \{\}\)[\s\S]*?const limit = territoryMaskRegionGroupLimit\(maxGroups, options\);[\s\S]*?function visibleMaskLandRegionGroups\(regionGroups, options = \{\}\)[\s\S]*?const maxGroups = territoryMaskRegionGroupLimit\(options\?\.maxGroups, options\);[\s\S]*?function limitMaskRegionGroupsByLoopBudget\(regionGroups, maxLoops = LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER\) \{[\s\S]*?const loopBudget = territoryMaskRegionGroupLimit\(maxLoops\);/,
  'Territory active preserveAll/Infinity budgets must remain uncapped through region selection and final loop limiting instead of falling back to the 32-region default.',
);

assert.match(
  source,
  /const TERRITORY_INTERACTIVE_RENDER_MAX_ACTIVE_POINTS_PER_OWNER = Number\.POSITIVE_INFINITY;[\s\S]*?function smoothMaskBoundaryLoop\(loop, options = \{\}\)[\s\S]*?if \(options\?\.preserveAll\) \{[\s\S]*?const closed = \[\.\.\.open, open\[0\]\];[\s\S]*?closed\.hasSharedBoundary = Boolean\(loop\.hasSharedBoundary\);[\s\S]*?return closed;[\s\S]*?\}[\s\S]*?function visibleMaskLandGroupLoops\(regions, options = \{\}\)[\s\S]*?if \(drawableRegions\.length <= 1\) return drawableRegions;[\s\S]*?if \(options\?\.preserveAll\) return drawableRegions;/,
  'Territory active preserveAll loops must stay exact, hole-preserving, and uncapped so smoothing/decimation cannot create gaps or fake interior land.',
);

assert.match(
  source,
  /function selectDiverseMaskRegionGroups\(entries, maxGroups = LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER, options = \{\}\)[\s\S]*?const viewport = options\?\.viewport \|\| null[\s\S]*?Number\(viewport\.radiusMeters\) \+ Math\.max\(entry\.spanMeters \/ 2, 420\)[\s\S]*?selectEntry\(entry, index\)[\s\S]*?return selected;/,
  'Territory should prioritize in-view mask regions before filling the remaining broken-piece budget with distant large regions.',
);

assert.match(
  source,
  /function territoryRecentOwnerFocusCoords\(entry\)[\s\S]*?territoryBoundsSpanMeters\(allBounds\) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS[\s\S]*?const traceInfos = \(Array\.isArray\(entry\?\.routeTraces\)[\s\S]*?territoryTraceRecencyScore\(trace, index\)[\s\S]*?let minTraceRecency = Number\.POSITIVE_INFINITY;[\s\S]*?let maxTraceRecency = Number\.NEGATIVE_INFINITY;[\s\S]*?const hasDistinctTraceTimes = traceRecencies\.length > 1[\s\S]*?> 60_000;[\s\S]*?const recentTrace = traceInfos[\s\S]*?hasDistinctTraceTimes[\s\S]*?b\.recency - a\.recency[\s\S]*?territoryTraceFocusScore\(b\) - territoryTraceFocusScore\(a\)[\s\S]*?territoryCenterDistanceMeters\(regionInfo\.center, traceCenter\) <= TERRITORY_MAX_AUTO_FIT_SPAN_METERS[\s\S]*?localRegions\.forEach\(\(regionInfo\) => \{[\s\S]*?return localCoords\.length > 0 \? localCoords : recentTrace\.coords[\s\S]*?function territoryOwnerFocusBoundsCoords\(entries\)[\s\S]*?territoryRecentOwnerFocusCoords\(entry\)\.forEach\(\(coord\) => coords\.push\(coord\)\)/,
  'Territory owner focus should use real recent route times when distinct, and fall back to the stronger local route footprint when stale batch timestamps are tied.',
);

assert.match(
  source,
  /contourRenderEntries\.push\(\{[\s\S]*?areaSquareMeters: Number\(poly\?\.areaSquareMeters\) \|\| 0,[\s\S]*?activityId: poly\.activityId \?\? null,[\s\S]*?createdAt: poly\.createdAt \?\? null,[\s\S]*?routeTraces: Array\.isArray\(poly\.routeTraces\) \? poly\.routeTraces : \[\],[\s\S]*?landRegions: concreteLandRegions/,
  'Territory render cache entries should preserve backend area and recency metadata for stable focused fitting.',
);

assert.match(
  source,
  /if \(nextSignature === polygonSignatureRef\.current\) \{[\s\S]*?return;[\s\S]*?\}[\s\S]*?polygonSignatureRef\.current = nextSignature;[\s\S]*?setPolygonData\(polygonsData\);/,
  'Territory should skip replacing polygon state when the refreshed backend payload matches the cached payload.',
);

assert.match(
  source,
  /let cachedPolygonsLoaded = false;[\s\S]*?Only a hydrated raw polygon payload can safely suppress a canonical[\s\S]*?const hasUsablePaintCache = cachedPolygonsLoaded;[\s\S]*?const currentCachedSignature = hasUsablePaintCache \? polygonSignatureRef\.current : '';[\s\S]*?const canUseConditionalRefresh = hasUsablePaintCache && Boolean\(currentCachedSignature\);[\s\S]*?const polygonUrl = canUseConditionalRefresh[\s\S]*?'\/api\/territory\/polygons\?initial=true&cells=false'[\s\S]*?'\/api\/territory\/polygons\?initial=true';[\s\S]*?headers: canUseConditionalRefresh \? territoryPolygonRefreshHeaders\(currentCachedSignature\) : \{\},[\s\S]*?freshPolygonsLoaded = true;[\s\S]*?cachedPolygonsLoaded = true;/,
  'Territory should only trust a conditional 304 when a raw polygon payload is already loaded; render-only cache can preview but must not suppress the bounded initial polygon load.',
);

assert.match(
  cacheRuntimeVerifierSource,
  /const expectsActivePaint = primedPaintProof\.activeConcrete > 0;[\s\S]*?const expectsRivalPaint = primedPaintProof\.rivalConcrete > 0;[\s\S]*?if \(expectsActivePaint\)[\s\S]*?if \(expectsRivalPaint\)/,
  'Territory cache proof should adapt to current seeded data instead of requiring active and rival polygons for every proof account.',
);

assert.match(
  cacheRuntimeVerifierSource,
  /shellReady[\s\S]*?state\.renderIndex\?\.current[\s\S]*?state\.indexedState\?\.render\?\.current[\s\S]*?current territory shell and render cache/,
  'Territory cache proof should not require raw polygon cache while backend polygon backfill is still warming.',
);

assert.match(
  cacheRuntimeVerifierSource,
  /const stravaAutoSyncSessionKey = "hermes_strava_auto_sync_at";[\s\S]*?sessionStorage\.setItem\(stravaAutoSyncSessionKey, String\(Date\.now\(\)\)\);/,
  'Territory cache proof should suppress unrelated Strava auto-sync so repeated layer proofs do not fail on background 429s.',
);

for (const { file, source: verifierSource } of territoryRuntimeVerifierSources) {
  assert.match(
    verifierSource,
    /hermes_strava_auto_sync_at/,
    `${file} should mark Strava auto-sync as already checked before running Territory layer proof steps.`,
  );
  assert.match(
    verifierSource,
    /sessionStorage\.setItem\(/,
    `${file} should seed sessionStorage so repeated Territory proofs do not fail on unrelated background 429s.`,
  );
}

assert.match(
  cacheRuntimeVerifierSource,
  /assert\([\s\S]*?polygonFullDownloadAttempted,[\s\S]*?bounded initial polygon payload after render-only cached paint[\s\S]*?assert\([\s\S]*?polygonConditionalRevalidation === false,[\s\S]*?render-only cache to authorize a conditional polygon 304/,
  'Territory cache proof should require a full bounded polygon refresh when the raw polygon cache was deleted and only render cache remains.',
);

assert.match(
  source,
  /if \(polygonResponse\?\.ok && canUseConditionalRefresh && !hasDrawableTerritoryPolygonData\(polygonsData\)\)[\s\S]*?apiFetch\('\/api\/territory\/polygons\?initial=true'\)[\s\S]*?if \(!hasDrawableTerritoryPolygonData\(polygonsData\)\)[\s\S]*?return;[\s\S]*?commitTerritoryPolygons\(drawablePolygonsData/,
  'Territory should refetch bounded initial polygon cells when a conditional cells=false refresh returns metadata-only territory.',
);

assert.match(
  source,
  /function commitEmptyTerritoryPolygons\(polygonsData, serverSignature = ''\)[\s\S]*?setCachedRenderSnapshot\(null\);[\s\S]*?clearCachedTerritoryLatestRender\(previousSignature, nextSignature\);[\s\S]*?clearCachedTerritoryPolygons\(\);/,
  'Territory should clear stale in-memory and persistent render cache when a fresh successful polygon response has no drawable territory.',
);

assert.match(
  source,
  /if \(!hasDrawableTerritoryPolygonData\(polygonsData\)\) \{[\s\S]*?if \(polygonResponse\?\.ok\) \{[\s\S]*?commitEmptyTerritoryPolygons\(polygonsData, territoryPolygonResponseSignature\(polygonResponse\)\);[\s\S]*?freshPolygonsLoaded = true;[\s\S]*?cachedPolygonsLoaded = false;/,
  'Territory should treat successful empty polygon responses as authoritative instead of leaving cached bad geometry painted.',
);

assert.doesNotMatch(
  source,
  /setPolygonData\(undefined\);\s*let cancelled = false;/,
  'Territory should not clear cached polygons on every mount before the background refresh starts.',
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

assert.doesNotMatch(
  source,
  /const tiles = pruneConqueredMaskFragments\(exactOwnershipTiles/,
  'Territory frontend must not remove backend-owned park loops as nearby fragments; backend newest-overlap ownership is the source of truth.',
);

assert.match(
  source,
  /function territoryLayerRenderers\(L, map\)[\s\S]*?pane\.style\.pointerEvents = 'auto';/,
  'Territory panes should accept pointer events so clicking real territory shapes can inspect the owner.',
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
  /function territoryOwnerThemes\(polygons, cachedRenderSnapshot, profile, lang\)[\s\S]*?territoryThemeSources\(polygons, cachedRenderSnapshot\)[\s\S]*?ownerKey = String\(source\?\.ownerKey \|\| polygonOwnerMergeKey\(source, index\)\)[\s\S]*?theme\.bounds = mergeTerritoryCoordinateBounds\(theme\.bounds, territoryColorSourceBounds\(source\)\);[\s\S]*?return territoryAssignLocalOwnerColors\(Array\.from\(themes\.values\(\)\)\)[\s\S]*?statusLabel: theme\.active \? mapChromeCopy\(lang, 'activeTheme'\) : mapChromeCopy\(lang, 'rivalTheme'\)/,
  'Territory should derive visible owner color themes from fresh polygons or cached render entries using the same owner keys and locality-aware colors as map paint.',
);

assert.match(
  source,
  /const TERRITORY_OWNER_COLOR_PALETTE = \[[\s\S]*?'#f07561'[\s\S]*?'#5b9cf5'[\s\S]*?'#34d399'[\s\S]*?\];[\s\S]*?const TERRITORY_OWNER_COLOR_NEAR_METERS = 5200;[\s\S]*?const TERRITORY_OWNER_COLOR_MIN_SEPARATION = 72;/,
  'Territory should keep a reusable owner palette with explicit near-owner color-separation thresholds.',
);

assert.match(
  source,
  /function territoryColorSeparation\(a, b\)[\s\S]*?territoryRgbToHsl\(rgbA\)[\s\S]*?hueDistance \+ saturationDistance \+ lightnessDistance;[\s\S]*?function territoryChooseLocalOwnerColor\(owner, neighbors\)[\s\S]*?if \(owner\.active\) \{[\s\S]*?return originalColor;[\s\S]*?originalSeparation >= TERRITORY_OWNER_COLOR_MIN_SEPARATION[\s\S]*?territoryColorCandidateList\(owner\.ownerKey, originalColor\)\.reduce/,
  'Territory should preserve the active owner color while changing nearby rival owners away from similar hues.',
);

assert.match(
  source,
  /function territoryAssignLocalOwnerColors\(entries\)[\s\S]*?owner\.bounds = mergeTerritoryCoordinateBounds\(owner\.bounds, territoryColorSourceBounds\(entry\)\);[\s\S]*?territoryOwnerBoundsAreNear\(owner\.bounds, candidate\.bounds\)[\s\S]*?owner\.assignedColor = territoryChooseLocalOwnerColor\(owner, neighbors\);[\s\S]*?borderColor: color,/,
  'Territory should assign reusable colors by owner proximity and write the resolved color back to fill and border colors.',
);

assert.match(
  source,
  /function territorySignificantThemeColors\(themes\)[\s\S]*?safeColor\(theme\?\.color, ''\)[\s\S]*?return colors\.length > 0 \? colors\.slice\(0, 5\) : TERRITORY_ALL_THEME_FALLBACK_COLORS;[\s\S]*?function territoryAllThemeStyle\(themes\)[\s\S]*?'--terr-theme-all-gradient'[\s\S]*?'--terr-theme-all-band'/,
  'Territory all-users theme should derive its significant colors from the actual visible owner themes, not from a hardcoded single-color chip.',
);

assert.match(
  source,
  /function TerritoryScopeSwitch\(\{[\s\S]*?themes,[\s\S]*?scope,[\s\S]*?activeTheme,[\s\S]*?onScopeChange,[\s\S]*?copy,[\s\S]*?\}\)[\s\S]*?className="terr-scope-switcher"[\s\S]*?className=\{`terr-scope-button terr-scope-button--own\$\{ownSelected \? ' is-selected' : ''\}`\}[\s\S]*?aria-pressed=\{ownSelected\}[\s\S]*?disabled=\{!ownAvailable\}[\s\S]*?onClick=\{\(\) => onScopeChange\('own'\)\}[\s\S]*?<strong>\{copy\('ownTerritory'\)\}<\/strong>[\s\S]*?className=\{`terr-scope-button terr-scope-button--global\$\{globalSelected \? ' is-selected' : ''\}`\}[\s\S]*?style=\{territoryAllThemeStyle\(themes\)\}[\s\S]*?aria-pressed=\{globalSelected\}[\s\S]*?onClick=\{\(\) => onScopeChange\('global'\)\}[\s\S]*?<strong>\{copy\('globalTerritory'\)\}<\/strong>/,
  'Territory should expose only Own territory and Global territory scope buttons instead of a per-owner theme navigator.',
);

assert.doesNotMatch(
  source,
  /TerritoryThemeNavigator|setSelectedOwnerKey|terr-theme-navigator|terr-theme-chip-list/,
  'Territory should not keep the old per-owner theme navigator or hidden selected-owner state.',
);

assert.doesNotMatch(
  source,
  /terr-game-campaign-panel/,
  'Territory should not render the old campaign panel overlay on top of the map.',
);

assert.doesNotMatch(
  territoryCss,
  /terr-game-campaign-panel|terr-game-campaign-kicker|terr-game-campaign-title|terr-game-campaign-actions|terr-game-campaign-strip/,
  'Territory CSS should not keep the removed campaign panel surface or its child styles.',
);

assert.match(
  source,
  /const \[scopeFocusSignal, setScopeFocusSignal\] = useState\(0\);[\s\S]*?const \[territoryScope, setTerritoryScope\] = useState\('global'\);[\s\S]*?const activeOwnerTheme = ownerThemes\.find\(\(theme\) => theme\.active\) \|\| null;[\s\S]*?const selectedOwnerKey = territoryScope === 'own' \? activeOwnerTheme\?\.ownerKey \|\| '' : '';[\s\S]*?const focusOwnerKey = activeOwnerTheme\?\.ownerKey \|\| '';[\s\S]*?if \(polygonData !== undefined && ownerThemes\.length > 0 && territoryScope === 'own' && !activeOwnerTheme\)[\s\S]*?setTerritoryScope\('global'\);[\s\S]*?function handleScopeChange\(nextScope\) \{[\s\S]*?setTerritoryScope\(nextScope === 'own' \? 'own' : 'global'\);[\s\S]*?setInspectedOwnerKey\(''\);[\s\S]*?setScopeFocusSignal\(\(value\) => value \+ 1\);[\s\S]*?function handleTerritoryOwnerClick\(ownerKey\) \{[\s\S]*?setInspectedOwnerKey\(ownerKey\);/,
  'Territory scope should default to Global so all owners render first, while Own explicitly selects the active owner.',
);

assert.match(
  source,
  /function TerritoryOwnerInfoPanel\(\{[\s\S]*?owner,[\s\S]*?copy,[\s\S]*?onClose,[\s\S]*?\}\)[\s\S]*?className=\{`terr-owner-inspector\$\{owner\.active \? ' is-active-owner' : ''\}`\}[\s\S]*?aria-label=\{`\$\{copy\('ownerInfoTitle'\)\}: \$\{owner\.label\}`\}[\s\S]*?<dt>\{copy\('username'\)\}<\/dt>[\s\S]*?<dd>\{owner\.label\}<\/dd>[\s\S]*?<dt>\{copy\('ownedArea'\)\}<\/dt>[\s\S]*?<dd>\{owner\.areaLabel\}<\/dd>/,
  'Territory should render a click-opened owner inspector with username and ownership details.',
);

assert.match(
  territoryServiceSource,
  /Map<String, Map<OwnerActivityKey, MaskCellClaim>> claimsByCell[\s\S]*?OwnerActivityKey sourceKey = new OwnerActivityKey\(row\.getUserId\(\), row\.getActivityId\(\)\);[\s\S]*?recordSourceCellFootprintClaims\([\s\S]*?sourceKey,[\s\S]*?activityTime[\s\S]*?Map.Entry<OwnerActivityKey, MaskCellClaim> winner = entry\.getValue\(\)\.entrySet\(\)\.stream\(\)[\s\S]*?OwnerActivityKey sourceKey = winner\.getKey\(\);/,
  'Territory backend should keep each activity as a separate render source while resolving newest cross-owner cell ownership.',
);

assert.doesNotMatch(
  territoryServiceSource,
  /OwnerActivityKey sourceKey = new OwnerActivityKey\(row\.getUserId\(\), null\);/,
  'Territory backend must not collapse all same-owner activities into one owner-level source because frontend repairs then synthesize fake land between unrelated runs.',
);

assert.match(
  source,
  /function renderCellMaskPolygonsBySource\(polygons\)[\s\S]*?ownerKey: String\(poly\?\.ownerKey \|\| polygonOwnerMergeKey\(poly, index\)\)[\s\S]*?activity:\$\{poly\.activityId\}/,
  'Territory should preserve backend mask sources while grouping UI color and focus by owner.',
);

assert.match(
  source,
  /function repairMergedOwnerMaskTiles\(tiles, renderGrid = \{\}\)[\s\S]*?return validTiles;[\s\S]*?function mergeResolvedMaskEntriesByOwner\(renderEntries, renderGrid = \{\}\)[\s\S]*?tilesByKey: new Map\(\)[\s\S]*?group\.tilesByKey\.set\(key, tile\)[\s\S]*?group\.poly\.sourcePolygonCount \+= 1[\s\S]*?repairMergedOwnerMaskTiles\(Array\.from\(group\.tilesByKey\.values\(\)\), renderGrid\)/,
  'Territory should union already-repaired source tiles by owner without final gap sealing that can create fake land.',
);

assert.match(
  source,
  /function routeTraceSegments\(poly, renderGrid = \{\}, options = \{\}\)[\s\S]*?const segments = \[\];[\s\S]*?\(Array\.isArray\(poly\?\.routeTraces\) \? poly\.routeTraces : \[\]\)\.forEach\(\(trace\) => \{[\s\S]*?segments\.push\(segment\);[\s\S]*?return segments;/,
  'Territory route-trace segment building should be iterative so owner-union payloads with many route points do not overflow Array.flatMap.',
);

assert.match(
  source,
  /function maskComponentBounds\(component\)[\s\S]*?let minX = Number\.POSITIVE_INFINITY;[\s\S]*?validTiles\.forEach\(\(tile\) => \{[\s\S]*?minX = Math\.min\(minX, tile\.gridX\);[\s\S]*?maxY = Math\.max\(maxY, tile\.gridY\);[\s\S]*?return \{[\s\S]*?minX,[\s\S]*?maxX,[\s\S]*?minY,[\s\S]*?maxY,/,
  'Territory mask component bounds should scan iteratively so large owner-union masks do not overflow Math.min/Math.max argument spreads.',
);

assert.doesNotMatch(
  source,
  /\.flatMap\(|Math\.(?:min|max)\(\.\.\./,
  'Territory should not use Array.flatMap or spread-based Math.min/Math.max in the large mask render path because real owner-union territories can exceed the JS call stack.',
);

const repairMergedOwnerMaskTilesBody = source.match(
  /function repairMergedOwnerMaskTiles\(tiles, renderGrid = \{\}\) \{[\s\S]*?\n\}/,
)?.[0] || '';
assert.doesNotMatch(
  repairMergedOwnerMaskTilesBody,
  /bridgeNearbyMaskComponents|sealInternalMaskCorridors|sealDenseMaskVoids/,
  'Territory owner-union repair must not bridge or seal separate source masks into fake land.',
);

assert.match(
  source,
  /function territoryMaskRenderGrid\(polygons\)/,
  'Territory should use one shared cell-mask render grid so neighboring owner boundaries do not drift into each other.',
);

assert.match(
  source,
  /const ownerPolygons = renderCellMaskPolygonsBySource\(polygons\);[\s\S]*?const renderPolygons = selectedOwnerKeyValue[\s\S]*?const renderGrid = territoryMaskRenderGrid\(renderPolygons\);[\s\S]*?const sourceRenderEntries = resolveMaskTileOwnership\(renderPolygons, renderGrid\)\.slice\(\)\.reverse\(\);[\s\S]*?const renderEntries = mergeResolvedMaskEntriesByOwner\(sourceRenderEntries, renderGrid\);/,
  'Territory should route-repair every backend activity source first, then union and seam-clean the resolved tiles by owner before tracing visible paint regions.',
);

assert.doesNotMatch(
  source,
  /mergeCellMaskPolygonsByOwner\(polygons\)|mergeCellMaskPolygonsByOwner\(globalPolygons\)|mergeCellMaskPolygonsByOwner\(localPolygons\)/,
  'Territory should not restore raw mask merge helpers before source-specific route repair.',
);

assert.match(
  source,
  /paintLandRegions\(rivalEntries, renderers\.rivalFill\)|paintContourRegions\(rivalEntries, renderers\.rivalContour\)/,
  'Territory should paint non-active owners in lower rival panes because the Territory map is global.',
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
  /const LAND_MASK_SOURCE_FOOTPRINT_RADIUS_RATIO = 0\.48;[\s\S]*?const sourceRadiusMeters = baseCellMeters \* LAND_MASK_SOURCE_FOOTPRINT_RADIUS_RATIO;[\s\S]*?distanceMeters > sourceRadiusMeters[\s\S]*?continue;/,
  'Territory should render backend concrete cells as a fixed source-cell footprint instead of re-expanding masks into variable-width blobs.',
);

assert.match(
  source,
  /const LAND_MASK_ROUTE_CORRIDOR_RADIUS_RATIO = 0\.72;[\s\S]*?const LAND_MASK_ROUTE_INTERIOR_DISTANCE_RATIO = 4\.0;[\s\S]*?const LAND_MASK_ROUTE_TRACE_MAX_SEGMENT_RATIO = 3\.0;[\s\S]*?function routeTraceConcreteMaxSegmentMeters\(renderGrid = \{\}\)[\s\S]*?function routeTraceSegments\(poly, renderGrid = \{\}, options = \{\}\)[\s\S]*?gridSegmentLengthMeters\(segment, tileMeters\) > maxSegmentMeters[\s\S]*?function routeSegmentSpatialIndex\(segments, thresholdMeters, tileMeters\)[\s\S]*?function routeSegmentCandidatesForTile\(tile, segments, segmentIndex\)[\s\S]*?function routeTraceUniformTiles\(poly, renderGrid, concreteTiles, providedSegments = null\)[\s\S]*?segments\.forEach\(\(segment\) => \{[\s\S]*?addTile\(centerX \+ offsetX, centerY \+ offsetY\)[\s\S]*?function consistentMaskTiles\(poly, renderGrid, concreteTiles\)[\s\S]*?const segments = routeTraceSegments\(poly, renderGrid, \{ maxSegmentMeters \}\);[\s\S]*?const routeTiles = routeTraceUniformTiles\(poly, renderGrid, concreteTiles, segments\);[\s\S]*?const segmentIndex = routeSegmentSpatialIndex\(segments, interiorDistanceMeters, tileMeters\);[\s\S]*?const candidateSegments = routeSegmentCandidatesForTile\(tile, segments, segmentIndex\);[\s\S]*?if \(!poly\?\.active && tileIsNearRouteSegments\(tile, candidateSegments, interiorDistanceMeters, tileMeters\)\) return;[\s\S]*?tilesByKey\.set\(maskTileClaimKey\(tile\), tile\)/,
  'Territory should replace traced rival open-route cells with exact nearby trace segments while active territory retains every backend concrete cell.',
);

assert.match(
  source,
  /const LAND_MASK_ROUTE_CORRIDOR_CONTOUR_SIMPLIFY_RATIO = 0\.7;[\s\S]*?const LAND_MASK_ROUTE_CORRIDOR_CORNER_RADIUS_RATIO = 1\.2;[\s\S]*?const LAND_MASK_ROUTE_CORRIDOR_SMOOTHING_PASSES = 1;[\s\S]*?const routeCorridor = Boolean\(options\?\.routeCorridor\);[\s\S]*?contourSimplifyRatio = LAND_MASK_ROUTE_CORRIDOR_CONTOUR_SIMPLIFY_RATIO;[\s\S]*?LAND_MASK_ROUTE_CORRIDOR_CORNER_RADIUS_RATIO[\s\S]*?routeCorridor \? 1 : LAND_MASK_CURVE_PASSES[\s\S]*?const componentDensity = maskComponentDensity\(component, componentBounds\);[\s\S]*?const largeLandmass = \([\s\S]*?componentDensity >= LAND_MASK_SOLID_COMPONENT_MIN_DENSITY[\s\S]*?const routeCorridor = !largeLandmass[\s\S]*?options: \{ largeLandmass, routeCorridor, preserveAll: active \}/,
  'Territory should use restrained contour smoothing for route-corridor pieces so open Central/Prospect paths do not simplify into filled wedges.',
);

assert.match(
  source,
  /const LAND_MASK_COMPONENT_BRIDGE_MAX_METERS = 180;[\s\S]*?function bridgeNearbyMaskComponents\(tiles, renderGrid = \{\}\)[\s\S]*?nearestMaskComponentBridge[\s\S]*?concreteMaskTileFromGrid\(gridX, gridY, tileMeters, cosLat, template\)[\s\S]*?function repairConsistentMaskTiles\(tiles, renderGrid = \{\}, options = \{\}\)[\s\S]*?bridgeNearbyMaskComponents\(tiles, renderGrid\)/,
  'Territory should repair short broken concrete route seams with narrow render tiles instead of broad hulls or interior fills.',
);

assert.match(
  source,
  /const LAND_MASK_INTERNAL_CORRIDOR_MAX_METERS = 44;[\s\S]*?const LAND_MASK_INTERNAL_CORRIDOR_MAX_ADDED_RATIO = 0\.85;[\s\S]*?function sealInternalMaskCorridors\(tiles, renderGrid = \{\}\)[\s\S]*?const maxGapCells = Math\.max\(1, Math\.floor\(LAND_MASK_INTERNAL_CORRIDOR_MAX_METERS \/ tileMeters\)\);[\s\S]*?collectLinearGaps\(rowRuns, true\);[\s\S]*?collectLinearGaps\(columnRuns, false\);[\s\S]*?slice\(0, maxAddedTiles\)[\s\S]*?function repairConsistentMaskTiles\(tiles, renderGrid = \{\}, options = \{\}\)[\s\S]*?sealInternalMaskCorridors\([\s\S]*?bridgeNearbyMaskComponents\(tiles, renderGrid\),[\s\S]*?renderGrid,[\s\S]*?\)/,
  'Territory should seal only narrow same-owner internal corridors at the concrete tile stage, not with owner-wide hulls or overlay fills.',
);

assert.match(
  source,
  /const LAND_MASK_DENSE_SEAM_MIN_TILES = 8_000;[\s\S]*?const LAND_MASK_DENSE_SEAM_MIN_COMPONENTS = 3;[\s\S]*?const LAND_MASK_DENSE_SEAM_MIN_DENSITY = 0\.48;[\s\S]*?function sealDenseMaskVoids\(tiles, renderGrid = \{\}\)[\s\S]*?componentCount < LAND_MASK_DENSE_SEAM_MIN_COMPONENTS[\s\S]*?scanCells > LAND_MASK_DENSE_SEAM_MAX_SCAN_CELLS[\s\S]*?density < LAND_MASK_DENSE_SEAM_MIN_DENSITY[\s\S]*?const outsideKeys = new Set\(\);[\s\S]*?while \(queueIndex < queue\.length\)[\s\S]*?boundedGap\(gridX, gridY, 1, 0\) \|\| boundedGap\(gridX, gridY, 0, 1\)[\s\S]*?function repairConsistentMaskTiles\(tiles, renderGrid = \{\}, options = \{\}\)[\s\S]*?sealDenseMaskVoids\([\s\S]*?sealInternalMaskCorridors\(/,
  'Territory should fill only dense enclosed voids and narrow seams before contouring so grid-sampled landmasses do not render internal slits.',
);

assert.match(
  source,
  /const LAND_MASK_TOPOLOGY_CLOSE_RADIUS_RATIO = 3\.0;[\s\S]*?const LAND_MASK_TOPOLOGY_CLOSE_MAX_RADIUS_CELLS = 12;[\s\S]*?const LAND_MASK_TOPOLOGY_CLOSE_MAX_DILATION_OPS = 120_000;[\s\S]*?const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_AREA_SQUARE_METERS = 5_000_000;[\s\S]*?const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_TILES = 30_000;[\s\S]*?const LAND_MASK_SOLID_COMPONENT_MIN_DENSITY = 0\.18;[\s\S]*?const LAND_MASK_TOPOLOGY_LARGE_CLOSE_RADIUS_RATIO = 3\.0;[\s\S]*?const LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_DILATION_OPS = 80_000;[\s\S]*?function maskComponentDensity\(component, bounds = maskComponentBounds\(component\)\)[\s\S]*?return validTileCount \/ boxCells;[\s\S]*?function closeThinMaskBays\(tiles, renderGrid = \{\}, options = \{\}\)[\s\S]*?const largeLandmass = Boolean\(options\?\.largeLandmass\);[\s\S]*?const maxDilationOps = largeLandmass[\s\S]*?LAND_MASK_TOPOLOGY_LARGE_CLOSE_MAX_DILATION_OPS[\s\S]*?LAND_MASK_TOPOLOGY_CLOSE_MAX_DILATION_OPS[\s\S]*?if \(validTiles\.length \* offsets\.length > maxDilationOps\) \{[\s\S]*?return validTiles;[\s\S]*?\}[\s\S]*?dilatedKeys\.add\(`\$\{tile\.gridY \+ offsetY\}:\$\{tile\.gridX \+ offsetX\}`\)[\s\S]*?if \(!closesBay\) return;[\s\S]*?function repairConsistentMaskTiles\(tiles, renderGrid = \{\}, options = \{\}\)[\s\S]*?return closeThinMaskBays\([\s\S]*?options,[\s\S]*?\);[\s\S]*?const componentDensity = maskComponentDensity\(component, componentBounds\);[\s\S]*?componentDensity >= LAND_MASK_SOLID_COMPONENT_MIN_DENSITY[\s\S]*?componentAreaSquareMeters >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_AREA_SQUARE_METERS[\s\S]*?component\.length >= LAND_MASK_TOPOLOGY_LARGE_CLOSE_MIN_TILES/,
  'Territory should close thin outside-connected bays only within a bounded work budget so large masks do not freeze first paint.',
);

assert.match(
  source,
  /const LAND_MASK_LARGE_BAY_COLLAPSE_WIDTH_RATIO = 16\.0;[\s\S]*?function collapseLargeMaskBays\(points, options = \{\}\)[\s\S]*?LAND_MASK_LARGE_BAY_COLLAPSE_MIN_ARC_TO_CHORD[\s\S]*?open\.slice\(startIndex, endIndex \+ 1\)\.some\(\(point\) => point\?\.hasSharedBoundary\)[\s\S]*?maskArcAreaMetersSquared[\s\S]*?const bayCollapsed = options\?\.largeLandmass[\s\S]*?collapseLargeMaskBays\(open, \{ cosLat, sourceCellMeters: baySourceCellMeters \}\)[\s\S]*?const componentRecords = visibleMaskConnectedComponents\(maskTileConnectedComponents\(tiles\), \{ preserveAll: active \}\)[\s\S]*?options: \{ largeLandmass, routeCorridor, preserveAll: active \}[\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\)/,
  'Territory should collapse long narrow contour bays only for component-level large landmasses, so selected concrete territory does not show black inlet cuts or fake park wedges.',
);

assert.match(
  source,
  /fromPoint\.hasSharedBoundary = Boolean\(edge\.shared\);[\s\S]*?midpoint\.hasSharedBoundary = true;[\s\S]*?normalized\.hasSharedBoundary = Boolean\(point\?\.hasSharedBoundary\);/,
  'Territory bay cleanup should preserve per-point shared-boundary metadata so large owners cannot cover smaller owner boundaries.',
);

assert.match(
  source,
  /function resolveMaskTileOwnership\(polygons, renderGrid\)[\s\S]*?const sourceEntries = \(Array\.isArray\(polygons\) \? polygons : \[\]\)\.map[\s\S]*?const concreteOwnerByKey = new Map\(\);[\s\S]*?concreteOwnerByKey\.set\(key, ownerIndex\);[\s\S]*?entry\.ownedConcreteKeys\.add\(key\);[\s\S]*?const ownedConcreteTiles = \(Array\.isArray\(concreteTiles\) \? concreteTiles : \[\]\)[\s\S]*?ownedConcreteKeys\.has\(maskTileClaimKey\(tile\)\)[\s\S]*?const sourceTiles = consistentMaskTiles\(poly, renderGrid, ownedConcreteTiles\);[\s\S]*?const concreteOwnerIndex = concreteOwnerByKey\.get\(maskTileClaimKey\(tile\)\);[\s\S]*?return concreteOwnerIndex === undefined \|\| concreteOwnerIndex === ownerIndex;/,
  'Territory should resolve latest-wins ownership from backend concrete cells before render repair, then clip synthetic repair tiles away from other owners.',
);

assert.match(
  source,
  /const exactOwnershipTiles = sourceTiles\.filter\(\(tile\) => \{[\s\S]*?return concreteOwnerIndex === undefined \|\| concreteOwnerIndex === ownerIndex;[\s\S]*?const tiles = exactOwnershipTiles;/,
  'Territory should preserve every backend-owned tile after exact ownership clipping; legitimate updated park loops must not be deleted as nearby fragments.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONQUERED_FRAGMENT|maskTileNearAnyKey|pruneConqueredMaskFragments|competingMaskConcreteKeys/,
  'Territory should not keep the destructive fragment-prune path that removed valid active park loops near older owners.',
);

assert.doesNotMatch(
  source,
  /visualMaskHullRegion|maskConvexHullVertices|LAND_MASK_OWNER_BRIDGE/,
  'Territory visual coalescing should be bounded grid closing, not a convex hull or owner-wide bridge that collapses distant claims.',
);

assert.match(
  source,
  /const drawableLandRegions = \(Array\.isArray\(landRegions\) \? landRegions : \[\]\)[\s\S]*?const drawableLandRegionGroups = \(Array\.isArray\(landRegionGroups\) \? landRegionGroups : \[\]\)[\s\S]*?const landLatLngs = drawableLandRegionGroups\.length > 0[\s\S]*?drawableLandRegionGroups[\s\S]*?drawableLandRegions\.map\(\(region\) => \[region\]\)[\s\S]*?const concreteLand = L\.polygon\(landLatLngs, \{[\s\S]*?fillRule: 'nonzero'[\s\S]*?smoothFactor: 0,[\s\S]*?className: `terr-land-mask-concrete-land\$\{active \? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-concrete-land'\)\}`,[\s\S]*?\}\)\.addTo\(layer\);/,
  'Territory active land should render selected concrete components as grouped multipolygons so unrun holes remain unfilled without stacking opacity.',
);

assert.doesNotMatch(
  source,
  /stableRegionLatLngSignedArea|alignStableRegionWindingForFill|options\.fill|function attachSmoothTerritoryPath|attachSmoothTerritoryPath\(|function smoothContourSvgPath|LAND_MASK_CONTOUR_CUBIC_TENSION|LAND_MASK_CONTOUR_REFERENCE_ZOOM/,
  'Territory should not rewrite fill or border SVG paths with independent smoothed geometry because that makes the border drift from the land.',
);

assert.doesNotMatch(
  source,
  /drawableLandRegions\.forEach\(\(region\) => \{[\s\S]*?L\.polygon\(\[region\],/,
  'Territory should not paint each active concrete region as a separate semi-transparent layer.',
);

assert.match(
  source,
  /const contourBaseMeters = Number\.isFinite\(tileMeters\) && tileMeters > 0[\s\S]*?\? tileMeters[\s\S]*?: Number\.isFinite\(sourceCellMeters\) && sourceCellMeters > 0[\s\S]*?\? sourceCellMeters[\s\S]*?: 36;[\s\S]*?const simplifyToleranceMeters = contourBaseMeters[\s\S]*?const cornerRadiusMeters = contourBaseMeters/,
  'Territory should smooth narrow route corridors at render-tile scale so open runs keep a consistent real-world width instead of source-cell-scale lobes.',
);

assert.match(
  source,
  /function resolveMaskTileOwnership\(polygons, renderGrid\)/,
  'Territory should remove backend concrete tile conflicts from older owners before Leaflet polygons are traced.',
);

assert.match(
  source,
  /aggregateMaskCells\(poly\.cells, poly\.cellMeters, renderGrid\)/,
  'Territory should aggregate every owner onto the same frontend grid so latest-owner boundaries do not blend with older land.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_ROUTE_RADIUS_FALLBACK_METERS|LAND_MASK_ROUTE_MIN_RADIUS_RATIO|function routeTraceLandMaskTiles/,
  'Territory should not restore legacy broad route-trace land brushes; route traces can only guide concrete cells through the bounded geometry helper.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONCRETE_SEAM_CLAIM_RADIUS_TILES|function expandConcreteMaskTiles|function maskTileAtGrid/,
  'Territory should not keep seam-expansion helpers because those tile buffers appear as pixelated ownership bands.',
);

assert.doesNotMatch(
  source,
  /routeGuidedConcreteTiles|LAND_MASK_ROUTE_GUIDE|closeMaskTileGaps|cohesiveMaskFillTiles|LAND_MASK_COHESIVE|LAND_MASK_RENDER_CLOSE/,
  'Territory should not restore frontend expansion helpers; they make open route corridors visually inconsistent.',
);

assert.doesNotMatch(
  source,
  /claimedTiles\.has\(key\)[\s\S]*?claimedTiles\.add\(key\)/,
  'Territory should not let render-repaired synthetic tiles claim ownership and hide another owner.',
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
  /function concreteMaskTileFromGrid\(gridX, gridY, tileMeters, cosLat, template = \{\}\)[\s\S]*?bounds: sealedMaskTileBounds\(latitude, longitude, tileMeters, cosLat\)/,
  'Territory should use sealed tile bounds at the land-mask cell level without route-guided repair tiles.',
);

assert.match(
  source,
  /function smoothMaskBoundaryLoop\(loop/,
  'Territory should smooth backend land-mask boundaries before rendering so claimed land no longer reads as square pixels.',
);

assert.match(
  source,
  /const LAND_MASK_CONTOUR_SIMPLIFY_RATIO = 3\.5;/,
  'Territory should preserve close-zoom border detail while simplifying only fine sub-cell stair noise.',
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
  /const LAND_MASK_SMOOTHING_PASSES = 5;/,
  'Territory should keep enough smoothing for continuous borders without erasing close-zoom concrete detail.',
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
  /const LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP = 800;/,
  'Territory should cap generated boundary vertices tightly enough that smoother regions do not create a frontend rendering regression.',
);

assert.match(
  source,
  /function maskSmoothingPassCount\(pointCount, requestedPasses\)[\s\S]*?pointCount <= LAND_MASK_TINY_LOOP_POINT_LIMIT[\s\S]*?Math\.min\(effectivePasses, 2\)[\s\S]*?pointCount <= LAND_MASK_SMALL_LOOP_POINT_LIMIT[\s\S]*?Math\.min\(effectivePasses, 3\)[\s\S]*?pointCount \* \(3 \*\* effectivePasses\) > LAND_MASK_MAX_SMOOTHED_POINTS_PER_LOOP/,
  'Territory should adapt smoothing pass count to boundary size instead of rounding small masks into blobs.',
);

assert.match(
  source,
  /let contourSimplifyRatio = LAND_MASK_CONTOUR_SIMPLIFY_RATIO;[\s\S]*?if \(routeCorridor\)[\s\S]*?contourSimplifyRatio = LAND_MASK_ROUTE_CORRIDOR_CONTOUR_SIMPLIFY_RATIO;[\s\S]*?else if \(open\.length <= LAND_MASK_TINY_LOOP_POINT_LIMIT\)[\s\S]*?LAND_MASK_CONTOUR_SIMPLIFY_RATIO \* 0\.45[\s\S]*?else if \(open\.length <= LAND_MASK_SMALL_LOOP_POINT_LIMIT\)[\s\S]*?LAND_MASK_CONTOUR_SIMPLIFY_RATIO \* 0\.7/,
  'Territory should simplify small loops less aggressively so the border stays map-shaped instead of circular.',
);

assert.match(
  source,
  /const LAND_MASK_CORNER_RADIUS_RATIO = 5\.5;/,
  'Territory rounded-corner contours should soften cell stair-steps without rounding away close-zoom territory details.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_STAIR_STEP_PRUNE_RATIO|pruneTinyStairStepCorners/,
  'Territory should not keep the tiny stair-step prune path because proof showed it did not improve the rendered border.',
);

assert.match(
  source,
  /const LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS = 4;/,
  'Territory should allow small concrete islands from recent runs to render instead of filtering valid owned land away.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_MIN_VISIBLE_COMPACTNESS|LAND_MASK_MAX_VISIBLE_ASPECT_RATIO/,
  'Territory should not gate active land by compactness or aspect ratio because real GPS-shaped components can be long and still valid.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONTOUR_PRUNE|LAND_MASK_LARGE_COMPONENT|function pruneMaskContourTiles/,
  'Territory should not prune backend concrete mask cells because that under-covers recent-run territory.',
);

assert.doesNotMatch(
  source,
  /function maskLoopCompactness\(|function maskLoopAspectRatio\(/,
  'Territory should not classify valid owned land as invalid/noise based on compactness or aspect ratio.',
);

assert.match(
  source,
  /function maskTileConnectedComponents\(tiles\)[\s\S]*?const remainingKeys = new Set\(tilesByKey\.keys\(\)\);[\s\S]*?neighborKeys\(tile\)\.forEach\(\(neighborKey\) => \{[\s\S]*?components\.push\(component\);[\s\S]*?return components;/,
  'Territory should split each owner mask into connected components so distant land cannot collapse into a world-spanning rectangle.',
);

assert.match(
  source,
  /function visibleMaskConnectedComponents\(components, options = \{\}\)[\s\S]*?if \(options\?\.preserveAll\) return validComponents;[\s\S]*?const visibleComponents = validComponents\.filter[\s\S]*?LAND_MASK_MIN_VISIBLE_COMPONENT_TILES[\s\S]*?return validComponents[\s\S]*?\.sort\(\(a, b\) => b\.length - a\.length\)[\s\S]*?function visualMaskRegions\(tiles, options = \{\}\)[\s\S]*?const regions = \[\];[\s\S]*?visibleMaskConnectedComponents\(maskTileConnectedComponents\(tiles\)\)\.forEach\(\(component\) => \{[\s\S]*?const componentRegions = maskBoundaryLoops\(component, options\)[\s\S]*?visibleMaskLandRegions\(componentRegions, options\)\.forEach\(\(region\) => regions\.push\(region\)\);[\s\S]*?return regions;/,
  'Territory should preserve all active concrete components while still filtering tiny default artifacts before drawing rival/readability paths.',
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
  /const LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS = 4_000;[\s\S]*?const LAND_MASK_MIN_CONTOUR_PERIMETER_METERS = 260;[\s\S]*?const LAND_MASK_MIN_VISIBLE_COMPONENT_TILES = 10;[\s\S]*?const LAND_MASK_EDGE_COMPONENT_MIN_VISIBLE_TILES = 4;/,
  'Territory should suppress only tiny live-data contour artifacts while leaving concrete land fill anchored to backend cells.',
);

assert.match(
  source,
  /function visibleMaskLandGroupLoops\(regions, options = \{\}\)[\s\S]*?dominantRegion[\s\S]*?const dominantOrientation = Math\.sign\(dominantRegion\?\.signedArea \|\| 0\);[\s\S]*?const isOuter = entry\.loop === dominantRegion\?\.loop;[\s\S]*?if \(isOuter \|\| entry\.loop\.hasSharedBoundary\) return true;[\s\S]*?const orientation = Math\.sign\(entry\.signedArea \|\| 0\);[\s\S]*?return dominantOrientation !== 0 && orientation === dominantOrientation;[\s\S]*?visibleMaskLandRegionGroups\(regionGroups, options = \{\}\)[\s\S]*?const groupOptions = source\?\.options[\s\S]*?visibleMaskContourRegions\(visibleMaskLandGroupLoops\(regions, groupOptions\), groupOptions\)/,
  'Territory should prune opposite-orientation interior cutout rings while preserving dominant and same-orientation exterior territory loops.',
);

assert.doesNotMatch(
  source,
  /function visibleMaskContourRegions\(exactRegions, options = \{\}\)[\s\S]*?maskLoopCompactness|function visibleMaskContourRegions\(exactRegions, options = \{\}\)[\s\S]*?maskLoopAspectRatio/,
  'Territory visible contour promotion should not contain compactness/aspect filters that remove real owned territory.',
);

assert.match(
  source,
  /function visibleMaskLandRegions\(exactRegions, options = \{\}\)[\s\S]*?loop\.length >= LAND_MASK_MIN_VISIBLE_CONTOUR_POINTS[\s\S]*?\.map\(\(loop\) => smoothMaskBoundaryLoop\(loop, options\)\)[\s\S]*?\.filter\(\(loop\) => loop\.length >= 4\)/,
  'Territory land fill smoothing should preserve every caller-selected drawable loop without compactness or aspect-ratio gates.',
);

assert.match(
  source,
  /function visibleMaskContourRegions\(exactRegions, options = \{\}\)[\s\S]*?maskLoopAreaMetersSquared\(loop, cosLat\) >= LAND_MASK_MIN_CONTOUR_AREA_SQUARE_METERS[\s\S]*?maskLoopPerimeterMeters\(loop, cosLat\) >= LAND_MASK_MIN_CONTOUR_PERIMETER_METERS[\s\S]*?smoothMaskBoundaryLoop\(loop, \{ \.\.\.options, cosLat \}\)/,
  'Territory contour promotion should filter tiny interior/grid loops by area or perimeter so the live shared-account border does not become thousands of specks.',
);

assert.doesNotMatch(
  source,
  /const outerRegions = measuredRegions[\s\S]*?\.filter\(\(entry\) => entry\.loop\.hasSharedBoundary \|\| entry\.area === maxArea\)/,
  'Territory solid land fill must not promote interior shared-boundary loops, because those loops render as long dark cracks inside conquered territory.',
);

assert.match(
  source,
  /const LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER = 32;[\s\S]*?function maskLoopSignedAreaMetersSquared\(loop, cosLat\)[\s\S]*?function outerMaskContourRegions\(regionGroups, options = \{\}\)[\s\S]*?signedArea: maskLoopSignedAreaMetersSquared\(loop, cosLat\),[\s\S]*?let maxArea = 0;[\s\S]*?let maxPerimeter = 0;[\s\S]*?measuredRegions\.forEach\(\(entry\) => \{[\s\S]*?maxArea = Math\.max\(maxArea, entry\.area\);[\s\S]*?maxPerimeter = Math\.max\(maxPerimeter, entry\.perimeter\);[\s\S]*?const dominantRegion = measuredRegions[\s\S]*?const dominantOrientation = Math\.sign\(dominantRegion\?\.signedArea \|\| 0\);[\s\S]*?orientation === dominantOrientation[\s\S]*?\.sort\(\(a, b\) => \([\s\S]*?b\.score - a\.score[\s\S]*?\|\| Number\(b\.hasSharedBoundary\) - Number\(a\.hasSharedBoundary\)[\s\S]*?\)\)[\s\S]*?slice\(0, LAND_MASK_MAX_VISIBLE_REGIONS_PER_OWNER\)[\s\S]*?const contourRegions = \[\];[\s\S]*?visibleMaskContourRegions\(outerRegions, \{ \.\.\.options, cosLat \}\)\.some\(\(region\) => \{[\s\S]*?contourRegions\.push\(region\);[\s\S]*?return contourRegions;/,
  'Territory should rank concrete connected components by real landmass size but keep same-orientation exterior loops so long park corridors are not dropped while opposite-orientation holes stay hidden.',
);

assert.match(
  source,
  /function maskBoundaryLoops\(tiles, options = \{\}\)/,
  'Territory should trace the real backend land-mask tiles without adding synthetic same-owner bridge corridors.',
);

assert.match(
  source,
  /const componentRecords = visibleMaskConnectedComponents\(maskTileConnectedComponents\(tiles\), \{ preserveAll: active \}\)[\s\S]*?maskBoundaryLoops\(component, \{ globalOccupied \}\)\.filter\(\(loop\) => loop\.length >= 4\)[\s\S]*?const exactRegionGroups = componentRecords\.map\(\(record\) => record\.regions\);[\s\S]*?const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?\);[\s\S]*?const concreteLandRegions = visibleMaskStrokeRegions\(concreteLandRegionGroups\.flat\(\), \{ cosLat \}\);[\s\S]*?const concreteContourRegions = concreteLandRegions;[\s\S]*?landRegions: concreteLandRegions,[\s\S]*?landRegionGroups: concreteLandRegionGroups,[\s\S]*?contourRegions: concreteContourRegions,/,
  'Territory should derive grouped fill and border from exact backend concrete tiles with component-level render options so open corridors keep holes instead of becoming filled plates.',
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
  /const LAND_MASK_CONTOUR_WEIGHT = \{ active: 2\.0, rival: 0\.8 \};[\s\S]*?const LAND_MASK_CONTOUR_OPACITY = \{ active: 0\.86, rival: 0\.2 \};/,
  'Territory should use a crisp active territory contour that reads like a visible map boundary instead of a neon route outline.',
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
  /const sourceRenderEntries = resolveMaskTileOwnership\(renderPolygons, renderGrid\)\.slice\(\)\.reverse\(\);[\s\S]*?const renderEntries = mergeResolvedMaskEntriesByOwner\(sourceRenderEntries, renderGrid\);[\s\S]*?const globalOccupied = new Set\(\);[\s\S]*?renderEntries\.forEach\(\(\{ tiles \}\) => \{[\s\S]*?globalOccupied\.add\(maskTileClaimKey\(tile\)\);[\s\S]*?const componentRecords = visibleMaskConnectedComponents\(maskTileConnectedComponents\(tiles\), \{ preserveAll: active \}\)[\s\S]*?const exactRegionGroups = componentRecords\.map\(\(record\) => record\.regions\);[\s\S]*?const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?\);[\s\S]*?const concreteLandRegions = visibleMaskStrokeRegions\(concreteLandRegionGroups\.flat\(\), \{ cosLat \}\);[\s\S]*?landRegions: concreteLandRegions,[\s\S]*?landRegionGroups: concreteLandRegionGroups,[\s\S]*?contourRegions: concreteContourRegions,/,
  'Territory visible land should preserve grouped repaired owner tiles with component-specific route options so open route holes are not filled by synthetic outer contours.',
);

assert.doesNotMatch(
  source,
  /const renderEntries = expandedMaskCoverageEntries\(|visualMaskRegions\(coverageTiles/,
  'Territory should not use expanded coverage tiles for visible land after the concrete-land fix.',
);

assert.match(
  source,
  /function territoryOwnerFocusClassToken\(ownerKey, selectedOwnerKeyValue, baseClassName\) \{[\s\S]*?if \(!selectedOwnerKeyValue\) return `\$\{baseClassName\}--theme-all`;[\s\S]*?return ownerKey === selectedOwnerKeyValue[\s\S]*?\? `\$\{baseClassName\}--theme-selected`[\s\S]*?: `\$\{baseClassName\}--theme-dimmed`;[\s\S]*?function ownerFocusClass\(ownerKey, baseClassName\) \{[\s\S]*?return territoryOwnerFocusClassName\(ownerKey, selectedOwnerKeyValue, baseClassName\);/,
  'Territory All users mode should explicitly highlight every owner layer instead of leaving rivals at low default opacity.',
);

assert.match(
  source,
  /const LAND_MASK_CONCRETE_LAND_OPACITY = \{ active: 0\.72, rival: 0\.18 \};[\s\S]*?function paintLandRegions\(entries, renderer\)[\s\S]*?entries\.forEach\(\(\{ active, color, ownerName, ownerId, ownerKey, landRegions, landRegionGroups \}\) => \{[\s\S]*?const drawableLandRegionGroups = \(Array\.isArray\(landRegionGroups\) \? landRegionGroups : \[\]\)[\s\S]*?const landLatLngs = drawableLandRegionGroups\.length > 0[\s\S]*?const concreteLand = L\.polygon\(landLatLngs, \{[\s\S]*?renderer,[\s\S]*?stroke: false,[\s\S]*?fillRule: 'nonzero'[\s\S]*?smoothFactor: 0,[\s\S]*?className: `terr-land-mask-concrete-land\$\{active \? ' terr-land-mask-concrete-land--active' : ' terr-land-mask-concrete-land--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-concrete-land'\)\}`[\s\S]*?markTerritoryPathOwner\(concreteLand, \{ active, ownerName, ownerId, ownerKey \}\);/,
  'Territory backend render should paint active concrete land as a translucent primary surface while keeping rival land subdued and separately targetable in CSS.',
);

assert.match(
  source,
  /function inspectOwnerFromPath\(event, \{ ownerKey \}\)[\s\S]*?ownerClickHandlerRef\.current\?\.\(ownerKey\);[\s\S]*?function markTerritoryPathOwner\(path, \{ active, ownerName, ownerId, ownerKey \}\)[\s\S]*?element\.setAttribute\('role', 'button'\);[\s\S]*?element\.setAttribute\('tabindex', '0'\);[\s\S]*?element\.setAttribute\('aria-label', `\$\{mapChromeCopy\(mapLang, 'clickTerritoryOwner'\)\} \$\{ownerLabel\}`\);[\s\S]*?event\.key === 'Enter' \|\| event\.key === ' '[\s\S]*?path\.on\?\.\('click', \(event\) => inspectOwnerFromPath\(event, \{ ownerKey \}\)\);/,
  'Territory SVG owner paths should be clickable and keyboard inspectable with accessible labels.',
);

assert.match(
  source,
  /interactive: true,[\s\S]*?className: `terr-land-mask-concrete-land[\s\S]*?interactive: true,[\s\S]*?className: `terr-land-mask-contour/,
  'Territory land and contour paths should be Leaflet-interactive so map clicks can reveal owner information.',
);

assert.match(
  source,
  /function paintContourRegions\(entries, renderer\)[\s\S]*?entries\.forEach\(\(\{ active, borderColor, ownerName, ownerId, ownerKey, contourRegions \}\) => \{[\s\S]*?const drawableContourRegions = \(Array\.isArray\(contourRegions\) \? contourRegions : \[\]\)[\s\S]*?const contour = L\.polygon\(drawableContourRegions\.map\(\(region\) => \[region\]\), \{[\s\S]*?renderer,[\s\S]*?weight: active \? LAND_MASK_CONTOUR_WEIGHT\.active : LAND_MASK_CONTOUR_WEIGHT\.rival,[\s\S]*?fill: false,[\s\S]*?smoothFactor: 0,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-contour'\)\}`[\s\S]*?markTerritoryPathOwner\(contour, \{ active, ownerName, ownerId, ownerKey \}\);/,
  'Territory contour helper should draw through the requested pane renderer as owner-level paths with active and rival contour classes.',
);

assert.match(
  source,
  /const rivalEntries = contourRenderEntries\.filter\(\(entry\) => !entry\.active\);[\s\S]*?const activeEntries = contourRenderEntries\.filter\(\(entry\) => entry\.active\);[\s\S]*?paintLandRegions\(rivalEntries, renderers\.rivalFill\);[\s\S]*?paintContourRegions\(rivalEntries, renderers\.rivalContour\);[\s\S]*?paintLandRegions\(activeEntries, renderers\.activeFill\);[\s\S]*?paintContourRegions\(activeEntries, renderers\.activeContour\);/,
  'Territory should draw global rival owners first and the current active owner above them.',
);

assert.match(
  source,
  /const rivalEntries = contourRenderEntries\.filter|paintLandRegions\(rivalEntries|paintContourRegions\(rivalEntries/,
  'Territory should create and paint rival territory entries on the map.',
);

assert.match(
  source,
  /borderColor: color,[\s\S]*?color: borderColor,/,
  'Territory should stroke the existing contour on the same land geometry instead of drawing a separate halo or highlight path.',
);

assert.doesNotMatch(
  source,
  /function maskSharedBoundaryBands|function maskTileEdgeSegment|owner\.entryIndex >= neighbor\.entryIndex \? owner : neighbor/,
  'Territory should not create separate conflict underpaint geometry once latest-wins ownership is resolved before the visual surface.',
);

assert.match(
  source,
  /weight: active \? LAND_MASK_CONTOUR_WEIGHT\.active : LAND_MASK_CONTOUR_WEIGHT\.rival,[\s\S]*?opacity: active \? LAND_MASK_CONTOUR_OPACITY\.active : LAND_MASK_CONTOUR_OPACITY\.rival,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-contour'\)\}`/,
  'Territory final contour branch should prioritize the active runner border and reduce rival border emphasis.',
);

assert.doesNotMatch(
  source,
  /LAND_MASK_CONTOUR_SCREEN_SIMPLIFY_PX|LAND_MASK_CONTOUR_REFERENCE_ZOOM|LAND_MASK_CONTOUR_CUBIC_TENSION|LAND_MASK_CONTOUR_CONTROL_PADDING_RATIO|LAND_MASK_AXIS_SEGMENT_SOFTEN_PX|function stableContourLatLngPoints|function smoothContourSvgPath|function attachSmoothTerritoryPath/,
  'Territory should not keep independent cubic contour-path rewriting because the border must follow the exact filled territory edge.',
);

assert.doesNotMatch(
  source,
  /L\.polyline\(region,|attachSmoothTerritoryPath\(map,/,
  'Territory contour should use a stroke-only polygon from the same ring as the fill, not a separate polyline path rewrite.',
);

assert.match(
  source,
  /const LAND_MASK_SHARED_EDGE_CURVE_RATIO = 0\.38;[\s\S]*?function maskSharedEdgeMidpoint\(from, to\)[\s\S]*?segmentLength \* LAND_MASK_SHARED_EDGE_CURVE_RATIO[\s\S]*?const midpoint = maskVertexToLatLng\(maskSharedEdgeMidpoint\(edge\.from, endpoint\), tileMeters, cosLat\);[\s\S]*?midpoint\.hasSharedBoundary = true;[\s\S]*?loop\.push\(midpoint\)/,
  'Territory should curve shared owner boundaries with deterministic geometry points that both neighboring fills can share without dark gaps.',
);

assert.match(
  source,
  /const globalOccupied = new Set\(\);[\s\S]*?renderEntries\.forEach\(\(\{ tiles \}\) => \{[\s\S]*?globalOccupied\.add\(maskTileClaimKey\(tile\)\);[\s\S]*?maskBoundaryLoops\(component, \{ globalOccupied \}\)[\s\S]*?const regionOptions = \{[\s\S]*?globalOccupied,[\s\S]*?\};[\s\S]*?const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?\)/,
  'Territory should keep grouped latest-wins occupied boundaries so shared owner edges stay concrete while legitimate holes remain unfilled.',
);

assert.doesNotMatch(
  source,
  /contourRenderEntries\.forEach\(\(\{ active, color, fillRegions \}\)|L\.polygon\(region,[\s\S]*?terr-land-mask-region-surface/,
  'Territory should not paint exact concrete land fill before the contour because that fill is the pixel-band regression.',
);

assert.match(
  source,
  /L\.polygon\(drawableContourRegions\.map\(\(region\) => \[region\]\), \{[\s\S]*?fill: false,[\s\S]*?smoothFactor: 0,[\s\S]*?className: `terr-land-mask-contour\$\{active \? ' terr-land-mask-contour--active' : ' terr-land-mask-contour--rival'\}\$\{ownerFocusClass\(ownerKey, 'terr-land-mask-contour'\)\}`/,
  'Territory contour should be stroke-only owner-level multipolygon paths with no Leaflet simplification so each border stays on its fill edge.',
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
  /\.territory-page \.terr-land-mask-concrete-land--active \{[\s\S]*?filter: none;[\s\S]*?fill: var\(--terr-active-color, #f07561\) !important;[\s\S]*?fill-opacity: 0\.72 !important;[\s\S]*?stroke: rgba\(255, 190, 176, 0\.34\) !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--active \{[\s\S]*?filter: none;[\s\S]*?stroke: rgba\(255, 158, 132, 0\.86\) !important;/,
  'Territory CSS should render active owned land as one Hermes Shared Account coral plate with no multi-owner palette cycling.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-concrete-land \{[\s\S]*?cursor: pointer;[\s\S]*?pointer-events: visiblePainted;[\s\S]*?\.territory-page \.terr-land-mask-contour \{[\s\S]*?cursor: pointer;[\s\S]*?pointer-events: visibleStroke;/,
  'Territory CSS should make concrete land and contour paths visibly clickable without adding synthetic overlay layers.',
);

assert.match(
  territoryCss,
  /\.territory-page \.terr-land-mask-concrete-land--theme-selected \{[\s\S]*?opacity: 1 !important;[\s\S]*?\.territory-page \.terr-land-mask-concrete-land--rival\.terr-land-mask-concrete-land--theme-selected \{[\s\S]*?fill-opacity: 0\.62 !important;[\s\S]*?\.territory-page \.terr-land-mask-concrete-land--theme-all \{[\s\S]*?opacity: 1 !important;[\s\S]*?\.territory-page \.terr-land-mask-concrete-land--rival\.terr-land-mask-concrete-land--theme-all \{[\s\S]*?fill-opacity: 0\.56 !important;[\s\S]*?\.territory-page \.terr-land-mask-concrete-land--theme-dimmed \{[\s\S]*?opacity: 0\.46 !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--theme-selected \{[\s\S]*?stroke-opacity: 0\.94 !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--theme-all \{[\s\S]*?opacity: 1 !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--rival\.terr-land-mask-contour--theme-all \{[\s\S]*?stroke-opacity: 0\.72 !important;[\s\S]*?\.territory-page \.terr-land-mask-contour--theme-dimmed \{[\s\S]*?stroke-opacity: 0\.28 !important;/,
  'Territory CSS should keep selected owner themes prominent while leaving other owners visible enough that valid rival land does not read as missing gaps.',
);

assert.match(
  territoryCss,
  /\.territory-map-only \.terr-owner-inspector \{[\s\S]*?position: absolute;[\s\S]*?bottom: 112px;[\s\S]*?--terr-owner-color[\s\S]*?\.territory-map-only \.terr-owner-inspector-close:focus-visible \{[\s\S]*?outline: 3px solid[\s\S]*?\.territory-map-only \.terr-owner-inspector-grid \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
  'Territory CSS should render the clicked-owner inspector as a map annotation with visible focus styling.',
);

assert.match(
  territoryCss,
  /\.territory-map-only \.terr-scope-switcher \{[\s\S]*?left: 50%;[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?width: min\(560px, calc\(100vw - 196px\)\);[\s\S]*?transform: translateX\(-50%\);[\s\S]*?\.territory-map-only \.terr-scope-button \{[\s\S]*?--terr-theme-color[\s\S]*?\.territory-map-only \.terr-scope-button\.is-selected \{/,
  'Territory CSS should render a centered, readable two-button territory scope switcher with selected state.',
);

assert.doesNotMatch(
  source,
  /terr-game-hud|terr-game-territory-dock/,
  'Territory should not render hidden legacy game HUD or dock markup on the map-first territory page.',
);

assert.doesNotMatch(
  territoryCss,
  /territory-map-only \.terr-game-hud|territory-map-only \.terr-game-territory-dock/,
  'Territory CSS should not keep map-only game HUD or dock styles after the map-first scope switcher replaced them.',
);

assert.match(
  territoryCss,
  /\.territory-map-only \.terr-scope-button--global \{[\s\S]*?var\(--terr-theme-all-band[\s\S]*?\.territory-map-only \.terr-scope-button--global\.is-selected \{[\s\S]*?var\(--terr-theme-all-band[\s\S]*?\.territory-map-only \.terr-scope-swatch--global \{[\s\S]*?var\(--terr-theme-all-gradient/,
  'Territory global scope button should show the significant visible user colors in both the button body and swatch.',
);

assert.doesNotMatch(
  territoryCss,
  /terr-theme-navigator|terr-theme-chip|terr-theme-swatch|terr-theme-chip-list/,
  'Territory CSS should remove the old per-owner theme navigator styles.',
);

assert.doesNotMatch(
  territoryCss,
  /terr-leaflet-territory-pane--active-fill \.terr-land-mask-concrete-land--active:nth-of-type/,
  'Territory CSS should not palette-cycle one active Hermes account into multiple owner colors.',
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
  heatmapCss,
  /\.heatmap-page \{[\s\S]*?\.heatmap-page-map-shell \{[\s\S]*?\.heatmap-page-empty \{[\s\S]*?\.heatmap-page-empty-copy h3/,
  'Territory startup loading should rely on the existing Heatmap loading-page CSS.',
);

assert.doesNotMatch(
  territoryCss,
  /territory-route-loading|territory-loading-stage|territory-page--loading/,
  'Territory should not keep the custom route-loading card now that startup loading uses the Heatmap page.',
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
  /assert\(sample\.hasLineCommands === true,[\s\S]*?assert\(sample\.hasC === false,/,
  'Runtime proof should require exact line-command contours and reject independent cubic path smoothing.',
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
  liveSharedVerifierSource,
  /proof\.dom\.activeConcreteStyle\?\.fillRule === "nonzero"[\s\S]*?active concrete fill should use nonzero[\s\S]*?proof\.dom\.activeConcreteSubpathCount >= proof\.dom\.activeConcreteMoveCommandCount/,
  'Live shared-account proof should require nonzero active fills while allowing legitimate multi-region active territory.',
);

assert.match(
  liveSharedVerifierSource,
  /permanentZoneLabels = q\("\.terr-zone-label"\)[\s\S]*?permanentLeafletTooltips = q\("\.leaflet-tooltip-permanent"\)[\s\S]*?proof\.dom\.permanentZoneLabels === 0[\s\S]*?proof\.dom\.permanentLeafletTooltips === 0/,
  'Live shared-account proof should fail if overlap-prone permanent Territory labels or Leaflet tooltips return.',
);

assert.match(
  cellRenderVerifierSource,
  /missingCellCount === 0[\s\S]*?rendered active fill has gaps over backend-owned cells/,
  'Cell-render proof should fail when frontend SVG fill drops backend-owned active territory cells.',
);

assert.match(
  cellRenderVerifierSource,
  /wrongFillProof\.samples === 0 \|\| wrongFillProof\.p90 <= 48/,
  'Cell-render proof should fail when active fill drifts far away from backend-owned cells.',
);

assert.match(
  cellRenderVerifierSource,
  /activeCells\.length === 0[\s\S]*?frontend rendered false active territory fill without backend cells[\s\S]*?frontend rendered false active territory contour without backend cells/,
  'Cell-render proof should pass valid no-territory accounts only when the frontend renders no false active territory paths.',
);

assert.match(
  designRuntimeVerifierSource,
  /legacyMarkup: q\("\.terr-game-hud, \.terr-game-territory-dock, \.terr-theme-navigator, \.terr-game-campaign-panel"\)\.length[\s\S]*?proof\.legacyMarkup === 0/,
  'Design runtime proof should fail if old game HUD, territory dock, theme navigator, or campaign panel markup returns.',
);

assert.match(
  designRuntimeVerifierSource,
  /document\.querySelectorAll\("\.terr-scope-button"\)\.length === 2[\s\S]*?proof\.switcher\.centerDelta <= 12[\s\S]*?proof\.buttons\.length === 2/,
  'Design runtime proof should require the centered two-button Own/Global territory switcher.',
);

assert.match(
  liveSharedVerifierSource,
  /match\(\/\[MLHVQCZ\][\s\S]*?token === "L"[\s\S]*?token === "H"[\s\S]*?token === "V"/,
  'Live shared-account proof should parse exact line-command SVG paths before checking active territory fill winding.',
);

assert.match(
  liveSharedVerifierSource,
  /if \(proof\.activeBackendCells > 0\)[\s\S]*?proof\.dom\.activeConcreteStyle\?\.fillRule === "nonzero"[\s\S]*?else \{[\s\S]*?open routes should not be returned as active territory polygons[\s\S]*?rendered false active territory fill paths[\s\S]*?rendered false active territory contours/,
  'Live shared-account proof should require real fills only when backend land cells exist and reject false territory for open-route-only accounts.',
);

assert.match(
  runtimeVerifierSource,
  /activeContours = q\('\.terr-land-mask-contour--active'\)[\s\S]*?activeConcreteLands = q\('\.terr-land-mask-concrete-land--active'\)[\s\S]*?assert\(proof\?\.activeContours > 0[\s\S]*?sample\.strokeWidth === \(isActive \? '2' : '0\.8'\)[\s\S]*?sample\.strokeOpacity === \(isActive \? '0\.86' : '0\.2'\)/,
  'Runtime proof should require active territory classes and a crisp active contour that remains stronger than rival territory.',
);

assert.match(
  runtimeVerifierSource,
  /function readExactContourAlignmentProof\(\)[\s\S]*?activeConcreteBox: combinedBox\(activeConcrete\(\)\)[\s\S]*?activeContourBox: combinedBox\(activeContours\(\)\)[\s\S]*?map\.setZoom\(lowZoom, \{ animate: false \}\)[\s\S]*?map\.setZoom\(highZoom, \{ animate: false \}\)[\s\S]*?assertContourFillBoxesAligned\(sample\.activeConcreteBox, sample\.activeContourBox/,
  'Runtime proof should zoom the map and verify the active contour box remains aligned with the active concrete fill box.',
);

assert.match(
  runtimeVerifierSource,
  /const activeContourSample = proof\.contourSample\.find\(\(sample\) => sample\.className\.includes\('terr-land-mask-contour--active'\)\);[\s\S]*?assert\(activeContourSample,[\s\S]*?assert\(activeContourSample\.strokeWidth === '2'[\s\S]*?assert\(activeContourSample\.strokeOpacity === '0\.86'/,
  'Runtime proof should explicitly sample the crisp active contour stroke, not only count active paths.',
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
  /proof\?\.activeFields === 0[\s\S]*?proof\?\.rivalFields === 0[\s\S]*?territoryColorMetrics\.generated\.colored\.pixelRatio >= 0\.001/,
  'Runtime proof should reject synthetic territory fields while requiring visible real concrete filled land.',
);

assert.match(
  runtimeVerifierSource,
  /function measureImageTerritorySeams\(imageFile\)[\s\S]*?betweenTerritoryDarkPerColored[\s\S]*?compareTerritorySeamsToReference\(screenshotResult\.path\)[\s\S]*?betweenTerritoryDarkPerColored <= 0\.14/,
  'Runtime proof should reject obvious dark cracks between concrete territories without treating intentional unclaimed gaps as helper-layer regressions.',
);

assert.match(
  runtimeVerifierSource,
  /sample\.hasLineCommands === true[\s\S]*?sample\.hasC === false[\s\S]*?assertContourFillBoxesAligned\(proof\.activeConcreteLandBox, proof\.activeContourBox[\s\S]*?readExactContourAlignmentProof/,
  'Runtime proof should verify concrete borders use exact line-command contours aligned with the concrete fill.',
);

assert.match(
  runtimeVerifierSource,
  /const browserProofMode = process\.env\.TERRITORY_PROOF_BROWSER === 'browser' \? 'browser' : 'playwright';[\s\S]*?const proofUrl = normalizeProofUrl\(argValue\('--url', fixtureProofUrl\)\);[\s\S]*?const proofMode = process\.argv\.includes\('--url'\) \? 'real-runtime-url' : 'fixture-server';[\s\S]*?function normalizeProofUrl\(value\)[\s\S]*?parsed\.pathname = '\/territory';/,
  'Runtime proof should default to Playwright and normalize bare authenticated runtime URLs to the Territory page.',
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

assert.doesNotMatch(
  source,
  /if \(!hasCellMaskPolygon\(poly\) && hasCoordinatePolygon\(poly\)\) \{[\s\S]*?contourRenderEntries\.push/,
  'Territory should not render coordinate fallback polygons as owned land because they can create fake open-route wedges.',
);

assert.doesNotMatch(
  source,
  /function territoryCellFallbackPolygons|function ownsTerritoryCell/,
  'Territory should not keep /api/territory cell fallback helpers on the concrete territory page.',
);

assert.match(
  source,
  /const polygons = useMemo\(\(\) => \{[\s\S]*?const backendPolygons = Array\.isArray\(polygonData\?\.polygons\)[\s\S]*?if \(polygonData === undefined\) \{[\s\S]*?return \[\];[\s\S]*?return backendPolygons;[\s\S]*?\}, \[polygonData\]\);/,
  'Territory should render only backend concrete masks, not broad shell territory cells, when polygon data is empty or warming.',
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
  /polygons=\{polygons\}[\s\S]*?cachedRenderSnapshot=\{cachedRenderSnapshot\}[\s\S]*?showPolygons=\{polygons\.length > 0 \|\| hasCachedRenderSnapshot\}/,
  'Territory should paint only when backend polygon masks or backend-derived cached render snapshots are present instead of falling back to broad territory cells.',
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
  'Territory should not restore the old route-highlight helper; backend routeTraces must stay inside bounded concrete geometry repair.',
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
  /connectOwnerMaskTiles|displayTiles|gridLineBetweenTiles/,
  'Territory should not synthesize explicit bridge corridors between disconnected same-owner land components.',
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
  /\[polygons, polygonSignature, cachedRenderSnapshot, showPolygons, mapReady, mapViewportKey, recenterSignal, selectedOwnerKey, focusOwnerKey, focusSignal, lang\]/,
  'Polygon layer effect should rerun after mapReady flips true, when cached data changes, when the viewport changes, when recenter or scope focus changes, and when language changes for territory path labels.',
);

assert.match(
  source,
  /const lastRenderedTerritoryOwnerSetKeyRef = useRef\(''\);[\s\S]*?const lastRenderedTerritoryGeometryKeyRef = useRef\(''\);[\s\S]*?const targetOwnerSetKey = territoryRenderOwnerSetKey\(contourRenderEntries\);[\s\S]*?const stableViewportGeometryKey = shouldUseGlobalRenderCache && polygonSignature[\s\S]*?\? 'global-stable'[\s\S]*?: \(mapViewportKey \|\| 'initial'\);[\s\S]*?const geometryKey = \[[\s\S]*?polygonSignature \|\| 'no-signature'[\s\S]*?hasRawPolygons \? 'raw' : 'cached'[\s\S]*?stableViewportGeometryKey[\s\S]*?recenterSignal[\s\S]*?lang \|\| 'en'[\s\S]*?polygonLayerRef\.current[\s\S]*?targetOwnerSetKey === lastRenderedTerritoryOwnerSetKeyRef\.current[\s\S]*?geometryKey === lastRenderedTerritoryGeometryKeyRef\.current[\s\S]*?applyTerritoryOwnerFocusClasses\(polygonLayerRef\.current, selectedOwnerKeyValue\);[\s\S]*?return;/,
  'Territory scope rerenders should reuse the existing Leaflet layer and keep Global geometry stable when zoom changes without changing owners.',
);

assert.match(
  source,
  /const previousLayer = polygonLayerRef\.current;[\s\S]*?const layer = L\.layerGroup\(\)\.addTo\(map\);[\s\S]*?paintLandRegions\(rivalEntries, renderers\.rivalFill\);[\s\S]*?paintContourRegions\(activeEntries, renderers\.activeContour\);[\s\S]*?if \(previousLayer && previousLayer !== layer\) \{[\s\S]*?previousLayer\.remove\(\);[\s\S]*?\}/,
  'Territory should paint replacement layers before removing the previous layer so zoom-driven viewport recalculation cannot flash blank territory.',
);

assert.doesNotMatch(
  source,
  /if \(polygonLayerRef\.current\) \{\s*polygonLayerRef\.current\.remove\(\);\s*polygonLayerRef\.current = null;\s*\}\s*const layer = L\.layerGroup\(\)\.addTo\(map\);/,
  'Territory should not remove the current Leaflet territory layer before the replacement layer is painted.',
);

assert.match(
  source,
  /lastFittedConcreteBoundsKeyRef[\s\S]*?lastFittedConcreteIntentKeyRef[\s\S]*?lastFittedConcreteActionKeyRef[\s\S]*?lastFittedConcreteSourceKeyRef[\s\S]*?viewportMovedAfterFitRef[\s\S]*?programmaticFitInProgressRef[\s\S]*?const focusOwnerKeyValue = String\(focusOwnerKey \|\| ''\);[\s\S]*?const selectedEntries = selectedOwnerKeyValue[\s\S]*?const focusedEntries = selectedEntries\.length > 0[\s\S]*?focusOwnerKeyValue \? contourRenderEntries\.filter\(\(entry\) => entry\.ownerKey === focusOwnerKeyValue\) : \[\][\s\S]*?const boundsCoords = focusedEntries\.length > 0[\s\S]*?territoryOwnerFocusBoundsCoords\(focusedEntries\)[\s\S]*?territoryDefaultBoundsCoords\(contourRenderEntries, allCoords\);[\s\S]*?const focusKey = selectedOwnerKeyValue \|\| \(focusOwnerKeyValue \? `focus:\$\{focusOwnerKeyValue\}` : 'all'\);[\s\S]*?const boundsKey = `\$\{focusKey\}:\$\{focusSignal\}:\$\{territoryBoundsKey\(bounds\)\}`;[\s\S]*?const fitActionKey = `\$\{focusKey\}:\$\{focusSignal\}:\$\{recenterSignal\}`;[\s\S]*?const fitSourceKey = polygonSignature \|\| 'no-signature';[\s\S]*?const fitActionChanged = lastFittedConcreteActionKeyRef\.current !== fitActionKey;[\s\S]*?const fitSourceChanged = lastFittedConcreteSourceKeyRef\.current !== fitSourceKey;[\s\S]*?const actualFocusOrRecenterIntent = lastFittedConcreteActionKeyRef\.current !== null && fitActionChanged;[\s\S]*?const manualViewportLocksFit = viewportMovedAfterFitRef\.current[\s\S]*?&& lastFittedConcreteBoundsKeyRef\.current !== null[\s\S]*?&& recenterSignal <= 0[\s\S]*?&& !actualFocusOrRecenterIntent;[\s\S]*?const shouldFitConcreteBounds = !manualViewportLocksFit && \([\s\S]*?lastFittedConcreteBoundsKeyRef\.current === null[\s\S]*?\|\| fitActionChanged[\s\S]*?\|\| \(fitSourceChanged && !viewportMovedAfterFitRef\.current\)[\s\S]*?\);[\s\S]*?programmaticFitInProgressRef\.current = true;[\s\S]*?lastFittedConcreteBoundsKeyRef\.current = boundsKey;[\s\S]*?lastFittedConcreteIntentKeyRef\.current = fitIntentKey;[\s\S]*?lastFittedConcreteActionKeyRef\.current = fitActionKey;[\s\S]*?lastFittedConcreteSourceKeyRef\.current = fitSourceKey;[\s\S]*?viewportMovedAfterFitRef\.current = false;/,
  'Territory should fit on first paint, safe source refreshes, recenter, and Own/Global focus intent changes without snapping back after viewport movement.',
);

assert.match(
  source,
  /const concreteLandRegionGroups = limitMaskRegionGroupsByLoopBudget\([\s\S]*?visibleMaskLandRegionGroups\(componentRecords, regionOptions\),[\s\S]*?\);[\s\S]*?const concreteLandRegions = visibleMaskStrokeRegions\(concreteLandRegionGroups\.flat\(\), \{ cosLat \}\);[\s\S]*?concreteLandRegions\.forEach\(\(region\) => \{[\s\S]*?region\.forEach\(\(coord\) => allCoords\.push\(coord\)\);[\s\S]*?\}\);/,
  'Territory should fit bounds from the grouped concrete regions it actually paints, not only from exact mask loops.',
);

assert.match(
  source,
  /const applyConcreteBounds = \(\) => \{[\s\S]*?const redrawConcreteLayer = \(\) => \{[\s\S]*?childLayer\.redraw\(\);[\s\S]*?map\.invalidateSize\(\{ pan: false \}\);[\s\S]*?map\.once\('moveend', redrawConcreteLayer\);[\s\S]*?if \(recenterSignal > 0\)[\s\S]*?map\.flyToBounds\(bounds,[\s\S]*?else if \(focusedEntries\.length > 0\)[\s\S]*?map\.fitBounds\(bounds, \{ padding: \[76, 76\], maxZoom: 14, animate: false \}\);[\s\S]*?else[\s\S]*?map\.fitBounds\(bounds,[\s\S]*?lastFittedConcreteBoundsKeyRef\.current = boundsKey;[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?window\.requestAnimationFrame\(redrawConcreteLayer\);[\s\S]*?window\.setTimeout\(redrawConcreteLayer, 260\);[\s\S]*?applyConcreteBounds\(\);/,
  'Territory concrete-bounds fit should run immediately after paint and redraw Leaflet vectors after movement so scope switches cannot leave M0 paths.',
);

assert.match(
  source,
  /map\.flyToBounds\(bounds, \{[\s\S]*?padding: focusedEntries\.length > 0 \? \[76, 76\] : \[34, 34\],[\s\S]*?duration: focusedEntries\.length > 0 \? 0\.65 : 0\.8,[\s\S]*?\}\);[\s\S]*?map\.fitBounds\(bounds, \{ padding: \[76, 76\], maxZoom: 14, animate: false \}\);[\s\S]*?map\.fitBounds\(bounds, \{ padding: \[34, 34\], maxZoom: 12, animate: false \}\);[\s\S]*?map\.setZoom\(Math\.min\(map\.getZoom\(\), 12\), \{ animate: false \}\)/,
  'Territory automatic global concrete-bounds fit should clamp to zoom 12 while focused owner buttons fit immediately and explicit recenter may animate closer.',
);

assert.match(
  source,
  /function ensureActiveConcretePathsInView\(map\)[\s\S]*?terr-land-mask-concrete-land--active[\s\S]*?const currentZoom = Number\(map\.getZoom\?\.\(\)\);[\s\S]*?currentZoom < 12[\s\S]*?map\.setZoom\(12, \{ animate: false \}\)[\s\S]*?if \(recenterSignal === 0 && selectedOwnerKeyValue && activeEntries\.length > 0\)[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?ensureActiveConcretePathsInView\(map\);[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?ensureActiveConcretePathsInView\(map\);[\s\S]*?\}, 450\)/,
  'Territory should perform active-path visibility guards only in own/selected-owner scope and never zoom out local park viewports.',
);

console.log('[PASS] Territory backend wiring guard passed.');
