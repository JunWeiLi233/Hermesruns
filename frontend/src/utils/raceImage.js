import { apiJson } from '../api.js';
import { getRaceImageSourceCandidates } from '../data/worldRaceCatalog.js';

const RACE_IMAGE_CACHE_KEY = 'hermes.raceImageCache.v1';
const DEFAULT_RACE_IMAGE_RETRY_MS = 60 * 1000;
const raceImageMemoryCache = new Map();
const raceImageInFlightCache = new Map();
const raceImageWebsiteCooldowns = new Map();

function isFutureTimestamp(value) {
  return Number.isFinite(value) && value > Date.now();
}

function normalizeRaceImageCacheEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl : '';
  const sourceWebsite = typeof value.sourceWebsite === 'string' ? value.sourceWebsite : '';
  const retryAfterAt = Number.isFinite(value.retryAfterAt) ? value.retryAfterAt : 0;
  return { imageUrl, sourceWebsite, retryAfterAt };
}

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
    const normalized = normalizeRaceImageCacheEntry(value);
    if (!normalized) return;
    if (isAllowedRaceImageUrl(normalized.imageUrl) || isFutureTimestamp(normalized.retryAfterAt)) {
      raceImageMemoryCache.set(key, normalized);
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
  if (!cacheKey) return { imageUrl: '', sourceWebsite: '', retryAfterAt: 0 };
  primeMemoryCache();
  const cached = raceImageMemoryCache.get(cacheKey);
  if (!cached) return { imageUrl: '', sourceWebsite: '', retryAfterAt: 0 };
  if (isAllowedRaceImageUrl(cached.imageUrl)) return cached;
  if (isFutureTimestamp(cached.retryAfterAt)) return cached;
  raceImageMemoryCache.delete(cacheKey);
  const persisted = readPersistedRaceImageCache();
  delete persisted[cacheKey];
  writePersistedRaceImageCache(persisted);
  return { imageUrl: '', sourceWebsite: '', retryAfterAt: 0 };
}

function parseRetryAfterToMs(retryAfter) {
  if (typeof retryAfter !== 'string') return DEFAULT_RACE_IMAGE_RETRY_MS;
  const trimmed = retryAfter.trim();
  if (!trimmed) return DEFAULT_RACE_IMAGE_RETRY_MS;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(DEFAULT_RACE_IMAGE_RETRY_MS, seconds * 1000);
  }
  const absoluteTime = Date.parse(trimmed);
  if (Number.isFinite(absoluteTime)) {
    return Math.max(DEFAULT_RACE_IMAGE_RETRY_MS, absoluteTime - Date.now());
  }
  return DEFAULT_RACE_IMAGE_RETRY_MS;
}

function getWebsiteCooldownUntil(website) {
  const cooldownUntil = raceImageWebsiteCooldowns.get(website);
  if (!isFutureTimestamp(cooldownUntil)) {
    raceImageWebsiteCooldowns.delete(website);
    return 0;
  }
  return cooldownUntil;
}

function markWebsiteCooldown(website, retryAfter) {
  if (!website) return Date.now() + DEFAULT_RACE_IMAGE_RETRY_MS;
  const cooldownUntil = Date.now() + parseRetryAfterToMs(retryAfter);
  raceImageWebsiteCooldowns.set(website, cooldownUntil);
  return cooldownUntil;
}

function buildFallbackEntry(candidates) {
  const now = Date.now();
  const retryAfterAt = candidates.reduce((latest, website) => {
    const cooldownUntil = getWebsiteCooldownUntil(website);
    return cooldownUntil > latest ? cooldownUntil : latest;
  }, now + DEFAULT_RACE_IMAGE_RETRY_MS);
  return {
    imageUrl: '',
    sourceWebsite: '',
    retryAfterAt,
  };
}

async function resolveRaceImageUncached(race, cacheKey) {
  const candidates = getRaceImageSourceCandidates(race);
  for (const website of candidates) {
    if (getWebsiteCooldownUntil(website)) {
      continue;
    }
    try {
      const response = await apiJson(`/api/races/official-image?website=${encodeURIComponent(website)}`);
      if (isAllowedRaceImageUrl(response?.imageUrl)) {
        const resolved = {
          imageUrl: response.imageUrl,
          sourceWebsite: website,
          retryAfterAt: 0,
        };
        persistRaceImageEntry(cacheKey, resolved);
        return resolved;
      }
    } catch (error) {
      if (error?.status === 429) {
        markWebsiteCooldown(website, error.retryAfter);
      }
    }
  }

  const fallback = buildFallbackEntry(candidates);
  persistRaceImageEntry(cacheKey, fallback);
  return fallback;
}

export async function resolveRaceImage(race) {
  const cacheKey = buildRaceImageCacheKey(race);
  if (!cacheKey) {
    return {
      imageUrl: '',
      sourceWebsite: '',
      retryAfterAt: 0,
    };
  }

  const cached = getCachedRaceImage(race);
  if (cached.imageUrl || isFutureTimestamp(cached.retryAfterAt)) {
    return cached;
  }

  const inFlight = raceImageInFlightCache.get(cacheKey);
  if (inFlight) return inFlight;

  const request = resolveRaceImageUncached(race, cacheKey).finally(() => {
    raceImageInFlightCache.delete(cacheKey);
  });
  raceImageInFlightCache.set(cacheKey, request);
  return request;
}

export function invalidateRaceImageCache(race) {
  const cacheKey = buildRaceImageCacheKey(race);
  if (!cacheKey) return;
  raceImageMemoryCache.delete(cacheKey);
  raceImageInFlightCache.delete(cacheKey);
  const persisted = readPersistedRaceImageCache();
  delete persisted[cacheKey];
  writePersistedRaceImageCache(persisted);
}
