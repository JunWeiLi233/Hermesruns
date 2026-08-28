export const HEATMAP_CACHE_DB_NAME = 'hermes_heatmap_cache_v1';
export const HEATMAP_CACHE_STORE_NAME = 'heatmaps';
export const HEATMAP_CACHE_DB_VERSION = 1;

// Warm-cache freshness tiers:
// - 'fresh': recent enough to paint from cache and skip the network refetch.
// - 'refresh': paint from cache immediately, then silently refetch in the
//   background so data never goes a full week stale.
// - 'stale': older than the hard max age; ignore the record and load normally.
export const HEATMAP_CACHE_REFRESH_MS = 24 * 60 * 60 * 1000;
export const HEATMAP_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getHeatmapCacheKey(accountEmail) {
  const normalizedEmail = typeof accountEmail === 'string' ? accountEmail.trim().toLowerCase() : '';
  // v2: the backend now computes bounds from trimmed coordinate samples, so
  // every client must drop payloads cached with the old world-stretched
  // bounds (a stray GPS point pinned the map at world zoom for up to a week).
  return normalizedEmail ? `profile-heatmap:v2:${normalizedEmail}` : null;
}

export function getHeatmapCacheFreshnessTier(savedAt, now = Date.now()) {
  const cacheAge = now - Number(savedAt);
  if (!Number.isFinite(cacheAge)) return 'stale';
  if (cacheAge <= HEATMAP_CACHE_REFRESH_MS) return 'fresh';
  if (cacheAge <= HEATMAP_CACHE_MAX_AGE_MS) return 'refresh';
  return 'stale';
}

// Monotonic write generation, bumped by every invalidation. Deferred cache
// writes capture the generation before scheduling and re-check it before
// writing, so a straggling idle-deferred write can never re-insert data that
// an invalidation (run delete, Strava sync) just removed.
let heatmapCacheWriteGeneration = 0;

export function getHeatmapCacheWriteGeneration() {
  return heatmapCacheWriteGeneration;
}

// Module state is per-browser-tab, so the counter above cannot observe an
// invalidation performed in ANOTHER tab (run deleted from the Runs page there).
// The write epoch below is persisted in localStorage — which IS shared across
// tabs for the origin — keyed per cache key, so a deferred write scheduled in
// this tab is also cancelled by another tab's invalidation.
export const HEATMAP_CACHE_WRITE_EPOCH_PREFIX = 'hermes_heatmap_cache_gen_v1_';

export function getHeatmapCacheWriteEpochStorageKey(cacheKey) {
  return `${HEATMAP_CACHE_WRITE_EPOCH_PREFIX}${cacheKey}`;
}

function readPersistedHeatmapCacheWriteEpoch(storageKey) {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const parsed = Number(storage.getItem(storageKey));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // localStorage can be blocked (private mode, sandboxed iframe); null marks
    // it unavailable so callers fall back to the tab-local counter.
    return null;
  }
}

// Composite of the tab-local counter and the persisted epoch: a change from
// either a same-tab bump or a cross-tab bump invalidates captured epochs.
export function getHeatmapCacheWriteEpoch(cacheKey) {
  const storageKey = cacheKey ? getHeatmapCacheWriteEpochStorageKey(cacheKey) : null;
  const persistedEpoch = storageKey ? readPersistedHeatmapCacheWriteEpoch(storageKey) : null;
  // '-' is the sentinel for "persisted epoch unavailable" (storage blocked or
  // unreadable), so the composite still changes on tab-local bumps alone.
  return `${heatmapCacheWriteGeneration}:${persistedEpoch === null ? '-' : persistedEpoch}`;
}

// Guard decision for deferred cache writes: the caller captures the epoch when
// scheduling and re-checks it right before writing, skipping the write if an
// invalidation (same tab or another tab) bumped it in between.
export function isHeatmapCacheWriteEpochCurrent(cacheKey, capturedEpoch) {
  return getHeatmapCacheWriteEpoch(cacheKey) === capturedEpoch;
}

function bumpPersistedHeatmapCacheWriteEpoch(cacheKey) {
  if (!cacheKey) return;
  try {
    const storage = globalThis.localStorage;
    if (!storage) return;
    const storageKey = getHeatmapCacheWriteEpochStorageKey(cacheKey);
    const current = Number(storage.getItem(storageKey));
    storage.setItem(storageKey, String((Number.isFinite(current) ? current : 0) + 1));
  } catch {
    // Storage unavailable or full: the module-counter bump above still guards
    // same-tab writes; cross-tab protection is simply unavailable here.
  }
}

export function openHeatmapCacheDb() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = window.indexedDB.open(HEATMAP_CACHE_DB_NAME, HEATMAP_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HEATMAP_CACHE_STORE_NAME)) {
        database.createObjectStore(HEATMAP_CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function invalidateHeatmapCache(accountEmail) {
  // Bump synchronously before any await so pending deferred writes observe
  // the new generation deterministically, even if the delete is slow.
  heatmapCacheWriteGeneration += 1;

  const cacheKey = getHeatmapCacheKey(accountEmail);
  // The persisted epoch must bump in the same synchronous stretch: a deferred
  // write pending in ANOTHER tab has to observe it before this tab's delete.
  bumpPersistedHeatmapCacheWriteEpoch(cacheKey);
  if (!cacheKey) return;

  let database;
  try {
    database = await openHeatmapCacheDb();
  } catch {
    return;
  }
  if (!database) return;

  try {
    if (!database.objectStoreNames.contains(HEATMAP_CACHE_STORE_NAME)) return;
    await new Promise((resolve) => {
      const transaction = database.transaction(HEATMAP_CACHE_STORE_NAME, 'readwrite');
      transaction.objectStore(HEATMAP_CACHE_STORE_NAME).delete(cacheKey);
      transaction.oncomplete = resolve;
      transaction.onerror = resolve;
      transaction.onabort = resolve;
    });
  } catch {
    // The backend deletion has already succeeded; a missing or closing cache must not surface as a delete failure.
  } finally {
    database.close();
  }
}
