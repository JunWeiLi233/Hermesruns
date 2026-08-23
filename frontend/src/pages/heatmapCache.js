export const HEATMAP_CACHE_DB_NAME = 'hermes_heatmap_cache_v1';
export const HEATMAP_CACHE_STORE_NAME = 'heatmaps';
export const HEATMAP_CACHE_DB_VERSION = 1;

export function getHeatmapCacheKey(accountEmail) {
  const normalizedEmail = typeof accountEmail === 'string' ? accountEmail.trim().toLowerCase() : '';
  return normalizedEmail ? `profile-heatmap:${normalizedEmail}` : null;
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
  const cacheKey = getHeatmapCacheKey(accountEmail);
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
