import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heatmapSource = readFileSync(path.join(here, 'Heatmap.jsx'), 'utf8');
const heatmapCacheSource = readFileSync(path.join(here, 'heatmapCache.js'), 'utf8');
const heatmapPagePlanSource = readFileSync(path.join(here, 'heatmapPagePlan.js'), 'utf8');
const authContextSource = readFileSync(path.join(here, '../contexts/AuthContext.jsx'), 'utf8');
const profileControllerSource = readFileSync(
  path.join(here, '../../../backend/src/main/java/com/hermes/backend/ProfileController.java'),
  'utf8',
);

// 1. Warm-cache short-circuit: a fresh cache must skip the network refetch.
assert.match(
  heatmapCacheSource,
  /HEATMAP_CACHE_REFRESH_MS = 24 \* 60 \* 60 \* 1000;[\s\S]*?HEATMAP_CACHE_MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000;/,
  'Heatmap cache should define a 24h soft refresh tier inside the existing 7-day hard max age.',
);
assert.match(
  heatmapCacheSource,
  /export function getHeatmapCacheFreshnessTier\(savedAt, now = Date\.now\(\)\) \{[\s\S]*?'fresh'[\s\S]*?'refresh'[\s\S]*?'stale';[\s\S]*?\}/,
  'Heatmap cache should expose pure fresh/refresh/stale freshness tiers.',
);
const freshTierIndex = heatmapSource.indexOf("getHeatmapCacheFreshnessTier(cachedHeatmap.diagnostics?.cacheSavedAt) === 'fresh'");
const fetchCallIndex = heatmapSource.indexOf('fetchCompleteHeatmap(heatmapController.signal');
assert.ok(
  freshTierIndex !== -1 && fetchCallIndex !== -1 && freshTierIndex < fetchCallIndex,
  'A fresh cache tier must be checked before any fetchCompleteHeatmap call so warm visits skip the network refetch entirely.',
);
const tierReturnTail = heatmapSource.slice(freshTierIndex, freshTierIndex + 400);
assert.match(
  tierReturnTail,
  /=== 'fresh'\) \{\s*[\s\S]*?return;/,
  'The fresh cache tier must return before starting a network load.',
);
assert.match(
  heatmapSource,
  /} else if \(isCompleteResult\) \{/,
  'When cached data is already on screen, only a fully complete refresh may replace it.',
);

// 2. Parallel page fetching: bounded-concurrency pool, no sequential loop.
assert.match(
  heatmapPagePlanSource,
  /export const HEATMAP_PAGE_FETCH_CONCURRENCY = 3;/,
  'Heatmap background pages should be fetched through a bounded pool of at most 3 in-flight requests.',
);
assert.match(
  heatmapPagePlanSource,
  /export function computeBackgroundPagePlan\(\{ sourcePointCount, startOffset, pageSize, maxPages \}\)/,
  'Heatmap should compute the deterministic background page offset plan up front.',
);
assert.match(
  heatmapPagePlanSource,
  /export async function fetchHeatmapPagesWithBounds\(pagePlan, fetchPage, concurrency = HEATMAP_PAGE_FETCH_CONCURRENCY\) \{[\s\S]*?const results = new Array\(pagePlan\.length\)\.fill\(null\);[\s\S]*?let nextIndex = 0;[\s\S]*?while \(firstError === null\)[\s\S]*?await Promise\.all\(/,
  'The page pool should keep per-index result slots with a worker loop bounded by firstError and Promise.all.',
);
assert.match(
  heatmapSource,
  /const pageResults = await fetchHeatmapPagesWithBounds\([\s\S]*?\(pageOffset, pageLimit\) => fetchHeatmapPage\(pageOffset, pageLimit, signal\),[\s\S]*?HEATMAP_PAGE_FETCH_CONCURRENCY,/,
  'Heatmap should fetch background pages through the bounded pool while propagating the abort signal.',
);
assert.doesNotMatch(
  heatmapSource,
  /for \(let pageIndex = 1; pageIndex < MAX_HEATMAP_PAGES; pageIndex \+= 1\)/,
  'Heatmap must not restore the strictly sequential one-page-at-a-time background loop.',
);
assert.match(
  heatmapSource,
  /if \(!isCompletePageAssembly\(pagePlan, pageResults\)\) \{\s*[\s\S]*?'partialFull'\);/,
  'A failed or misaligned background page must degrade to the partial payload exactly like the sequential loop did.',
);

// 3. Early paint: the paged GPS load must remain the only initial data path;
// expensive full-dataset coverage is deliberately not launched alongside it.
assert.doesNotMatch(
  heatmapSource,
  /HEATMAP_INITIAL_COVERAGE_LIMIT|fetchHeatmapCoverage|coverage=true/,
  'Heatmap initial loading should not launch the full-dataset coverage window query alongside the paged GPS load.',
);

// 4. Cheaper render churn: one full-array pool build + idle-scheduled write.
const fullPoolBuilds = heatmapSource.match(/buildHeatmapRenderPointPool\(points,/g) || [];
assert.equal(
  fullPoolBuilds.length,
  1,
  'Only the full render pool may scan the complete points array; the preview pool must sample the capped full pool.',
);
assert.match(
  heatmapSource,
  /function scheduleHeatmapCacheWrite\(cacheKey, payload\) \{[\s\S]*?const writeGeneration = getHeatmapCacheWriteGeneration\(\);[\s\S]*?const writeEpoch = getHeatmapCacheWriteEpoch\(cacheKey\);[\s\S]*?if \(getHeatmapCacheWriteGeneration\(\) !== writeGeneration\) return;[\s\S]*?if \(!isHeatmapCacheWriteEpochCurrent\(cacheKey, writeEpoch\)\) return;[\s\S]*?window\.requestIdleCallback\(startWrite, \{ timeout: 4000 \}\);[\s\S]*?window\.setTimeout\(startWrite, 0\);/,
  'The final IndexedDB cache write should be deferred to requestIdleCallback with a setTimeout fallback, gated by the tab-local write generation and the cross-tab write epoch capture.',
);
assert.doesNotMatch(
  heatmapSource,
  /writeCachedHeatmapPayload\(cacheKey, completeHeatmap\)\.catch\(\(\) => \{\}\);/,
  'The cache write must not run inline on the load path.',
);
assert.match(
  heatmapCacheSource,
  /export async function invalidateHeatmapCache\(accountEmail\) \{[\s\S]*?heatmapCacheWriteGeneration \+= 1;/,
  'Every cache invalidation must bump the write generation so deferred writes captured before it are skipped.',
);

// 4b. Cross-repo pin: the deterministic page plan assumes the backend honors
// the full background page size, so a backend limit reduction must trip here.
const backendMaxPageLimitMatch = profileControllerSource.match(/MAX_HEATMAP_PAGE_LIMIT\s*=\s*(\d+)\s*;/);
assert.ok(
  backendMaxPageLimitMatch,
  'ProfileController should declare MAX_HEATMAP_PAGE_LIMIT so the frontend page size can be cross-checked.',
);
const frontendBackgroundPageSizeMatch = heatmapSource.match(/HEATMAP_BACKGROUND_PAGE_SIZE = (\d+);/);
assert.ok(
  frontendBackgroundPageSizeMatch,
  'Heatmap should declare HEATMAP_BACKGROUND_PAGE_SIZE as a plain integer for the backend cross-check.',
);
assert.equal(
  Number(backendMaxPageLimitMatch[1]),
  Number(frontendBackgroundPageSizeMatch[1]),
  `Frontend HEATMAP_BACKGROUND_PAGE_SIZE (${frontendBackgroundPageSizeMatch[1]}) must equal backend MAX_HEATMAP_PAGE_LIMIT (${backendMaxPageLimitMatch[1]}); a backend page-limit reduction would silently break the deterministic offset plan.`,
);

// 4c. First-page offset: a full first page consumed its whole span server-side.
assert.match(
  heatmapSource,
  /offset = firstReturnedPointCount >= firstPageLimit\s*\?\s*firstPageOffset \+ firstPageLimit\s*:\s*firstPageOffset \+ firstReturnedPointCount;/,
  'When the first page fills its request limit, background pages must start at offset + limit so filter-dropped rows are not re-fetched and duplicated.',
);

// 5. Strava-sync invalidation hook.
assert.match(
  authContextSource,
  /import \{ invalidateHeatmapCache \} from '\.\.\/pages\/heatmapCache';[\s\S]*?function handleStravaSyncFinished\(\) \{[\s\S]*?invalidateHeatmapCache\(email\);/,
  'A finished Strava sync should drop the account heatmap cache so the warm short-circuit cannot serve pre-sync data.',
);
assert.match(
  heatmapSource,
  /import \{ STRAVA_SYNC_FINISHED_EVENT \} from '\.\.\/utils\/stravaAutoSync';[\s\S]*?function handleStravaSyncFinished\(\) \{[\s\S]*?invalidateHeatmapCache\(authEmail\)\.finally\(\(\) => \{[\s\S]*?setHeatmapReloadToken\(\(value\) => value \+ 1\);/,
  'A mounted Heatmap should invalidate its cache and silently reload when a Strava sync finishes.',
);

console.log('[PASS] Heatmap fast-load guardrails passed.');
