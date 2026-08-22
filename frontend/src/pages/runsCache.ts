export const RUNS_CACHE_TTL_MS = 86_400_000;
export const RUNS_CACHE_MAX_RAW_JSON_CHARS = 750_000;
export const RUNS_CACHE_KEY_PREFIX = 'hermes_runs_v2_';
export const RUNS_CACHE_LEGACY_KEY_PREFIX = 'hermes_runs_v1_';

export interface RunsCacheStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SlimRunForRunsCache {
  id: unknown;
  name: unknown;
  startTime: unknown;
  startDate: unknown;
  distanceKm: unknown;
  distanceMeters: unknown;
  movingTimeSeconds: unknown;
  provider: unknown;
}

export interface RunsCacheSnapshot {
  runs: SlimRunForRunsCache[];
  profile: unknown;
  stravaStatus: unknown;
  cachedAt: number;
  sourceCount: number;
  complete: true;
}

const RUNS_CACHE_REQUIRED_RUN_FIELDS = [
  'id',
  'name',
  'startTime',
  'startDate',
  'distanceKm',
  'distanceMeters',
  'movingTimeSeconds',
  'provider',
] as const;

export function canonicalizeRunsCacheEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const canonical = email.trim().toLowerCase();
  return canonical || null;
}

export function createRunsLoadGeneration() {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
      return current;
    },
    isCurrent(token: number) {
      return token === current;
    },
  };
}

function cacheKey(prefix: string, email: string) {
  return `${prefix}${email}`;
}

function isValidSlimRun(run: unknown): run is SlimRunForRunsCache {
  if (!run || typeof run !== 'object' || Array.isArray(run)) return false;
  const candidate = run as Record<string, unknown>;
  if (typeof candidate.id !== 'number' || !Number.isFinite(candidate.id) || candidate.id <= 0) return false;
  return RUNS_CACHE_REQUIRED_RUN_FIELDS.every((field) => (
    Object.prototype.hasOwnProperty.call(candidate, field) && candidate[field] !== undefined
  ));
}

export function slimRunForRunsCache(run: Record<string, unknown> | null | undefined): SlimRunForRunsCache {
  return {
    id: run?.id,
    name: run?.name,
    startTime: run?.startTime,
    startDate: run?.startDate,
    distanceKm: run?.distanceKm,
    distanceMeters: run?.distanceMeters,
    movingTimeSeconds: run?.movingTimeSeconds,
    provider: run?.provider,
  };
}

export function invalidateRunsCache(storage: RunsCacheStorage, email: unknown) {
  const canonicalEmail = canonicalizeRunsCacheEmail(email);
  if (!canonicalEmail) return false;

  for (const prefix of [RUNS_CACHE_KEY_PREFIX, RUNS_CACHE_LEGACY_KEY_PREFIX]) {
    try {
      storage.removeItem(cacheKey(prefix, canonicalEmail));
    } catch {
      // Cache invalidation is best effort when storage is unavailable.
    }
  }
  return true;
}

export function writeRunsCache(
  storage: RunsCacheStorage,
  email: unknown,
  runs: Array<Record<string, unknown>>,
  profile: unknown,
  stravaStatus: unknown,
  now: number,
) {
  const canonicalEmail = canonicalizeRunsCacheEmail(email);
  if (!canonicalEmail) return false;
  invalidateRunsCache(storage, canonicalEmail);
  if (!Array.isArray(runs)) return false;

  try {
    const raw = JSON.stringify({
      runs: runs.map(slimRunForRunsCache),
      profile,
      stravaStatus,
      cachedAt: now,
      sourceCount: runs.length,
      complete: true,
    });

    if (raw.length > RUNS_CACHE_MAX_RAW_JSON_CHARS) return false;

    storage.setItem(cacheKey(RUNS_CACHE_KEY_PREFIX, canonicalEmail), raw);
    return true;
  } catch {
    try {
      storage.removeItem(cacheKey(RUNS_CACHE_KEY_PREFIX, canonicalEmail));
    } catch {
      // Ignore storage failures; an unavailable cache must not block Runs.
    }
    return false;
  }
}

export function readRunsCache(storage: RunsCacheStorage, email: unknown, now: number): RunsCacheSnapshot | null {
  const canonicalEmail = canonicalizeRunsCacheEmail(email);
  if (!canonicalEmail) return null;

  try {
    const raw = storage.getItem(cacheKey(RUNS_CACHE_KEY_PREFIX, canonicalEmail));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (
      !parsed
      || typeof parsed !== 'object'
      || !Array.isArray(parsed.runs)
      || parsed.complete !== true
      || !Number.isFinite(parsed.cachedAt)
      || now - parsed.cachedAt < 0
      || now - parsed.cachedAt >= RUNS_CACHE_TTL_MS
      || parsed.runs.length !== parsed.sourceCount
      || !parsed.runs.every(isValidSlimRun)
    ) {
      return null;
    }

    return parsed as RunsCacheSnapshot;
  } catch {
    return null;
  }
}
