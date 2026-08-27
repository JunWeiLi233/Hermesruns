import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heatmapSource = readFileSync(path.join(here, 'Heatmap.jsx'), 'utf8');
const heatmapCacheSource = readFileSync(path.join(here, 'heatmapCache.js'), 'utf8');
const heatmapRenderPoolSource = readFileSync(path.join(here, 'heatmapRenderPointPool.js'), 'utf8');
const heatmapStyleSource = readFileSync(path.join(here, '../styles/_split/heatmap.css'), 'utf8');

assert.match(
  heatmapStyleSource,
  /\.heatmap-page-filter-pill\.is-active\s*\{[\s\S]*?background:\s*rgba\(255,\s*142,\s*126,\s*0\.22\);[\s\S]*?color:\s*#9b3f33;/,
  'Heatmap active filter pills should use a light-red highlight treatment.',
);

assert.match(
  heatmapSource,
  /const points = useMemo\([\s\S]*?normalizePointSpeedRatios\(Array\.isArray\(heatmap\?\.points\) \? heatmap\.points : \[\]\)[\s\S]*?\[heatmap\?\.points\][\s\S]*?\);/,
  'Heatmap should memoize its normalized GPS point collection so viewport updates do not rebuild the map instance and cause flashing.',
);

assert.match(
  heatmapSource,
  /const \{ isAuthenticated, authHydrated, email: authEmail \} = useAuth\(\);/,
  'Heatmap should read auth hydration and account email state before deciding whether to redirect or cache heatmap GPS data.',
);

assert.match(
  heatmapSource,
  /if \(!authHydrated\) \{\s*return;\s*\}\s*if \(!isAuthenticated\) \{\s*navigate\('\/login'\);/,
  'Heatmap should wait for URL/local token hydration before redirecting to login.',
);

assert.match(
  heatmapSource,
  /if \(!authHydrated \|\| !isAuthenticated\) return undefined;/,
  'Heatmap should not request heatmap data until auth hydration has completed and should rerun if the authenticated account changes.',
);

assert.match(
  heatmapSource,
  /}, \[hasBounds, heatmapState\]\);/,
  'Heatmap map-mount effect should not remount while progressive GPS pages append or bounds object identity changes.',
);
assert.match(
  heatmapSource,
  /const boundsRef = useRef\(null\);[\s\S]*?const hasBounds = Boolean\(bounds\);[\s\S]*?boundsRef\.current = bounds;[\s\S]*?if \(!mapRef\.current \|\| !boundsRef\.current \|\| !hasBounds \|\| heatmapState !== 'ready'\) return undefined;[\s\S]*?const latestBounds = boundsRef\.current;[\s\S]*?latestBounds\.minLatitude/,
  'Heatmap should keep latest bounds in a ref so Leaflet is not torn down during fast zoom when GPS payloads update.',
);

assert.match(
  heatmapRenderPoolSource,
  /export function isValidGpsCoordinate\(latitude, longitude\) \{[\s\S]*?latitude >= -90[\s\S]*?latitude <= 90[\s\S]*?longitude >= -180[\s\S]*?longitude <= 180/,
  'Heatmap should reject out-of-range coordinates before drawing GPS dots.',
);
assert.match(
  heatmapSource,
  /import \{ buildHeatmapRenderPointPool, isValidGpsCoordinate \} from '\.\/heatmapRenderPointPool';/,
  'Heatmap should share the validated render-pool coordinate guard with the map canvas.',
);
assert.match(
  heatmapSource,
  /function getGpsDotStyle\(speedRatio\) \{[\s\S]*?radius: 1\.65,[\s\S]*?fillOpacity: 0\.92,[\s\S]*?opacity: 0\.38,[\s\S]*?weight: 0\.48,/,
  'Heatmap GPS dot style should use a stable screen-space radius and opacity instead of changing dot design when the zoom level changes.',
);
assert.doesNotMatch(
  heatmapSource,
  /normalizedZoom|normalizedZoom - 8|getGpsDotStyle\(speedRatio, zoom\)/,
  'Heatmap GPS dot style should not depend on zoom-specific radius or opacity formulas.',
);
assert.doesNotMatch(
  heatmapSource,
  /heatmap-sessions-card|heatmap-sessions-list|visibleRuns|viewBounds/,
  'Heatmap should not retain the removed viewport sessions drawer or its viewport activity matching state.',
);
assert.doesNotMatch(
  heatmapSource,
  /heatmap-page-legend-meta|page_center_label|page_density_label|page_gps_received_label/,
  'Heatmap should keep the legend focused on route colors instead of rendering the three summary grids.',
);
assert.doesNotMatch(
  heatmapSource,
  /run\.startLatitude|run\.startLongitude/,
  'Heatmap should not depend on startLatitude/startLongitude because the activity feed item does not expose those fields.',
);
assert.match(
  heatmapSource,
  /function normalizeRawHeatPoint\(point\) \{[\s\S]*?Array\.isArray\(point\)[\s\S]*?activityId: Number\(point\[0\]\)[\s\S]*?latitude: Number\(point\[1\]\)[\s\S]*?longitude: Number\(point\[2\]\)[\s\S]*?speedRatio: Number\(point\[3\]\)/,
  'Heatmap should accept compact backend GPS point arrays without dropping coordinates.',
);
assert.match(
  heatmapSource,
  /function normalizeHeatPointForRender\(point\)[\s\S]*?visualSpeedRatio: Number\.isFinite\(speedRatio\) \? clamp\(speedRatio, 0, 1\) : 0\.5/,
  'Heatmap should normalize compact array points once while receiving pages.',
);
assert.match(
  heatmapSource,
  /if \(points\[0\] && Number\.isFinite\(points\[0\]\.visualSpeedRatio\)\) return points;/,
  'Heatmap should not re-normalize the full all-points payload after background loading completes.',
);
assert.match(
  heatmapSource,
  /function buildMergedHeatmapPayload\(basePayload, points, loadPhase = 'complete'\)[\s\S]*?loadPhase,[\s\S]*?complete: hasCompleteGps/,
  'Heatmap should carry an explicit GPS load phase so coverage previews are not presented as full received totals.',
);
assert.match(
  heatmapSource,
  /HEATMAP_REQUEST_TIMEOUT_MS = 120000/,
  'Heatmap all-point fetch should not use the old short timeout that aborts large GPS payloads.',
);
assert.match(
  heatmapSource,
  /const HEATMAP_INITIAL_PAGE_SIZE = 5000;[\s\S]*?HEATMAP_BACKGROUND_PAGE_SIZE = 100000;[\s\S]*?fetchHeatmapPage\(offset, nextLimit, signal\)[\s\S]*?HEATMAP_BACKGROUND_PAGE_SIZE/,
  'Heatmap should render a small first GPS page, then continue loading remaining GPS pages in the background.',
);
assert.doesNotMatch(
  heatmapSource,
  /HEATMAP_INITIAL_COVERAGE_LIMIT|fetchHeatmapCoverage|coverage=true/,
  'Heatmap initial loading should not launch the full-dataset coverage window query alongside the paged GPS load.',
);
assert.match(
  heatmapSource,
  /fetchCompleteHeatmap\(heatmapController\.signal, \(partialHeatmap\) => \{[\s\S]*?setHeatmap\(partialHeatmap\);[\s\S]*?setHeatmapState\('ready'\);/,
  'Heatmap should switch to ready state on the first progressive page instead of waiting for every GPS point.',
);
assert.match(
  heatmapCacheSource,
  /HEATMAP_CACHE_MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/,
  'Heatmap should retain a bounded age for complete GPS payloads.',
);
assert.match(
  heatmapCacheSource,
  /HEATMAP_CACHE_DB_NAME = 'hermes_heatmap_cache_v1'[\s\S]*?HEATMAP_CACHE_STORE_NAME = 'heatmaps'[\s\S]*?HEATMAP_CACHE_DB_VERSION = 1/,
  'Heatmap should define a durable IndexedDB cache for complete GPS payloads.',
);
assert.match(
  heatmapCacheSource,
  /function getHeatmapCacheKey\(accountEmail\) \{[\s\S]*?typeof accountEmail === 'string'[\s\S]*?accountEmail\.trim\(\)\.toLowerCase\(\)[\s\S]*?profile-heatmap:\$\{normalizedEmail\}/,
  'Heatmap cache should be keyed from the authenticated account email so every official-site user gets an isolated cache.',
);
assert.match(
  heatmapCacheSource,
  /function openHeatmapCacheDb\(\)[\s\S]*?window\.indexedDB\.open\(HEATMAP_CACHE_DB_NAME, HEATMAP_CACHE_DB_VERSION\)[\s\S]*?createObjectStore\(HEATMAP_CACHE_STORE_NAME, \{ keyPath: 'key' \}\)/,
  'Heatmap should use IndexedDB instead of localStorage for large GPS point caches.',
);
assert.match(
  heatmapSource,
  /import \{[\s\S]*?HEATMAP_CACHE_STORE_NAME,[\s\S]*?openHeatmapCacheDb,[\s\S]*?getHeatmapCacheKey,[\s\S]*?\} from '\.\/heatmapCache';/,
  'Heatmap should use the shared cache module so deletion can invalidate the same record it reads.',
);
assert.match(
  heatmapSource,
  /function markCachedHeatmapPayload\(payload, savedAt\)[\s\S]*?loadPhase: 'cachedComplete'[\s\S]*?complete: true[\s\S]*?cacheHit: true/,
  'Heatmap should mark cached complete GPS payloads distinctly from partial preview pages.',
);
assert.match(
  heatmapSource,
  /const cacheKey = getHeatmapCacheKey\(authEmail\);[\s\S]*?const cachedHeatmap = await readCachedHeatmapPayload\(cacheKey\)\.catch\(\(\) => null\);[\s\S]*?setHeatmap\(cachedHeatmap\);[\s\S]*?setHeatmapState\('ready'\);[\s\S]*?getHeatmapCacheFreshnessTier\(cachedHeatmap\.diagnostics\?\.cacheSavedAt\) === 'fresh'[\s\S]*?return;[\s\S]*?if \(cancelled \|\| hasRenderableDataRef\.current\) return;[\s\S]*?scheduleHeatmapCacheWrite\(cacheKey, completeHeatmap\);/,
  'Heatmap should render a cached complete GPS payload immediately and short-circuit the network refetch while the cache is fresh; older-but-valid caches refresh silently and only complete results rewrite the cache.',
);
assert.match(
  heatmapSource,
  /if \(!database \|\| !key \|\| !payload \|\| payload\.diagnostics\?\.complete === false \|\| !Array\.isArray\(payload\.points\)\)/,
  'Heatmap cache writes should reject missing keys, partial payloads, and non-point payloads.',
);
assert.match(
  heatmapSource,
  /const firstProgress = buildMergedHeatmapPayload\(firstPagePayload, points\.slice\(\), 'recentPreview'\);[\s\S]*?onProgress\(firstProgress\);[\s\S]*?fetchHeatmapPagesWithBounds\(/,
  'Heatmap should publish the first page immediately and avoid React updates for every background page.',
);
assert.match(
  heatmapSource,
  /HEATMAP_PREVIEW_RENDER_POINT_LIMIT = 3500[\s\S]*?HEATMAP_FULL_RENDER_POINT_LIMIT = 12000[\s\S]*?latestFullRenderPointsRef\.current = buildHeatmapRenderPointPool\(points, HEATMAP_FULL_RENDER_POINT_LIMIT\);[\s\S]*?latestPreviewRenderPointsRef\.current = buildHeatmapRenderPointPool\([\s\S]*?latestFullRenderPointsRef\.current,[\s\S]*?HEATMAP_PREVIEW_RENDER_POINT_LIMIT,?[\s\S]*?\);[\s\S]*?const renderPoints = renderMode === 'preview'[\s\S]*?latestPreviewRenderPointsRef\.current[\s\S]*?latestFullRenderPointsRef\.current[\s\S]*?for \(const point of renderPoints\)/,
  'Heatmap canvas should draw from capped preview/full render pools so zoom never scans the full GPS array, and build the full-array pool only once per update.',
);
assert.match(
  heatmapRenderPoolSource,
  /const buckets = new Map\(\)[\s\S]*?sampleBucket\([\s\S]*?selectedEntries[\s\S]*?sort\(\(left, right\) => left\.index - right\.index\)/,
  'Heatmap render pools should allocate samples per activity and preserve source order instead of using one global stride.',
);
assert.doesNotMatch(
  heatmapRenderPoolSource,
  /const stride = Math\.max\(1, Math\.ceil\(points\.length \/ cappedLimit\)\)/,
  'Heatmap render pools should not drop an entire small activity because of global index stride sampling.',
);
assert.doesNotMatch(
  heatmapSource,
  /for \(const point of latestPointsRef\.current\)|for \(let index = 0; index < allPoints\.length; index \+= stride\)/,
  'Heatmap zoom rendering should not iterate the full GPS array during canvas paints.',
);
assert.match(
  heatmapSource,
  /HEATMAP_CANVAS_PADDING = 0\.25[\s\S]*?HEATMAP_CANVAS_PIXEL_RATIO_CAP = 1\.5[\s\S]*?const pixelRatio = Math\.min\(window\.devicePixelRatio \|\| 1, HEATMAP_CANVAS_PIXEL_RATIO_CAP\)/,
  'Heatmap should cap its padded Retina backing store so zoom animation does not composite oversized canvas textures.',
);
assert.match(
  heatmapSource,
  /HEATMAP_FULL_DRAW_CHUNK_SIZE = 640[\s\S]*?const bufferCanvas = document\.createElement\('canvas'\)[\s\S]*?const bufferContext = bufferCanvas\.getContext\('2d'\)[\s\S]*?const commitCanvasLayout = \(\) => \{[\s\S]*?L\.DomUtil\.setPosition\(dotCanvas, canvasLayerOrigin\)[\s\S]*?canvasViewState = \{ center, zoom \}[\s\S]*?const drawFullChunk = \(deadline\) => \{[\s\S]*?scheduleFullDrawChunk\(drawFullChunk\)[\s\S]*?commitCanvasLayout\(\);[\s\S]*?dotContext\.drawImage\(bufferCanvas, 0, 0\);/,
  'Heatmap full GPS redraws should keep the transformed frame visible and commit the new layout only when the offscreen replacement is complete.',
);
assert.match(
  heatmapSource,
  /const scheduleZoomStart = \(\) => \{[\s\S]*?cancelAnimationFrame\(drawFrameId\)[\s\S]*?cancelFullDraw\(\)[\s\S]*?zoomSettleTimeoutId = window\.setTimeout\(finishZoomRender, 480\);[\s\S]*?destroy: \(\) => \{[\s\S]*?cancelFullDraw\(\);/,
  'Heatmap should cancel stale chunked full redraw work on zoom start and unmount.',
);assert.doesNotMatch(
  heatmapSource,
  /requestAnimationFrame\(drawFullChunk\)|cancelAnimationFrame\(fullDrawFrameId\)/,
  'Heatmap full GPS redraw chunks should not run on animation frames because that competes with zoom animation.',
);
assert.match(
  heatmapSource,
  /latestPointsRef\.current = points;[\s\S]*?const renderMode = heatmap\?\.diagnostics\?\.complete === false \? 'preview' : 'full';[\s\S]*?requestAnimationFrame\(\(\) => overlay\.syncRouteDots\(renderMode\)\)[\s\S]*?}, \[heatmap\?\.diagnostics\?\.complete, points\]\);[\s\S]*?}, \[hasBounds, heatmapState\]\);/,
  'Heatmap should use preview redraws while GPS pages append and reserve full redraws for complete payloads without remounting Leaflet on bounds object changes.',
);
assert.doesNotMatch(
  heatmapSource,
  /paintZoomRadiusCompensatedDots|getDotCanvasAnimatedScale|getZoomStableRenderPoints|startZoomRadiusCompensation|activeCanvasLayerOrigin|zoomDotFrameId/,
  'Heatmap should not repaint GPS dots during Leaflet zoom animation because canvas redraws can desync the dot layer from map tiles.',
);
assert.match(
  heatmapSource,
  /const finishZoomRender = \(\) => \{[\s\S]*?isZoomingMap = false;[\s\S]*?zoomAnimationActiveRef\.current = false;[\s\S]*?scheduleRouteDots\('full'\);[\s\S]*?const scheduleZoomEnd = \(\) => \{[\s\S]*?const queuedZoomDelta = queuedZoomStepsRef\.current;[\s\S]*?queuedZoomStepsRef\.current = 0;[\s\S]*?if \(queuedZoomDelta === 0\) \{[\s\S]*?finishZoomRender\(\);[\s\S]*?return;[\s\S]*?const nextZoom = clamp\(map\.getZoom\(\) \+ queuedZoomDelta[\s\S]*?map\.setZoom\(nextZoom, \{ animate: true \}\)/,
  'Heatmap zooming should skip intermediate redraws and coalesce queued clicks into one follow-up animation before the atomic full repaint.',
);
assert.doesNotMatch(
  heatmapSource,
  /HEATMAP_FULL_REDRAW_DELAY_MS|fullRedrawTimeoutId/,
  'Heatmap zooming should not use the old delayed full-redraw path that can stutter after zoom.',
);
assert.match(
  heatmapSource,
  new RegExp(String.raw`wheelDebounceTime: 24[\s\S]*?wheelPxPerZoomLevel: 96[\s\S]*?zoomAnimation: true[\s\S]*?zoomAnimationThreshold: 1[\s\S]*?fadeAnimation: false[\s\S]*?markerZoomAnimation: false[\s\S]*?preferCanvas: true[\s\S]*?updateWhenZooming: false[\s\S]*?updateWhenIdle: false[\s\S]*?updateInterval: 250[\s\S]*?keepBuffer: 2[\s\S]*?className: 'heatmap-page-dark-tile-layer'[\s\S]*?errorTileUrl: 'data:image/svg\+xml,`),
  'Heatmap should animate one-level zooms only, throttle tile updates, retain a bounded buffer, and use a dark fallback during zoom.',
);
assert.match(
  heatmapSource,
  /keepBuffer: 2,\s*noWrap: true,\s*className: 'heatmap-page-dark-tile-layer'/,
  'Heatmap basemap tiles should render a single unwrapped world instead of repeating duplicate maps side by side.',
);
assert.match(
  heatmapSource,
  /World_Dark_Gray_Base\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}[\s\S]*?World_Dark_Gray_Reference\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}/,
  'Heatmap should render the keyless Esri Dark Gray basemap (base + labels) so tiles never degrade into API-key watermarks.',
);
assert.doesNotMatch(
  heatmapSource,
  /basemaps\.cartocdn\.com|dark_all|dark_nolabels/,
  'Heatmap must not load CARTO basemaps anonymously because they now render an API KEY REQUIRED watermark tile.',
);
assert.match(
  heatmapSource,
  /maxNativeZoom: 16,/,
  'Heatmap tile layers should declare the Esri Dark Gray native zoom ceiling so deeper zooms upscale instead of 404ing.',
);
assert.match(
  heatmapSource,
  /maxBounds: \[\[-85\.051129, -180\], \[85\.051129, 180\]\],\s*maxBoundsViscosity: 1\.0,/,
  'Heatmap map view should stay clamped to one world so panning cannot drift into the empty area beside the single map.',
);
assert.match(
  heatmapSource,
  /const zoomMap = \(delta\) => \{[\s\S]*?const zoomStep = Math\.sign\(delta\);[\s\S]*?if \(zoomAnimationActiveRef\.current\) \{[\s\S]*?queuedZoomStepsRef\.current = clamp\([\s\S]*?queuedZoomStepsRef\.current \+ zoomStep,[\s\S]*?-3,[\s\S]*?3,[\s\S]*?return;[\s\S]*?const targetZoom = clamp\(map\.getZoom\(\) \+ zoomStep, map\.getMinZoom\(\), map\.getMaxZoom\(\)\);[\s\S]*?map\.setZoom\(targetZoom, \{ animate: true \}\);/,
  'Heatmap zoom controls should queue rapid clicks and request a bounded zoom step without serializing every click.',
);
assert.match(
  heatmapSource,
  /const scheduleMoveEnd = \(\) => \{[\s\S]*?skipNextMovePreview = false;[\s\S]*?return;[\s\S]*?scheduleRouteDots\('preview'\);[\s\S]*?map\.on\('moveend', scheduleMoveEnd\);[\s\S]*?map\.on\('resize', \(\) => scheduleRouteDots\('preview'\)\);[\s\S]*?scheduleRouteDots\('preview'\);/,
  'Heatmap should keep ordinary map movement redraws on the lightweight preview pool without replacing the post-zoom full repaint.',
);
assert.doesNotMatch(
  heatmapStyleSource,
  /is-map-zooming[\s\S]*?backdrop-filter: none|is-map-zooming[\s\S]*?box-shadow: none/,
  'Heatmap zooming should not flash overlay blur or shadows on and off.',
);
assert.doesNotMatch(
  heatmapStyleSource,
  /\.heatmap-page-(?:brand-pill|search-pill|filter-pill|utility-btn|legend-card|avatar|utility-rail)[^{]*\{[^}]*backdrop-filter/,
  'Heatmap controls should not continuously backdrop-blur the moving map on laptop GPUs.',
);
assert.doesNotMatch(
  heatmapStyleSource,
  /heatmap-page-map-canvas \{[^}]*?\n\s*filter:|is-map-zooming \.heatmap-page-map-canvas[^}]*?\n\s*filter:|leaflet-zoom-animated[\s\S]*?transition: none/,
  'Heatmap should not filter the full-screen map or disable Leaflet native zoom transitions because both make zoom visibly laggy.',
);
assert.match(
  heatmapStyleSource,
  /\.heatmap-page-map-shell \{[\s\S]*?isolation: isolate;[\s\S]*?\.heatmap-page-map-canvas \{[\s\S]*?position: relative;[\s\S]*?z-index: 0;[\s\S]*?\.heatmap-page-topbar,[\s\S]*?\.heatmap-page-legend-card,[\s\S]*?\.heatmap-page-utility-rail,[\s\S]*?\.heatmap-page-empty\s*\{[\s\S]*?z-index: 30;/,
  'Heatmap overlay bars should stay above Leaflet panes without relying on expensive full-map filters.',
);
assert.doesNotMatch(
  heatmapStyleSource,
  /is-map-zooming[^{}]*heatmap-page-utility-rail[^{}]*\{[^}]*display: none|is-map-zooming[^{}]*heatmap-page-legend-card[^{}]*\{[^}]*display: none/,
  'Heatmap zoom mode should not make the visible overlay bars disappear.',
);
assert.match(
  heatmapStyleSource,
  /\.heatmap-page-map-canvas \{[\s\S]*?background: #05070a[\s\S]*?leaflet-container,[\s\S]*?leaflet-tile-pane,[\s\S]*?leaflet-tile-container,[\s\S]*?heatmap-page-dark-tile-layer[\s\S]*?background: #05070a !important[\s\S]*?leaflet-tile:not\(\.leaflet-tile-loaded\)[\s\S]*?opacity: 0 !important/,
  'Heatmap map tiles should use a dark backing and hide unloaded tile images so zooming cannot flash white.',
);

assert.match(
  heatmapStyleSource,
  /\.heatmap-page-dot-canvas \{[\s\S]*?will-change: transform[\s\S]*?backface-visibility: hidden[\s\S]*?transform: translateZ\(0\)/,
  'Heatmap GPS dot canvas should remain GPU-composited without an opacity transition during zoom.',
);
assert.doesNotMatch(
  heatmapSource,
  /dotCanvas\.style\.(?:display|opacity)/,
  'Heatmap zooming should not hide or fade GPS points while the user zooms.',
);
assert.match(
  heatmapSource,
  /dotOverlayRef\.current = \{[\s\S]*?destroy: \(\) => \{[\s\S]*?cancelAnimationFrame\(drawFrameId\)[\s\S]*?window\.clearTimeout\(zoomSettleTimeoutId\)[\s\S]*?if \(dotOverlayRef\.current\?\.destroy\) \{[\s\S]*?dotOverlayRef\.current\.destroy\(\);/,
  'Heatmap should cancel scheduled zoom animation-frame work when the map unmounts.',
);
assert.doesNotMatch(
  heatmapSource,
  /apiJson\('\/api\/profile\/heatmap', \{ signal: heatmapController\.signal \}\)/,
  'Heatmap should not rely on the old single massive GPS response.',
);
assert.match(
  heatmapStyleSource,
  /heatmap-page-gps-loading-text[\s\S]*?border-radius: 999px[\s\S]*?heatmap-page-gps-loading-signal::after[\s\S]*?animation: heatmapGpsLockPulse 1\.6s[\s\S]*?heatmap-page-gps-loading-bars > span[\s\S]*?animation: heatmapGpsSignalBar 1\.2s[\s\S]*?@keyframes heatmapGpsLockPulse[\s\S]*?@keyframes heatmapGpsSignalBar[\s\S]*?prefers-reduced-motion: reduce[\s\S]*?heatmap-page-gps-loading-bars > span/,
  'Heatmap GPS loading should use a compact lock pulse and staggered signal bars with a reduced-motion fallback.',
);

assert.doesNotMatch(
  heatmapSource,
  /gpsLoadingLabelPieces|heatmap-page-gps-loading-piece/,
  'Heatmap loading copy should remain static instead of animating every character.',
);

assert.doesNotMatch(
  heatmapSource,
  /L\.heatLayer|leaflet\.heat|buildHeatLayerPoints|getHeatLayerOptions|getGpsDotStride|getGpsDotTargetCount|L\.circleMarker|layerGroup\(\)\.addTo\(map\)/,
  'Heatmap should not draw synthetic heat-layer blobs, sample away GPS dots, or allocate one Leaflet marker per GPS point.',
);
assert.match(
  heatmapSource,
  /L\.DomUtil\.create\('canvas', 'heatmap-page-dot-canvas leaflet-zoom-animated'\)[\s\S]*?const drawProjectedPoint = \(context, projectedPoint, renderMode, radiusScale = 1\) => \{[\s\S]*?const scaledRadius = style\.radius \* radiusScale[\s\S]*?context\.arc\(projectedPoint\.x, projectedPoint\.y, scaledRadius[\s\S]*?latLngToLayerPoint\(\[point\.latitude, point\.longitude\]\)\.subtract\(canvasLayerOrigin\)/,
  'Heatmap should render all GPS dots through one canvas overlay in Leaflet layer coordinates instead of one marker per point.',
);
assert.match(
  heatmapSource,
  /const canvasLayerOrigin = layerTopLeft;[\s\S]*?L\.DomUtil\.setPosition\(dotCanvas, canvasLayerOrigin\);[\s\S]*?const projected = map\.latLngToLayerPoint\(\[point\.latitude, point\.longitude\]\)\.subtract\(canvasLayerOrigin\);/,
  'Heatmap canvas dots should share the same Leaflet layer origin as the positioned canvas so they stay attached to the map after zoom.',
);
assert.match(
  heatmapSource,
  /const projectedPoints = \[\];[\s\S]*?latLngToLayerPoint\(\[point\.latitude, point\.longitude\]\)\.subtract\(canvasLayerOrigin\)[\s\S]*?drawProjectedPoint\(bufferContext, projectedPoints\[pointIndex\], 'full'\)/,
  'Heatmap chunked full redraws should draw precomputed layer-space positions so idle callbacks interrupted by zoom or pan cannot mix two view states into one frame.',
);
assert.doesNotMatch(
  heatmapSource,
  /latLngToContainerPoint\(\[point\.latitude, point\.longitude\]\)/,
  'Heatmap dot projection should not use container coordinates inside Leaflet overlayPane because zoom transforms can offset the canvas.',
);

assert.match(
  heatmapSource,
  /function getGpsDotStyle\(speedRatio\) \{[\s\S]*?const speedBand = getSpeedBand\(speedRatio\);[\s\S]*?radius: 1\.65,[\s\S]*?fillOpacity: 0\.92,[\s\S]*?opacity: 0\.38,[\s\S]*?weight: 0\.48,/,
  'Heatmap should derive visible dot color from speed ratio while keeping radius, opacity, and stroke stable across zoom levels.',
);
assert.doesNotMatch(
  heatmapSource,
  /const radius = clamp\(0\.9 \+ \(\(normalizedZoom - 8\) \/ 10\) \* 1\.7|getGpsDotStyle\(speedRatio, zoom\)|weight: clamp\(radius \* 0\.28/,
  'Heatmap GPS dots should not restore zoom-dependent marker radius or stroke formulas.',
);

assert.doesNotMatch(
  heatmapSource,
  /L\.polyline\(route\.latLngs,/,
  'Heatmap should not render the visible overlay as route polylines after restoring the dot version.',
);

console.log('[PASS] Heatmap stability regression guardrails passed.');
