import assert from 'node:assert/strict';
import { getHeatmapCacheKey, invalidateHeatmapCache } from './heatmapCache.js';

assert.equal(
  getHeatmapCacheKey(' Runner@Example.COM '),
  'profile-heatmap:v2:runner@example.com',
  'heatmap cache keys should be isolated by normalized account email',
);

let deletedKey = null;
const fakeDatabase = {
  objectStoreNames: { contains: () => true },
  transaction: () => {
    const transaction = {
      objectStore: () => ({
        delete: (key) => {
          deletedKey = key;
        },
      }),
      oncomplete: null,
      onerror: null,
      onabort: null,
    };
    setTimeout(() => transaction.oncomplete?.(), 0);
    return transaction;
  },
  close: () => {},
};

const previousWindow = globalThis.window;
globalThis.window = {
  indexedDB: {
    open: () => {
      const request = { result: fakeDatabase, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
      queueMicrotask(() => request.onsuccess?.({ target: { result: fakeDatabase } }));
      return request;
    },
  },
};

try {
  await invalidateHeatmapCache('runner@example.com');
} finally {
  globalThis.window = previousWindow;
}

assert.equal(
  deletedKey,
  'profile-heatmap:v2:runner@example.com',
  'run deletion should remove the account heatmap cache record',
);

console.log('[PASS] Heatmap cache invalidation regression guard passed.');
