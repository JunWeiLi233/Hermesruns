/**
 * The long-run check on a prediction page: whether the runner's longest run of the last eight weeks reached three quarters
 * of the race distance. The time a prediction gives is what the runner's fitness would allow over the distance; it does not
 * know whether the runner has run anything like it, and this says so. A HermesRuns rule of thumb, not a research result: the
 * familiar 20-mile run before a marathon is about three quarters of the distance, and the same share is used for every
 * distance. It never changes the time. Pure: it takes the run list the prediction page already loads.
 */
import { formatDistanceValue } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back the runs are looked at, in weeks and in days. */
export const WINDOW_WEEKS = 8;
export const WINDOW_DAYS = WINDOW_WEEKS * 7;
/** The share of the race distance the longest run has to reach. */
export const LONG_RUN_SHARE = 0.75;

/** A distance in the unit the runner reads, to the one decimal it is shown with, so the comparison and the text agree. */
const shown = (km, unit) => Number(formatDistanceValue(km, unit, 1));

/**
 * @param {Array} runs the runner's runs (distanceKm, startTime)
 * @param {number} distanceMeters the race distance
 * @param {{ now?: number, unit?: 'km' | 'mile' }} [options]
 * @returns null without a distance; otherwise the facts and `state`: `none` (no run in the window), `short` (the longest run
 *   is under the rule) or `enough`.
 */
export function buildEnduranceCheck(runs, distanceMeters, { now = Date.now(), unit = 'km' } = {}) {
  const raceKm = Number(distanceMeters) / 1000;
  if (!(raceKm > 0)) return null;

  let longest = null;
  let totalKm = 0;
  let runCount = 0;
  for (const run of Array.isArray(runs) ? runs : []) {
    const km = Number(run?.distanceKm);
    if (!(km > 0)) continue;
    const time = new Date(run.startTime || run.startDate || 0).getTime();
    if (Number.isNaN(time) || now - time > WINDOW_DAYS * DAY_MS) continue;
    runCount += 1;
    totalKm += km;
    if (!longest || km > longest.km) longest = { id: run.id ?? null, name: typeof run.name === 'string' ? run.name : '', km, date: new Date(time) };
  }

  const thresholdKm = raceKm * LONG_RUN_SHARE;
  const base = { weeks: WINDOW_WEEKS, raceKm, thresholdKm, runCount, weeklyKm: totalKm / WINDOW_WEEKS };
  if (!longest) return { ...base, state: 'none', longest: null };
  return {
    ...base,
    state: shown(longest.km, unit) >= shown(thresholdKm, unit) ? 'enough' : 'short',
    longest,
  };
}
