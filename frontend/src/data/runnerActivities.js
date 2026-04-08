import { apiJson } from '../api';

const CACHE_TTL_MS = 60_000;

let cachedRuns = null;
let cachedAt = 0;
let inflightRunsPromise = null;

function sortRunnerActivities(runs) {
  const list = Array.isArray(runs) ? runs : [];
  return [...list].sort(
    (a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0),
  );
}

export async function getRunnerActivities({ force = false } = {}) {
  const now = Date.now();
  if (!force && cachedRuns && now - cachedAt < CACHE_TTL_MS) {
    return cachedRuns;
  }

  if (!force && inflightRunsPromise) {
    return inflightRunsPromise;
  }

  inflightRunsPromise = apiJson('/api/activities')
    .then((data) => {
      cachedRuns = sortRunnerActivities(data);
      cachedAt = Date.now();
      return cachedRuns;
    })
    .finally(() => {
      inflightRunsPromise = null;
    });

  return inflightRunsPromise;
}

export function primeRunnerActivitiesCache(runs) {
  cachedRuns = sortRunnerActivities(runs);
  cachedAt = Date.now();
}

export function clearRunnerActivitiesCache() {
  cachedRuns = null;
  cachedAt = 0;
  inflightRunsPromise = null;
}
