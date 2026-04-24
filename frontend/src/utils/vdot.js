/**
 * Aerobic fitness from running 閳?**Daniels & Gilbert** (*Oxygen Power*, 1979; Jack Daniels *Running Formula*).
 *
 * **Oxygen cost of running** (velocity v in m/min, horizontal):
 *   VO閳?= 閳?.60 + 0.182258璺痸 + 0.000104璺痸铏?  (ml/kg/min)
 */

export const VDOT_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
export const VDOT_MIN_KM_STRICT = 3;
export const VDOT_MIN_KM_LOOSE = 1.5;
export const VDOT_TOP_N = 3;

/** Without HR: only use race formula if pace is not slower than ~15% beyond median (filters easy jogs). */
const NO_HR_MAX_PACE_SLOP_FACTOR = 1.18;

export function danielsRunningVo2CostMlKgMin(velocityMPerMin) {
  const v = velocityMPerMin;
  if (v <= 0) return 0;
  return -4.60 + 0.182258 * v + 0.000104 * v * v;
}

export function danielsFractionOfVo2maxAtDurationMinutes(timeMinutes) {
  if (timeMinutes <= 0) return 0;
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  );
}

export function estimateVo2maxDanielsRaceMlKgMin(distanceMeters, timeMinutes) {
  if (distanceMeters <= 0 || timeMinutes <= 0) return 0;
  const velocity = distanceMeters / timeMinutes;
  const vo2 = danielsRunningVo2CostMlKgMin(velocity);
  const pct = danielsFractionOfVo2maxAtDurationMinutes(timeMinutes);
  return pct > 0 ? vo2 / pct : 0;
}

export function calculateVdot(distanceMeters, timeMinutes) {
  return estimateVo2maxDanielsRaceMlKgMin(distanceMeters, timeMinutes);
}

export function fractionVo2maxFromHeartRate(avgHr, hrMax) {
  if (!avgHr || !hrMax || hrMax < 130) return null;
  const hrPct = Math.min(1.0, avgHr / hrMax);
  return Math.min(0.98, Math.max(0.60, hrPct));
}

function clampVo2maxEstimate(v) {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(88, Math.max(24, v));
}

export function estimateVo2maxFromRun(run, stats) {
  const km = Number(run.distanceKm || 0);
  const sec = Number(run.movingTimeSeconds || 0);
  if (km < VDOT_MIN_KM_LOOSE || sec <= 0) return null;

  const penalty = Number(run.pacePenaltySecPerKm || 0);
  const timeMin = sec / 60;
  const velocityMPerMin = (km * 1000) / timeMin;

  const paceSecPerKm = sec / km;
  const adjustedPaceSecPerKm = Math.max(1, paceSecPerKm - penalty);
  const adjustedVelocityMPerMin = 60000 / adjustedPaceSecPerKm;

  const vo2Cost = danielsRunningVo2CostMlKgMin(velocityMPerMin);
  const adjustedVo2Cost = danielsRunningVo2CostMlKgMin(adjustedVelocityMPerMin);

  const avgHr = Number(run.averageHeartRate);
  const { hrMax, medianPaceSecPerKm } = stats;

  if (avgHr > 40 && hrMax >= 130) {
    const f = fractionVo2maxFromHeartRate(avgHr, hrMax);
    if (f != null && f > 0) {
      return {
        vo2max: clampVo2maxEstimate(vo2Cost / f),
        adjustedVo2max: clampVo2maxEstimate(adjustedVo2Cost / f),
        method: 'hr'
      };
    }
  }

  if (medianPaceSecPerKm != null && paceSecPerKm > medianPaceSecPerKm * NO_HR_MAX_PACE_SLOP_FACTOR) {
    return null;
  }

  const raw = estimateVo2maxDanielsRaceMlKgMin(km * 1000, timeMin);
  const adjusted = adjustedVo2Cost / danielsFractionOfVo2maxAtDurationMinutes(timeMin);

  return raw > 0 ? {
    vo2max: clampVo2maxEstimate(raw),
    adjustedVo2max: clampVo2maxEstimate(adjusted),
    method: 'race'
  } : null;
}

export function precomputeRunStats(runs) {
  let hrMax = 0;
  const paces = [];
  for (const r of runs) {
    const m = Number(r.maxHeartRate);
    if (m > hrMax) hrMax = m;
    const km = Number(r.distanceKm || 0);
    const sec = Number(r.movingTimeSeconds || 0);
    if (km >= VDOT_MIN_KM_LOOSE && sec > 0) paces.push(sec / km);
  }
  paces.sort((a, b) => a - b);
  const medianPaceSecPerKm = paces.length ? paces[Math.floor(paces.length / 2)] : null;
  return { hrMax: hrMax >= 130 ? hrMax : 0, medianPaceSecPerKm };
}

export function vdotToPaceSecondsPerKm(vdot, vo2Fraction) {
  const targetVo2 = vdot * vo2Fraction;
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.60 - targetVo2;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const v = (-b + Math.sqrt(disc)) / (2 * a);
  return v > 0 ? (1000 / v) * 60 : null;
}

export function computeTrainingPaces(vdot) {
  return {
    easy: [vdotToPaceSecondsPerKm(vdot, 0.59), vdotToPaceSecondsPerKm(vdot, 0.74)],
    marathon: [vdotToPaceSecondsPerKm(vdot, 0.80)],
    threshold: [vdotToPaceSecondsPerKm(vdot, 0.88)],
    interval: [vdotToPaceSecondsPerKm(vdot, 0.98)],
    repetition: [vdotToPaceSecondsPerKm(vdot, 1.05)],
  };
}

export function predictRaceTime(vdot, distanceMeters) {
  if (!vdot || vdot <= 0 || distanceMeters <= 0) return null;
  let lo = 1;
  let hi = 600;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const v = calculateVdot(distanceMeters, mid);
    if (v > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function bestRecentNormalizedRaceTimeSec(runs, targetMeters, options = {}) {
  const { lookbackDays = 180 } = options;
  if (!Array.isArray(runs) || !runs.length || targetMeters <= 0) return null;
  const now = Date.now();
  const lookbackMs = lookbackDays * 24 * 60 * 60 * 1000;
  const targetKm = targetMeters / 1000;
  let best = null;

  for (const run of runs) {
    const km = Number(run.distanceKm || (run.distanceMeters ? run.distanceMeters / 1000 : 0));
    const sec = Number(run.movingTimeSeconds || run.durationSeconds || 0);
    const t = new Date(run.startTime || run.startDate || 0).getTime();
    if (!Number.isFinite(km) || !Number.isFinite(sec) || !Number.isFinite(t)) continue;
    if (km <= 0 || sec <= 0 || now - t > lookbackMs) continue;

    const distRatio = km / targetKm;
    if (distRatio < 0.8 || distRatio > 1.2) continue;

    const paceSecPerKm = sec / km;
    const normalizedSec = paceSecPerKm * targetKm;
    if (!Number.isFinite(normalizedSec) || normalizedSec <= 0) continue;
    const ageDays = (now - t) / (24 * 60 * 60 * 1000);

    if (best == null || normalizedSec < best.normalizedSec) {
      best = { normalizedSec, distRatio, ageDays };
    }
  }
  return best;
}

export function predictRaceTimeCalibrated(vdot, distanceMeters, runs, options = {}) {
  const baseMin = predictRaceTime(vdot, distanceMeters);
  if (!baseMin || !Array.isArray(runs) || runs.length === 0) return baseMin;

  const anchor = bestRecentNormalizedRaceTimeSec(runs, distanceMeters, options);
  if (!anchor) return baseMin;

  const baseSec = baseMin * 60;
  const closeness = Math.max(0, 1 - Math.abs(anchor.distRatio - 1) / 0.2);
  const lookbackDays = options.lookbackDays ?? 180;
  const freshness = Math.max(0, 1 - (anchor.ageDays || 0) / lookbackDays);
  const recencyFactor = Math.max(0.15, freshness ** 1.7);
  const weight = (0.45 + 0.35 * closeness) * recencyFactor;
  const blendedSec = baseSec * (1 - weight) + anchor.normalizedSec * weight;
  const floorSec = anchor.ageDays <= 45 ? anchor.normalizedSec * 0.995 : 0;
  return Math.max(blendedSec, floorSec) / 60;
}

export const RACE_DISTANCES = [
  { key: '5k', meters: 5000, label: '5K', labelZh: '5 公里', labelEn: '5K' },
  { key: '10k', meters: 10000, label: '10K', labelZh: '10 公里', labelEn: '10K' },
  { key: 'half', meters: 21097.5, label: 'Half', labelZh: '半程马拉松', labelEn: 'Half Marathon' },
  { key: 'marathon', meters: 42195, label: 'Marathon', labelZh: '马拉松', labelEn: 'Marathon' },
];

export function buildOrderedRacePredictions(vdot, runs, options = {}) {
  if (!vdot || vdot <= 0) return [];
  let previousTimeMin = null;
  return RACE_DISTANCES.map((distance) => {
    const predictedTimeMin = predictRaceTimeCalibrated(vdot, distance.meters, runs, options);
    if (!predictedTimeMin || predictedTimeMin <= 0) return { ...distance, timeMin: null };
    const orderedTimeMin = previousTimeMin == null ? predictedTimeMin : Math.max(predictedTimeMin, previousTimeMin);
    previousTimeMin = orderedTimeMin;
    return { ...distance, timeMin: orderedTimeMin };
  });
}

export function buildVdotEntry(run, options = {}) {
  const { maxAgeMs = VDOT_LOOKBACK_MS, now = Date.now(), stats: statsOverride } = options;
  const km = Number(run.distanceKm || 0);
  const sec = Number(run.movingTimeSeconds || 0);
  if (km < VDOT_MIN_KM_LOOSE || sec <= 0) return null;
  const runDate = new Date(run.startTime || run.startDate || 0);
  if (Number.isNaN(runDate.getTime())) return null;
  if (maxAgeMs != null && now - runDate.getTime() > maxAgeMs) return null;

  const stats = statsOverride || precomputeRunStats([run]);
  const est = estimateVo2maxFromRun(run, stats);
  if (!est || est.vo2max <= 0) return null;

  return {
    vo2max: est.vo2max,
    adjustedVo2max: est.adjustedVo2max || est.vo2max,
    vdot: est.vo2max,
    method: est.method,
    date: runDate,
    run,
    distKm: km,
  };
}

export function representativeVdotFromEntries(entries) {
  if (!entries.length) return { value: 0, adjustedValue: 0, bestRun: null, usedCount: 0 };
  const strict = entries.filter((e) => e.distKm >= VDOT_MIN_KM_STRICT);
  const pool = strict.length > 0 ? strict : entries;

  const sorted = [...pool].sort((a, b) => b.vo2max - a.vo2max);
  const sortedAdj = [...pool].sort((a, b) => b.adjustedVo2max - a.adjustedVo2max);

  const n = Math.min(VDOT_TOP_N, sorted.length);
  const top = sorted.slice(0, n);
  const topAdj = sortedAdj.slice(0, n);

  const value = Math.round((top.reduce((s, e) => s + e.vo2max, 0) / n) * 10) / 10;
  const adjustedValue = Math.round((topAdj.reduce((s, e) => s + e.adjustedVo2max, 0) / n) * 10) / 10;

  return {
    value,
    adjustedValue,
    bestRun: top[0].run,
    usedCount: n,
  };
}

export function estimateCurrentVdot(runs, now = Date.now()) {
  const stats = precomputeRunStats(runs);
  const windowEntries = [];
  for (const run of runs) {
    const e = buildVdotEntry(run, { maxAgeMs: VDOT_LOOKBACK_MS, now, stats });
    if (e) windowEntries.push(e);
  }
  const { value, adjustedValue, bestRun, usedCount } = representativeVdotFromEntries(windowEntries);
  return {
    representativeVdot: value,
    adjustedVdot: adjustedValue,
    bestRun,
    usedTopN: usedCount,
    windowEntries,
    runStats: stats,
  };
}

export function collectAllVdotEntries(runs) {
  const stats = precomputeRunStats(runs);
  const out = [];
  for (const run of runs) {
    const e = buildVdotEntry(run, { maxAgeMs: null, now: Date.now(), stats });
    if (e) out.push(e);
  }
  out.sort((a, b) => a.date - b.date);
  return out;
}

export function computeVdotTrend(runs, now = Date.now()) {
  const stats = precomputeRunStats(runs);
  const ms30 = 30 * 24 * 60 * 60 * 1000;
  const recentEntries = [];
  const priorEntries = [];

  for (const run of runs) {
    const e = buildVdotEntry(run, { maxAgeMs: null, now, stats });
    if (!e) continue;
    const age = now - e.date.getTime();
    if (age <= ms30) recentEntries.push(e);
    else if (age <= 2 * ms30) priorEntries.push(e);
  }

  if (recentEntries.length === 0 || priorEntries.length === 0) {
    return { direction: 'maintaining', delta: 0, hasData: false };
  }

  const { value: recentVdot } = representativeVdotFromEntries(recentEntries);
  const { value: priorVdot } = representativeVdotFromEntries(priorEntries);
  if (recentVdot <= 0 || priorVdot <= 0) return { direction: 'maintaining', delta: 0, hasData: false };

  const delta = Math.round((recentVdot - priorVdot) * 10) / 10;
  let direction = 'maintaining';
  if (delta >= 0.8) direction = 'improving';
  else if (delta <= -0.8) direction = 'declining';

  return { direction, delta, hasData: true };
}

export function computeRollingRepresentativeSeries(sortedEntries, windowMs = VDOT_LOOKBACK_MS) {
  const result = [];
  for (let i = 0; i < sortedEntries.length; i += 1) {
    const end = sortedEntries[i].date.getTime();
    const start = end - windowMs;
    const inWindow = [];
    for (let j = 0; j <= i; j += 1) {
      const t = sortedEntries[j].date.getTime();
      if (t >= start && t <= end) inWindow.push(sortedEntries[j]);
    }
    const { value, adjustedValue } = representativeVdotFromEntries(inWindow);
    if (value > 0) {
      result.push({
        x: end,
        y: value,
        adjustedY: adjustedValue,
        date: sortedEntries[i].date
      });
    }
  }
  return result;
}
