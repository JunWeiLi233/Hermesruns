// Shared in-memory resource cache + in-flight request dedupe for hot
// cross-page GET endpoints (activities list, profile). Every page mount used
// to refetch the same payloads; this layer collapses concurrent duplicates
// into one network request and serves fresh-enough responses from memory.
//
// Semantics (deliberately simple):
// - Only URLs explicitly listed in TTL_BY_PREFIX are cached; anything else
//   (and any non-GET call) passes straight through to apiJson untouched.
// - Cache keys include the account, credential and language so a response
//   cannot leak into a successor session or a different language.
// - Only successful apiJson resolutions are cached. Errors propagate exactly
//   as apiJson produces them and are never stored.
// - Every value handed to a caller (TTL hit or dedupe subscriber) is a deep
//   copy, so pages that sort/mutate their payloads (e.g. Races/Schedule sort
//   activities in place) cannot poison the cache or sibling subscribers.

import { apiJson } from '../api.ts';

const EMAIL_STORAGE_KEY = 'hermes_email';

export const ACTIVITIES_TTL_MS = 120 * 1000;
export const PROFILE_TTL_MS = 15 * 1000;

// Prefix -> TTL. Order matters if prefixes overlap (first match wins).
// Note: prefixes match whole URL families, so '/api/activities' would also
// cache sub-resources like '/api/activities/analysis' if they were ever
// routed through cachedApiJson. Shoes deliberately stays out of the map:
// its write sites span Shoes/AddShoes/RunDetail/admin flows that cannot all
// be covered by invalidation, so /api/shoes must remain uncached.
const TTL_BY_PREFIX: ReadonlyArray<readonly [prefix: string, ttlMs: number]> = [
  ['/api/activities', ACTIVITIES_TTL_MS], // covers /api/activities/analysis
  ['/api/profile/dashboard', PROFILE_TTL_MS],
  ['/api/profile/me', PROFILE_TTL_MS],
];

const KEY_SEPARATOR = '\u0000';

interface CacheEntry {
  value: unknown;
  storedAt: number;
}

interface InflightRequest {
  promise: Promise<unknown>;
  controller: AbortController;
  subscribers: number;
}

const cache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, InflightRequest>();

function ttlForUrl(url: string): number | null {
  for (const [prefix, ttlMs] of TTL_BY_PREFIX) {
    if (url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`)) return ttlMs;
  }
  return null;
}

function readAccountScope(): string | null {
  try {
    const email = localStorage.getItem(EMAIL_STORAGE_KEY);
    if (email == null) return null;
    const language = localStorage.getItem('hermes_lang')
      || navigator.languages?.[0] || navigator.language || 'en';
    return JSON.stringify([email, localStorage.getItem('hermes_jwt'), language]);
  } catch {
    return null;
  }
}

function cacheKey(scope: string, url: string): string {
  return `${scope}${KEY_SEPARATOR}${url}`;
}

function urlOfKey(key: string): string {
  return key.slice(key.indexOf(KEY_SEPARATOR) + KEY_SEPARATOR.length);
}

function clonePayload<T>(value: T): T {
  // Cached payloads are parsed JSON; keep a structural copy so consumers
  // mutating their result (in-place sorts etc.) never poison the cache.
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function readForSubscriber<T>(entry: InflightRequest, key: string, signal?: AbortSignal | null): Promise<T> {
  entry.subscribers += 1;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      entry.subscribers -= 1;
      if (entry.subscribers === 0) {
        if (inflightRequests.get(key) === entry) inflightRequests.delete(key);
        entry.controller.abort();
      }
      return true;
    };
    const onAbort = () => {
      if (finish()) reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then((value) => clonePayload(value) as T).then((value) => {
      if (finish()) resolve(value);
    }, (error: unknown) => {
      if (finish()) reject(error);
    });
  });
}

/**
 * apiJson wrapper with per-account in-memory caching and request dedupe for
 * the hot read endpoints. Fresh (within TTL) responses are served from
 * memory; concurrent misses for the same key share one network request.
 * Errors are never cached and propagate unchanged.
 */
export async function cachedApiJson<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
  }
  const method = (options.method || 'GET').toUpperCase();
  const ttlMs = ttlForUrl(url);
  const scope = readAccountScope();
  // Custom headers, credentials or cache directives may change the response.
  // Keep those requests outside the default representation's cache.
  const customOptions = Object.keys(options).some((key) => key !== 'method' && key !== 'signal');
  if (method !== 'GET' || ttlMs == null || scope == null || customOptions) {
    return apiJson<T>(url, options);
  }

  const key = cacheKey(scope, url);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt < ttlMs) {
    return clonePayload(cached.value) as T;
  }

  const existing = inflightRequests.get(key);
  if (existing) {
    return readForSubscriber<T>(existing, key, options.signal);
  }

  // A caller's cancellation belongs to that subscriber. Passing its signal
  // to the shared fetch would also cancel readers mounted on another page.
  const entry: InflightRequest = { promise: Promise.resolve(), controller: new AbortController(), subscribers: 0 };
  entry.promise = apiJson<T>(url, { ...options, signal: entry.controller.signal })
    .then((value) => {
      // Guard against storing a response that landed after its entry was
      // invalidated/cleared mid-flight.
      if (inflightRequests.get(key) === entry) {
        cache.set(key, { value: clonePayload(value), storedAt: Date.now() });
      }
      return value;
    })
    .finally(() => {
      if (inflightRequests.get(key) === entry) {
        inflightRequests.delete(key);
      }
    });
  inflightRequests.set(key, entry);
  // The shared network promise never escapes: every subscriber (including
  // the initiator) awaits its own deep copy, so one consumer's mutations
  // cannot leak into the cache or sibling subscribers.
  return readForSubscriber<T>(entry, key, options.signal);
}

/**
 * Drop cached entries whose URL starts with `urlPrefix` (all accounts), e.g.
 * invalidateResourceCache('/api/activities') after a Strava sync import.
 * Matching in-flight requests are detached too, so their late responses are
 * not re-stored. Without an argument, drops everything.
 */
export function invalidateResourceCache(urlPrefix?: string): void {
  if (urlPrefix == null) {
    cache.clear();
    inflightRequests.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (urlOfKey(key).startsWith(urlPrefix)) {
      cache.delete(key);
    }
  }
  for (const key of Array.from(inflightRequests.keys())) {
    if (urlOfKey(key).startsWith(urlPrefix)) {
      inflightRequests.delete(key);
    }
  }
}

/** Drop every cached resource and detach all in-flight requests (logout). */
export function clearResourceCache(): void {
  cache.clear();
  inflightRequests.clear();
}
