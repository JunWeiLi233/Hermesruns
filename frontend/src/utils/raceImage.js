import { apiJson } from '../api';
import { getRaceImageSourceCandidates } from '../data/worldRaceCatalog';

const RACE_IMAGE_CACHE_KEY = 'hermes.raceImageCache.v1';
const raceImageMemoryCache = new Map();

function isAllowedRaceImageUrl(imageUrl) {
  if (typeof imageUrl !== 'string') return false;
  const trimmed = imageUrl.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('https://');
}

function readPersistedRaceImageCache() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.sessionStorage.getItem(RACE_IMAGE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistedRaceImageCache(snapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RACE_IMAGE_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore persistence failures and keep the in-memory cache.
  }
}

function buildRaceImageCacheKey(race) {
  return String(race?.id || '');
}

function primeMemoryCache() {
  if (raceImageMemoryCache.size > 0) return;
  const persisted = readPersistedRaceImageCache();
  Object.entries(persisted).forEach(([key, value]) => {
    if (value && isAllowedRaceImageUrl(value.imageUrl)) {
      raceImageMemoryCache.set(key, value);
    }
  });
}

function persistRaceImageEntry(cacheKey, entry) {
  raceImageMemoryCache.set(cacheKey, entry);
  const persisted = readPersistedRaceImageCache();
  persisted[cacheKey] = entry;
  writePersistedRaceImageCache(persisted);
}

export function getCachedRaceImage(race) {
  const cacheKey = buildRaceImageCacheKey(race);
  if (!cacheKey) return { imageUrl: '', sourceWebsite: '' };
  primeMemoryCache();
  const cached = raceImageMemoryCache.get(cacheKey);
  if (!cached) return { imageUrl: '', sourceWebsite: '' };
  if (isAllowedRaceImageUrl(cached.imageUrl)) return cached;
  raceImageMemoryCache.delete(cacheKey);
  const persisted = readPersistedRaceImageCache();
  delete persisted[cacheKey];
  writePersistedRaceImageCache(persisted);
  return { imageUrl: '', sourceWebsite: '' };
}

export async function resolveRaceImage(race) {
  const cacheKey = buildRaceImageCacheKey(race);
  if (!cacheKey) {
    return {
      imageUrl: '',
      sourceWebsite: '',
    };
  }

  const cached = getCachedRaceImage(race);
  if (cached.imageUrl) return cached;

  const candidates = getRaceImageSourceCandidates(race);
  for (const website of candidates) {
    try {
      const response = await apiJson(`/api/races/official-image?website=${encodeURIComponent(website)}`);
      if (isAllowedRaceImageUrl(response?.imageUrl)) {
        const resolved = {
          imageUrl: response.imageUrl,
          sourceWebsite: website,
        };
        persistRaceImageEntry(cacheKey, resolved);
        return resolved;
      }
    } catch {
      // Try the next source candidate.
    }
  }
  const fallback = {
    imageUrl: '',
    sourceWebsite: '',
  };
  persistRaceImageEntry(cacheKey, fallback);
  return fallback;
}
