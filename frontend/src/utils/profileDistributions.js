/** Last N days from "now" (client clock). */
export function filterRunsLastDays(runs, days) {
  if (!runs?.length) return [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return runs.filter((r) => {
    const t = r.startTime || r.startDate;
    if (!t) return false;
    const d = new Date(t);
    return !isNaN(d.getTime()) && d.getTime() >= cutoff;
  });
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Pace in seconds per km (higher = slower). */
export function paceSecPerKm(run) {
  const km = safeNum(run.distanceKm, 0);
  const sec = safeNum(run.movingTimeSeconds, 0);
  if (km < 0.05 || sec <= 0) return null;
  return sec / km;
}

const DIST_BOUNDARIES_KM = [0, 5, 10, 15, 20, 25, Infinity];

export function paceZoneIndex(run, min, max) {
  const p = paceSecPerKm(run);
  if (p == null) return -1;
  if (max - min < 1e-6) return 0;
  let idx = Math.floor(((p - min) / (max - min)) * 6);
  if (idx >= 6) idx = 5;
  if (idx < 0) idx = 0;
  return idx;
}

export function distanceZoneIndex(run) {
  const km = safeNum(run.distanceKm, 0);
  if (km <= 0) return -1;
  if (km >= 25) return 5;
  for (let i = 0; i < 5; i++) {
    if (km >= DIST_BOUNDARIES_KM[i] && km < DIST_BOUNDARIES_KM[i + 1]) return i;
  }
  return 5;
}

export function hrZoneIndex(run, min, max) {
  const h = safeNum(run.averageHeartRate, 0);
  if (h <= 30) return -1;
  if (max - min < 1e-6) return 5;
  let idx = Math.floor(((h - min) / (max - min)) * 6);
  if (idx >= 6) idx = 5;
  if (idx < 0) idx = 0;
  return idx;
}

export function metricValueForRun(run, mode) {
  const km = safeNum(run.distanceKm, 0);
  const sec = safeNum(run.movingTimeSeconds, 0);
  if (mode === 'count') return 1;
  if (mode === 'distance') return km;
  if (mode === 'load') {
    const suffer = safeNum(run.sufferScore, 0);
    if (suffer > 0) return suffer;
    return Math.round((sec / 60) * Math.max(km, 0.1));
  }
  return 0;
}

function paceRange(runs) {
  const paces = runs.map(paceSecPerKm).filter((p) => p != null);
  if (paces.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...paces), max: Math.max(...paces) };
}

function hrRange(runs) {
  const hrs = runs.map((r) => safeNum(r.averageHeartRate, 0)).filter((h) => h > 30);
  if (hrs.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...hrs), max: Math.max(...hrs) };
}

/**
 * @param {'pace'|'distance'|'hr'} zoneKind
 * @param {'count'|'distance'|'load'} metricMode
 */
export function computeZoneValues(runs, zoneKind, metricMode) {
  const pRange = paceRange(runs);
  const hRange = hrRange(runs);
  const buckets = Array(6).fill(0);

  for (const run of runs) {
    let z = -1;
    if (zoneKind === 'pace') z = paceZoneIndex(run, pRange.min, pRange.max);
    else if (zoneKind === 'distance') z = distanceZoneIndex(run);
    else z = hrZoneIndex(run, hRange.min, hRange.max);
    if (z < 0) continue;
    buckets[z] += metricValueForRun(run, metricMode);
  }
  return { values: buckets, paceRange: pRange, hrRange: hRange };
}

export function distanceBucketLabelsKm(t) {
  return [
    t('profile.dist_zone_0_5'),
    t('profile.dist_zone_5_10'),
    t('profile.dist_zone_10_15'),
    t('profile.dist_zone_15_20'),
    t('profile.dist_zone_20_25'),
    t('profile.dist_zone_25p'),
  ];
}
