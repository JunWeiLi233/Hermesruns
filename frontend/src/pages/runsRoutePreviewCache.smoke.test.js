import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const splitRunsStyle = readFileSync(path.join(here, '../styles/_split/runs.css'), 'utf8');

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
  /const ROUTE_PREVIEW_INITIAL_PRELOAD_COUNT = RECENT_RUNS_INITIAL_VISIBLE_COUNT \+ \(RECENT_RUNS_LOAD_BATCH_SIZE \* 2\);/,
  'Runs page should keep the initial route-preview window bounded while loading previews after the list paints.',
);

assert.match(
  runsSource,
  /const ROUTE_PREVIEW_PREFETCH_LOOKAHEAD = RECENT_RUNS_LOAD_BATCH_SIZE \* 3;/,
  'Runs page should prefetch a short route-preview lookahead beyond the visible card count.',
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

assert.ok(
  [...runsSource.matchAll(/setRoutePreviewFallbacks\(\(current\)/g)].length >= 2,
  'Runs page should batch-merge routePreviewFallbacks for initial prewarm and for later viewport hydration.',
);

assert.ok(
  [...runsSource.matchAll(/setRouteBboxes\(\(current\)/g)].length >= 2,
  'Runs page should batch-merge routeBboxes for cache seed hydration, initial prewarm, and later viewport hydration.',
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
  'Run cards should expose data-run-id so browser proof can compare a thumbnail to /run/:runId route data.',
);

assert.match(
  runsSource,
  /setStravaStatus\(hit\.stravaStatus\);[\s\S]*setLoadState\('ready'\);[\s\S]*const preloadIds = sorted[\s\S]*fetchRoutePreviewBatch\(preloadIds\)/,
  'Runs page should paint cached history before prewarming route previews.',
);

assert.match(
  runsSource,
  /setAllRuns\(list\);[\s\S]*setLoadState\('ready'\);[\s\S]*if \(preloadIds\.length > 0\) \{[\s\S]*fetchRoutePreviewBatch\(preloadIds\)/,
  'Runs page should paint fresh /api/activities results before route-preview enrichment finishes.',
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
  /const RECENT_RUNS_INITIAL_VISIBLE_COUNT = 3;/,
  'Runs history should initially list exactly three recent runs before page-scroll expansion.',
);

assert.match(
  runsSource,
  /const RECENT_RUNS_LOAD_BATCH_SIZE = 6;/,
  'Runs history should load additional runs in bounded scroll batches.',
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
  /new IntersectionObserver\(\(entries\) => \{[\s\S]*setVisibleRunsCount\(\(current\) => Math\.min\(current \+ RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns\.length\)\)/,
  'Runs history should expand when page scrolling brings the loader sentinel into view.',
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
