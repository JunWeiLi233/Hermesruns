import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, "../Runs.jsx"), 'utf8').replace(/\r\n/g, '\n');
const runsCacheSource = readFileSync(path.join(here, "../runsCache.ts"), 'utf8').replace(/\r\n/g, '\n');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8').replace(/\r\n/g, '\n');
const splitRunsStyle = readFileSync(path.join(here, "../../../styles/_split/runs.css"), 'utf8').replace(/\r\n/g, '\n');

assert.match(
  runsSource,
  /function RoutePreviewThumb\(\{ preview, provider, runName(?:, [a-zA-Z]+)* \}\)/,
  'Runs route thumbnails should consume a preview model generated from the selected route source.',
);

assert.match(
  runsSource,
  /apiJson\(`\/api\/activities\/route-previews\?\$\{params\.toString\(\)\}`\)/,
  'Runs page should batch-load visible thumbnail preview metadata through the route-previews endpoint.',
);

assert.match(
  runsSource,
  /const runsPromise = apiJson\('\/api\/activities'\)[\s\S]*?const list = Array\.isArray\(data\) \? data : \[\];[\s\S]*?list\.sort\(/,
  'Runs should normalize the direct /api/activities response to an array before sorting and rendering activity cards.',
);

assert.match(
  runsSource,
  /const ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT = 15;/,
  'Runs page should keep the initial route-preview window bounded (15 == the previous 3 + 6×2 derivation) so data-fetch volume stays unchanged while loading previews after the list paints.',
);

assert.match(
  runsSource,
  /const ROUTE_PREVIEW_PREFETCH_LOOKAHEAD = 18;/,
  'Runs page should prefetch a short route-preview lookahead (18 == the previous 6×3 derivation) beyond the visible card count.',
);

assert.match(
  runsSource,
  /async function fetchRoutePreviewBatch\(ids\)/,
  'Runs page should centralize batched route-preview fetching so initial preload and scroll hydration share one code path.',
);

assert.match(
  runsSource,
  /slice\(0,\s*ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT\)/,
  'Runs page should still request route previews for the initial history window.',
);

assert.match(
  runsSource,
  /setLoadState\('ready'\)/,
  'Runs page should explicitly flip to ready when run history data is available.',
);

assert.match(
  runsSource,
  /const routePreviewRuns = useMemo\(\s*\(\) => filteredRuns\.slice\(0,\s*Math\.min\(filteredRuns\.length,\s*visibleRunsCount \+ ROUTE_PREVIEW_PREFETCH_LOOKAHEAD\)\)/,
  'Runs page should fetch route previews for the visible window plus a short lookahead.',
);

assert.match(
  runsSource,
  /routePreviewRuns\.filter\(\(run\) => \{[\s\S]*return !hasPointPreview \|\| !hasBbox;[\s\S]*\}\)\.slice\(0,\s*50\)/,
  'Runs page should choose missing preview work from the visible window and cap each network batch to 50 ids.',
);

assert.match(
  runsSource,
  /const pointCount = Number\(entry\?\.pointCount\);/,
  'Runs page should read the batch route pointCount so it can distinguish dense GPS routes from sampled preview geometry.',
);

assert.match(
  runsSource,
  /pointCount:\s*Number\.isFinite\(pointCount\)\s*&&\s*pointCount\s*>\s*0\s*\?\s*pointCount\s*:\s*points\.length/,
  'Runs page should retain the real GPS point count on the point-derived preview model.',
);

assert.match(
  runsSource,
  /const pointPreview = routePreviewFallbacks\[run\.id\];[\s\S]*const preview = pointPreview \|\| run\.routePreview \|\| null;/,
  'Run cards should prefer the batch point-derived preview and only use feed routePreview as a temporary fallback.',
);

const requestRoutePreviewsStart = runsSource.indexOf('const requestRoutePreviews = useCallback');
const loadRunsStart = runsSource.indexOf('const loadRuns = useCallback');
assert.ok(requestRoutePreviewsStart >= 0 && loadRunsStart > requestRoutePreviewsStart, 'Runs page should define one stable route-preview request coordinator callback before loadRuns.');
const requestRoutePreviewsSource = runsSource.slice(requestRoutePreviewsStart, loadRunsStart);

assert.match(
  requestRoutePreviewsSource,
  /const requestGeneration = routePreviewRequestCoordinatorRef\.current\.getGeneration\(\);[\s\S]*let retryableIds = await routePreviewRequestCoordinatorRef\.current\.waitFor\(candidateIds\);[\s\S]*routePreviewRequestCoordinatorRef\.current\.getGeneration\(\) !== requestGeneration[\s\S]*let claim = routePreviewRequestCoordinatorRef\.current\.claimWithToken\(retryableIds\);/,
  'Runs route-preview requests should wait for every candidate owner before claiming a batch and should abandon the retry when its generation is stale.',
);

assert.match(
  requestRoutePreviewsSource,
  /while \(claim\.ids\.length !== retryableIds\.length\)[\s\S]*routePreviewRequestCoordinatorRef\.current\.release\(claim\.ids, claim\.token\)[\s\S]*await routePreviewRequestCoordinatorRef\.current\.waitFor\(pendingIds\)[\s\S]*claim = routePreviewRequestCoordinatorRef\.current\.claimWithToken\(retryableIds\)/,
  'A race during claiming should release only the partial owner and wait/retry the complete candidate set instead of fetching a partial overlap.',
);

assert.match(
  requestRoutePreviewsSource,
  /const \{ previewUpdates, bboxUpdates, terminalIds = \[\] \} = await fetchRoutePreviewBatch\(claim\.ids\);/,
  'Every route-preview request path should fetch only the IDs claimed by the shared coordinator token.',
);

assert.match(
  requestRoutePreviewsSource,
  /if \(!routePreviewRequestCoordinatorRef\.current\.isCurrent\(claim\.token\) \|\| !isCurrent\(\)\) \{[\s\S]*routePreviewRequestCoordinatorRef\.current\.release\(claim\.ids, claim\.token\);[\s\S]*return;\s*\}/,
  'A successful response ignored by a stale generation or visible effect must release only its own claims so a current effect can retry them.',
);

assert.match(
  requestRoutePreviewsSource,
  /setRoutePreviewFallbacks\(\(current\)[\s\S]*setRouteBboxes\(\(current\)[\s\S]*routePreviewRequestCoordinatorRef\.current\.settle\(\[\.\.\.claim\.ids, \.\.\.terminalIds\], claim\.token\)/,
  'The shared callback should merge preview and bbox updates before terminally settling a current successful response, including NO_ROUTE/DEFERRED results.',
);

assert.equal(
  [...requestRoutePreviewsSource.matchAll(/setRoutePreviewFallbacks\(\(current\)/g)].length,
  1,
  'Runs route-preview fallback updates should have one shared merge path.',
);

assert.equal(
  [...requestRoutePreviewsSource.matchAll(/setRouteBboxes\(\(current\)/g)].length,
  1,
  'Runs route-preview bbox updates should have one shared merge path.',
);

assert.equal(
  [...runsSource.matchAll(/fetchRoutePreviewBatch\(/g)].length,
  2,
  'Only the shared request callback should call fetchRoutePreviewBatch besides its function declaration.',
);

assert.match(
  runsSource,
  /if \(preview\) \{[\s\S]*previewUpdates\[activityId\] = preview;[\s\S]*\}/,
  'Runs page should only cache a point-derived preview fallback when the batch response produced usable geometry.',
);

assert.match(
  runsSource,
  /if \(bbox\) \{[\s\S]*bboxUpdates\[activityId\] = bbox;[\s\S]*\}/,
  'Runs page should keep bbox updates independent so map framing can improve even before every route preview is rebuilt.',
);

assert.match(
  runsSource,
  /data-run-id=\{run\.id \|\| ''\}/,
  'Run cards should expose data-run-id so browser proof can compare a thumbnail to /runs/:runId route data.',
);

assert.match(
  runsSource,
  /setStravaStatus\(cachedHit\.stravaStatus\);[\s\S]*setLoadState\('ready'\);[\s\S]*const preloadIds = sorted[\s\S]*requestRoutePreviews\(preloadIds(?:, \{ isCurrent: isCurrentLoad \})?\)/,
  'Runs page should paint cached history before prewarming route previews.',
);

assert.match(
  runsSource,
  /const cachedHit = readRunsCache\(localStorage, email, Date\.now\(\)\);\s*if \(fromCache && cachedHit && isCurrentLoad\(\)\) \{/,
  'Non-cache Runs refreshes should still read the v2 snapshot for last-known-good metadata fallback.',
);

assert.match(
  runsSource,
  /let latestProfile = [\s\S]*cachedHit\?\.profile[\s\S]*let latestStrava = [\s\S]*cachedHit\?\.stravaStatus/,
  'Runs revalidation should seed profile and Strava metadata from current state or the existing snapshot.',
);

assert.match(
  runsSource,
  /if \(isCurrentLoad\(\) && !runsFailed && latestRuns && latestProfile !== null && latestStrava !== null\)/,
  'Runs should not replace a complete cache snapshot with null metadata after a partial revalidation failure.',
);

assert.doesNotMatch(
  runsSource,
  /if \(cachedHit\) \{[\s\S]*?setLoadState\('ready'\);[\s\S]*?return;\s*\}\s*\}\s*\n\s*\/\/ Fire the three calls in parallel/,
  'A valid Runs cache hit should continue into fresh revalidation instead of returning early.',
);

assert.match(
  runsSource,
  /await apiJson\(`\/api\/activities\/\$\{run\.id\}`, [\s\S]*?invalidateRunsCache\(localStorage, email\)/,
  'Deleting a run should invalidate the cached Runs snapshot so the next visit cannot resurrect it.',
);

assert.match(
  runsSource,
  /setAllRuns\(list\);[\s\S]*setLoadState\('ready'\);[\s\S]*if \(preloadIds\.length > 0\) \{[\s\S]*requestRoutePreviews\(preloadIds(?:, \{ isCurrent: isCurrentLoad \})?\)/,
  'Runs page should paint fresh /api/activities results before route-preview enrichment finishes.',
);

assert.doesNotMatch(
  runsSource,
  /RUNS_CACHE_RUN_LIMIT|slice\(0,\s*RUNS_CACHE_RUN_LIMIT\)/,
  'Runs cache writes should not retain the old 500-row truncation.',
);

assert.match(
  runsCacheSource,
  /RUNS_CACHE_KEY_PREFIX = 'hermes_runs_v2_';[\s\S]*runs\.map\(slimRunForRunsCache\)[\s\S]*sourceCount: runs\.length[\s\S]*complete: true/,
  'Runs cache should write every slim run as a complete v2 snapshot with its source count.',
);

assert.match(
  runsCacheSource,
  /parsed\.complete !== true[\s\S]*parsed\.runs\.length !== parsed\.sourceCount/,
  'Runs cache reads should only accept complete snapshots whose source count matches the cached array.',
);

const cachePaintStart = runsSource.indexOf('if (fromCache && cachedHit && isCurrentLoad()) {');
const freshActivitiesStart = runsSource.indexOf("const runsPromise = apiJson('/api/activities')");
assert.ok(cachePaintStart >= 0 && freshActivitiesStart > cachePaintStart, 'Runs cache paint should be defined before fresh activity revalidation.');
const cacheToRevalidationSource = runsSource.slice(cachePaintStart, freshActivitiesStart);
assert.match(cacheToRevalidationSource, /setAllRuns\(sorted\);[\s\S]*setProfile\(cachedHit\.profile\);[\s\S]*setStravaStatus\(cachedHit\.stravaStatus\);[\s\S]*setLoadState\('ready'\);/);
const cacheHitBlock = cacheToRevalidationSource.match(/if \(fromCache && cachedHit && isCurrentLoad\(\)\) \{[\s\S]*?\n\s{6}\}\n\s{4}\}/)?.[0] || '';
assert.ok(cacheHitBlock, 'Runs cache paint should have a recognizable guarded cache-hit block.');
assert.doesNotMatch(cacheHitBlock, /\breturn;/, 'A valid cache hit should not return before fresh activity revalidation starts.');

assert.match(
  runsSource,
  /if \(isCurrentLoad\(\) && !runsFailed && latestRuns && latestProfile !== null && latestStrava !== null\) \{\s*writeRunsCache\(localStorage, email, latestRuns, latestProfile, latestStrava, Date\.now\(\)\);\s*\}/,
  'Fresh activity responses should rewrite the complete slim Runs cache.',
);

assert.match(
  runsSource,
  /const resetRoutePreviewState = useCallback\(\(\) => \{[\s\S]*routePreviewRequestCoordinatorRef\.current\.reset\(\);[\s\S]*\}, \[\]\);/,
  'Runs should centralize route-preview coordinator reset behavior in one callback.',
);

assert.match(
  runsSource,
  /const refreshRuns = useCallback\(\(\) => \{\s*runsLoadGenerationRef\.current\.invalidate\(\);\s*resetRoutePreviewState\(\);[\s\S]*setRoutePreviewFallbacks\(\{\}\);[\s\S]*setRouteBboxes\(\{\}\);[\s\S]*return loadRuns\(\);/,
  'Refreshes triggered by sync/import should reset route-preview coordination alongside fallback and bbox state.',
);

assert.match(
  runsSource,
  /function handleStravaSyncFinished\(\) \{\s*refreshRuns\(\);/,
  'Completed Strava sync should use the route-preview reset refresh path.',
);

assert.match(
  runsSource,
  /setImportModalOpen\(false\);\s*refreshRuns\(\);/,
  'Successful activity import should use the route-preview reset refresh path.',
);

assert.match(
  runsSource,
  /await apiJson\(`\/api\/activities\/\$\{run\.id\}`, \{ method: 'DELETE' \}\);\s*resetRoutePreviewState\(\);/,
  'Deleting an activity should reset route-preview coordination before its cached card state is removed.',
);

assert.doesNotMatch(
  runsSource,
  /return \(preloadIds\.length > 0[\s\S]*fetchRoutePreviewBatch\(preloadIds\)[\s\S]*setLoadState\('ready'\)/,
  'Runs page must not block the ready state behind initial route-preview preloading.',
);

assert.doesNotMatch(
  runsSource,
  /apiFetch\(`\/api\/activities\/\$\{run\.id\}\/points`\)/,
  'Runs page should not hydrate every thumbnail through its own /points request once the batch preview endpoint exists.',
);

assert.doesNotMatch(
  runsSource,
  /RoutePreviewThumb points=\{routePreviewPoints\[run\.id\] \|\| \[\]\}/,
  'Runs page should not keep rendering thumbnails only from raw point-array fallback state when a cached preview exists.',
);

assert.match(
  runsSource,
  /const RUNS_RENDER_BATCH_SIZE = 60;/,
  'Runs history should load additional runs in bounded scroll batches of 60 cards.',
);

assert.match(
  runsSource,
  /const RECENT_RUNS_INITIAL_VISIBLE_COUNT = RUNS_RENDER_BATCH_SIZE;/,
  'Runs history should initially list exactly one render batch (60 runs, the previous 3-card window scaled to the render budget) before page-scroll expansion.',
);

assert.match(
  runsSource,
  /filteredRuns\.slice\(0,\s*visibleRunsCount\)/,
  'Runs history should render a visible batch rather than mounting every filtered run immediately.',
);

assert.match(
  runsSource,
  /runsByMonth\.map\(\(group\) =>[\s\S]*group\.runs\.map\(\(run\) => \(/,
  'Runs history should render normal page-flow cards grouped by month, rather than a nested virtual scroller.',
);

assert.match(
  runsSource,
  /runs-profile-history[\s\S]*runs-profile-cockpit[\s\S]*recent-runs-card-list/,
  'Runs should keep the profile-aligned page shell while preserving the normal history list.',
);

assert.match(
  runsSource,
  /const runsByMonth = useMemo\(\(\) => \{[\s\S]*visibleRuns\.forEach/,
  'Runs history month groups should be derived deterministically from visibleRuns (still page-flow, still bounded by the load-more sentinel).',
);

assert.match(
  splitRunsStyle,
  /\.recent-runs-month-grid\s*\{[\s\S]*display:\s*grid;/,
  'Each month group should render its runs in a responsive grid.',
);

assert.match(
  runsSource,
  /new IntersectionObserver\(\(entries\) => \{[\s\S]*setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RUNS_RENDER_BATCH_SIZE, filteredRuns\.length\)\)/,
  'Runs history should expand when page scrolling brings the loader sentinel into view.',
);

assert.match(
  runsSource,
  /if \(!hasMoreRuns \|\| loadState !== 'ready'\) return undefined;[\s\S]*?\}, \[filteredRuns, hasMoreRuns, loadState, visibleRunsCount\]\);/,
  'Runs history should re-arm the loader observer after each visible batch change or filtered-list change.',
);

assert.match(
  runsSource,
  /className="recent-runs-load-more"[\s\S]*onClick=\{\(\) => setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RUNS_RENDER_BATCH_SIZE, filteredRuns\.length\)\)\}[\s\S]*\{t\('runs\.load_more'\)\}/,
  'Runs history should expose a manual load-more control when IntersectionObserver is unavailable.',
);

assert.doesNotMatch(
  runsSource,
  /from 'react-window'|<List|recent-runs-virtual-list|onRowsRendered|rowHeight=\{/,
  'Runs history should not use the nested react-window scroller or its internal scrollbar.',
);

assert.match(
  styleSource,
  /\.recent-runs-page-list\s*\{[\s\S]*display:\s*grid;[\s\S]*gap:\s*10px;/,
  'Runs page-flow list should have a normal card stack style.',
);

assert.doesNotMatch(
  styleSource,
  /\.recent-runs-virtual-list/,
  'Runs CSS should not keep the internal virtual-list scrollbar class.',
);

console.log('[PASS] Runs route preview cache guardrails passed.');
