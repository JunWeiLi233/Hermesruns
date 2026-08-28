import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heatmapSource = readFileSync(path.join(here, 'Heatmap.jsx'), 'utf8');
const heatmapCacheSource = readFileSync(path.join(here, 'heatmapCache.js'), 'utf8');
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
const fetchCallIndex = heatmapSource.indexOf('fetchSampledHeatmap(heatmapController.signal');
assert.ok(
  freshTierIndex !== -1 && fetchCallIndex !== -1 && freshTierIndex < fetchCallIndex,
  'A fresh cache tier must be checked before any fetchSampledHeatmap call so warm visits skip the network refetch entirely.',
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

// 2. Single sampled fetch: one bounded request instead of paging the full
// multi-million-point GPS history through the main thread.
assert.match(
  heatmapSource,
  /const HEATMAP_SAMPLE_LIMIT = 25000;/,
  'Heatmap should request one bounded server-side render pool instead of every GPS point.',
);
assert.match(
  heatmapSource,
  /async function fetchSampledHeatmap\(signal\) \{[\s\S]*?\/api\/profile\/heatmap\?sample=true&limit=\$\{HEATMAP_SAMPLE_LIMIT\}[\s\S]*?\}/,
  'Heatmap should fetch the whole heatmap through the single sample=true endpoint with a bounded limit.',
);
assert.doesNotMatch(
  heatmapSource,
  /offset=\$\{offset\}|HEATMAP_BACKGROUND_PAGE_SIZE|MAX_HEATMAP_PAGES|fetchHeatmapPage|computeBackgroundPagePlan|fetchHeatmapPagesWithBounds|isCompletePageAssembly/,
  'Heatmap must not restore the paged offset/limit background fetching that moved the full GPS history through the main thread.',
);
assert.doesNotMatch(
  heatmapSource,
  /heatmapPagePlan/,
  'Heatmap should not import the removed background page-plan module.',
);
assert.doesNotMatch(
  heatmapSource,
  /buildMergedHeatmapPayload|partialFull|recentPreview/,
  'The single sampled response needs no client-side page merging or partial-load phases.',
);

// 3. No full-dataset coverage query alongside the sampled pool.
assert.doesNotMatch(
  heatmapSource,
  /HEATMAP_INITIAL_COVERAGE_LIMIT|fetchHeatmapCoverage|coverage=true/,
  'Heatmap loading should not launch the full-dataset coverage window query alongside the sampled pool.',
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

// 4b. Cross-repo pin: the sampled pool request must stay within the backend's
// hard endpoint cap, and the two sides should agree on the default size.
const backendMaxPageLimitMatch = profileControllerSource.match(/MAX_HEATMAP_PAGE_LIMIT\s*=\s*(\d+)\s*;/);
assert.ok(
  backendMaxPageLimitMatch,
  'ProfileController should declare MAX_HEATMAP_PAGE_LIMIT so the frontend sample size can be cross-checked.',
);
const backendSampleLimitMatch = profileControllerSource.match(/DEFAULT_HEATMAP_SAMPLE_LIMIT\s*=\s*(\d+)\s*;/);
assert.ok(
  backendSampleLimitMatch,
  'ProfileController should declare DEFAULT_HEATMAP_SAMPLE_LIMIT so the frontend sample size can be cross-checked.',
);
assert.equal(
  Number(backendSampleLimitMatch[1]),
  Number(heatmapSource.match(/HEATMAP_SAMPLE_LIMIT = (\d+);/)[1]),
  'Frontend HEATMAP_SAMPLE_LIMIT must equal backend DEFAULT_HEATMAP_SAMPLE_LIMIT; drifting sizes silently change payload weight.',
);
assert.ok(
  Number(heatmapSource.match(/HEATMAP_SAMPLE_LIMIT = (\d+);/)[1]) <= Number(backendMaxPageLimitMatch[1]),
  'Frontend HEATMAP_SAMPLE_LIMIT must not exceed the backend MAX_HEATMAP_PAGE_LIMIT cap.',
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
