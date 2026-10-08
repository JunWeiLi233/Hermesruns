import { kmOf } from '../../utils/analysisInsights.js';

// Legacy headroom estimate retained for existing consumers.
export function getLoadBalanceZoneKey(key) {
  return ({ under: 'low', warning: 'moderate', danger: 'high', low: 'low', moderate: 'moderate', high: 'high', optimal: 'optimal' })[key] || 'unknown';
}

export function getLoadBalanceHeadroom(entry) {
  if (!Number.isFinite(entry?.acute) || entry.acute < 0 || !Number.isFinite(entry?.chronic) || entry.chronic <= 0) return null;
  const margin = 1.3 * entry.chronic - entry.acute;
  return {
    value: Math.max(0, Math.round(margin * 7)),
    percent: Math.round(Math.max(0, Math.min(100, margin / (0.5 * entry.chronic) * 100))),
  };
}

export function getLoadContribution(load, maxLoad) {
  if (!Number.isFinite(load) || !Number.isFinite(maxLoad) || maxLoad <= 0) return 0;
  return Math.max(0, Math.min(100, load / maxLoad * 100));
}

const DAY_MS = 86400000;
const ACUTE_ALPHA = 2 / 8;
const CHRONIC_ALPHA = 2 / 29;

function dateTime(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const time = Date.parse(`${key}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === key ? time : null;
}

// Each row is an independent single-day scenario using the same EWMA as
// buildTrainingLoad, with zero load on intervening days. Budgets are not additive.
export function buildLoadBalanceBudget(trainingLoad) {
  const anchor = dateTime(trainingLoad?.days?.at(-1));
  let acute = trainingLoad?.lastAcute;
  let chronic = trainingLoad?.lastChronic;
  if (anchor == null || !Number.isFinite(acute) || acute < 0 || !Number.isFinite(chronic) || chronic <= 0.5 || !Number.isFinite(trainingLoad?.lastAcwr)) return [];
  return Array.from({ length: 7 }, (_, index) => {
    acute *= 1 - ACUTE_ALPHA;
    chronic *= 1 - CHRONIC_ALPHA;
    const margin = 1.3 * chronic - acute;
    const value = Math.max(0, Math.floor(margin / (ACUTE_ALPHA - 1.3 * CHRONIC_ALPHA)));
    return { date: new Date(anchor + (index + 1) * DAY_MS).toISOString().slice(0, 10), value };
  });
}

export function getLoadBalanceWeekStats(trainingLoad, runs) {
  const anchor = dateTime(trainingLoad?.days?.at(-1));
  if (anchor == null) return { volumeKm: null, volumeDelta: null, monotony: null, baseDelta: null, chronicTrend: 'unknown' };
  let volumeKm = 0;
  let previousKm = 0;
  for (const run of runs) {
    const started = new Date(run.startTime || run.startDate || 0);
    if (!Number.isFinite(started.getTime()) || Number(run.movingTimeSeconds) <= 0) continue;
    const day = dateTime(started.toISOString().slice(0, 10));
    const distance = kmOf(run);
    if (!Number.isFinite(distance) || distance <= 0 || day > anchor || day <= anchor - 14 * DAY_MS) continue;
    if (day > anchor - 7 * DAY_MS) volumeKm += distance;
    else previousKm += distance;
  }
  const daily = trainingLoad.dailyLoads?.slice(-7) || [];
  const mean = daily.reduce((sum, load) => sum + load, 0) / 7;
  const variance = daily.reduce((sum, load) => sum + (load - mean) ** 2, 0) / 7;
  const monotony = daily.length === 7 && mean > 0 ? (variance > 0 ? mean / Math.sqrt(variance) : Infinity) : null;
  const chronic = trainingLoad.lastChronic;
  const previousChronic = trainingLoad.chronicSeries?.at(-8);
  const chronicChange = previousChronic > 0 ? (chronic - previousChronic) / previousChronic : null;
  return {
    volumeKm,
    volumeDelta: previousKm > 0 ? Math.round((volumeKm / previousKm - 1) * 100) : null,
    monotony,
    baseDelta: chronic > 0 ? Math.round((trainingLoad.lastAcute / chronic - 1) * 100) : null,
    chronicTrend: chronicChange == null ? 'unknown' : chronicChange > 0.03 ? 'rising' : chronicChange < -0.03 ? 'falling' : 'steady',
  };
}

export function getLoadBalanceRecentRuns(rows, referenceDate) {
  const anchor = dateTime(referenceDate);
  if (anchor == null) return [];
  return rows.filter((row) => {
    const day = dateTime(row.trainingDate);
    return day != null && day <= anchor && day > anchor - 7 * DAY_MS;
  }).sort((a, b) => (b.loadScore || 0) - (a.loadScore || 0));
}
