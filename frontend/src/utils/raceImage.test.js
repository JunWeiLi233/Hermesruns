import assert from 'node:assert/strict';

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

const sessionStorage = createStorage();
const localStorage = createStorage();

globalThis.window = {
  location: {
    hostname: 'localhost',
    port: '5173',
  },
  sessionStorage,
};
globalThis.localStorage = localStorage;

const race = {
  id: 'rate-limit-dedupe-race',
  officialWebsite: 'https://example.com/race',
  city: '',
};

let fetchCount = 0;
globalThis.fetch = async () => {
  fetchCount += 1;
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return { imageUrl: 'https://cdn.example.com/race.jpg' };
    },
  };
};

const { invalidateRaceImageCache, resolveRaceImage } = await import('./raceImage.js');

invalidateRaceImageCache(race);
const [firstResolved, secondResolved] = await Promise.all([
  resolveRaceImage(race),
  resolveRaceImage(race),
]);

assert.equal(fetchCount, 1);
assert.equal(firstResolved.imageUrl, 'https://cdn.example.com/race.jpg');
assert.equal(secondResolved.imageUrl, 'https://cdn.example.com/race.jpg');

invalidateRaceImageCache(race);
sessionStorage.removeItem('hermes.raceImageCache.v1');
fetchCount = 0;
globalThis.fetch = async () => {
  fetchCount += 1;
  return {
    ok: false,
    status: 429,
    headers: {
      get(name) {
        if (name === 'content-type') return 'application/json';
        if (name === 'retry-after') return '120';
        return null;
      },
    },
    async json() {
      return { error: 'Too many requests' };
    },
  };
};

const firstMiss = await resolveRaceImage(race);
const secondMiss = await resolveRaceImage(race);

assert.equal(fetchCount, 1);
assert.equal(firstMiss.imageUrl, '');
assert.equal(secondMiss.imageUrl, '');

console.log('[PASS] Race image request dedupe and cooldown guards passed.');
