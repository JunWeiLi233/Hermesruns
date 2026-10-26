/**
 * The runs behind the VO2max number (the VDOT): every run of the last 90 days that gives an estimate, which of them the
 * number is the mean of, and what the rule that picks them needs from the runner's data. Pure: it takes the run list the
 * Analysis page loads and reads the rule from vdot.js, so the page that shows the working cannot drift from the number.
 */
import {
  NO_HR_MAX_PACE_SLOP_FACTOR,
  VDOT_LOOKBACK_MS,
  VDOT_MIN_KM_LOOSE,
  VDOT_MIN_KM_STRICT,
  VDOT_TOP_N,
  estimateCurrentVdot,
  fractionVo2maxFromHeartRate,
} from './vdot';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back the runs are taken from. */
export const WINDOW_DAYS = VDOT_LOOKBACK_MS / DAY_MS;
/** When any run is this long (km), only runs this long make up the pool the best are taken from. */
export const POOL_MIN_KM = VDOT_MIN_KM_STRICT;
/** How many of the estimates the number is the mean of. */
export const TOP_COUNT = VDOT_TOP_N;
/** The shortest run that gets an estimate at all (km). */
export const SHORTEST_KM = VDOT_MIN_KM_LOOSE;
/** A run without a heart rate that is more than this many times the median pace gets no estimate. */
export const SLOW_RUN_FACTOR = NO_HR_MAX_PACE_SLOP_FACTOR;

/** The smallest drop (VO2max points) worth saying "without your best run" about: below it the answer is the same number. */
const MIN_DROP = 0.1;

const round1 = (value) => Math.round(value * 10) / 10;
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

/** How many runs the rule considered and gave no estimate: long enough, in the window, but too slow without a heart rate. */
function countLeftOut(runs, kept, now) {
  let count = 0;
  for (const run of runs) {
    const km = Number(run.distanceKm || 0);
    const seconds = Number(run.movingTimeSeconds || 0);
    if (km < SHORTEST_KM || seconds <= 0) continue;
    const time = new Date(run.startTime || run.startDate || 0).getTime();
    if (Number.isNaN(time) || now - time > VDOT_LOOKBACK_MS) continue;
    if (!kept.has(run)) count += 1;
  }
  return count;
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them
 * @param {{ now?: number }} [options]
 * @returns the rows (highest estimate first), the arithmetic of the number and the inputs of the rule; `rows` is empty
 *   when no run of the window gives an estimate.
 */
export function buildVdotEvidence(runs, { now = Date.now() } = {}) {
  const list = (Array.isArray(runs) ? runs : []).filter((run) => run && typeof run === 'object');
  const estimate = estimateCurrentVdot(list, now);
  const { windowEntries, usedEntries, runStats } = estimate;
  const counted = new Set(usedEntries);
  const strict = estimate.pool === 'strict';

  const rows = windowEntries.map((entry, position) => {
    const run = entry.run;
    const averageHeartRate = Number(run.averageHeartRate);
    return {
      key: run.id != null ? `run-${run.id}` : `entry-${position}`,
      id: run.id ?? null,
      name: typeof run.name === 'string' ? run.name : '',
      date: entry.date,
      distanceKm: entry.distKm,
      paceSecondsPerKm: Number(run.movingTimeSeconds) / entry.distKm,
      averageHeartRate: averageHeartRate > 40 ? Math.round(averageHeartRate) : null,
      // The share of the highest heart rate the run was held at, which is the share of VO2max the estimate takes it to use.
      heartRateShare: entry.method === 'hr' ? fractionVo2maxFromHeartRate(averageHeartRate, runStats.hrMax) : null,
      method: entry.method,
      vdot: entry.vo2max,
      adjustedVdot: entry.adjustedVo2max,
      counted: counted.has(entry),
      eligible: !strict || entry.distKm >= POOL_MIN_KM,
    };
  });
  rows.sort((a, b) => b.vdot - a.vdot || Number(b.counted) - Number(a.counted) || b.date - a.date);

  const terms = rows.filter((row) => row.counted).map((row) => row.vdot);
  const pool = rows.filter((row) => row.eligible);
  const usedCount = estimate.usedTopN;

  let withoutBest = null;
  if (usedCount > 0 && pool.length > usedCount) {
    const without = mean(pool.slice(1, 1 + usedCount).map((row) => row.vdot));
    const drop = round1(mean(terms) - without);
    if (drop >= MIN_DROP) withoutBest = { value: round1(without), drop };
  }

  const median = runStats.medianPaceSecPerKm;
  return {
    windowDays: WINDOW_DAYS,
    now,
    value: estimate.representativeVdot,
    rows,
    pool: estimate.pool,
    poolCount: estimate.poolCount,
    usedCount,
    methodCounts: {
      hr: rows.filter((row) => row.method === 'hr').length,
      race: rows.filter((row) => row.method === 'race').length,
    },
    hrMax: runStats.hrMax > 0 ? runStats.hrMax : null,
    medianPaceSecondsPerKm: median ?? null,
    slowCutoffSecondsPerKm: median != null ? median * SLOW_RUN_FACTOR : null,
    leftOut: countLeftOut(list, new Set(windowEntries.map((entry) => entry.run)), now),
    // The sum behind the number, so it can be checked by hand: the terms are the unrounded estimates to two decimals.
    arithmetic: terms.length > 0 ? { terms, mean: mean(terms), shown: estimate.representativeVdot } : null,
    withoutBest,
  };
}

const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const MIN_SPAN = 4;
/** Below this plot width the date axis has three labels instead of four. */
const WIDE_PLOT = 360;
/** The width the line's label takes, and how close to the line a dot has to be (both in the plot's own units) to be under it. */
const LABEL_WIDTH = 96;
const LABEL_BAND = 14;

function valueStep(span) {
  if (span <= 8) return 1;
  return span <= 16 ? 2 : 5;
}

/** The end of the line the label goes at: the one with fewer dots on the line, the left end when it is a tie. */
function labelSide(dots, lineY, left, right) {
  const crowd = (from, to) => dots.filter((dot) => dot.x >= from && dot.x <= to && Math.abs(dot.y - lineY) < LABEL_BAND).length;
  return crowd(right - LABEL_WIDTH, right) < crowd(left, left + LABEL_WIDTH) ? 'right' : 'left';
}

/**
 * The dot plot of the estimates: the day across (the window, ending now), the estimate up, the VO2max as a line. A dot is
 * `counted` (in the number), `other` (an estimate the number did not use) or `short` (outside the pool the number is
 * taken from, a run under 3 km while a longer one exists).
 */
export function buildEstimatePlot({ rows, value, now, windowDays = WINDOW_DAYS, width = 640, height = 260 }) {
  const usable = (Array.isArray(rows) ? rows : []).filter(
    (row) => Number.isFinite(row?.vdot) && row.date instanceof Date && !Number.isNaN(row.date.getTime()),
  );
  if (usable.length === 0) return null;

  const plotWidth = Math.max(120, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(80, height - PAD_TOP - PAD_BOTTOM);
  const span = windowDays * DAY_MS;
  const start = now - span;
  const xOf = (time) => PAD_LEFT + Math.min(1, Math.max(0, (time - start) / span)) * plotWidth;

  const all = usable.map((row) => row.vdot).concat(value > 0 ? [value] : []);
  let low = Math.floor(Math.min(...all) - 1);
  let high = Math.ceil(Math.max(...all) + 1);
  if (high - low < MIN_SPAN) {
    low = Math.floor((low + high) / 2 - MIN_SPAN / 2);
    high = low + MIN_SPAN;
  }
  const yOf = (v) => PAD_TOP + (1 - (v - low) / (high - low)) * plotHeight;

  const step = valueStep(high - low);
  const yTicks = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high; tick += step) yTicks.push({ value: tick, y: yOf(tick) });

  const labels = plotWidth >= WIDE_PLOT ? 3 : 2;
  const xTicks = [];
  for (let index = 0; index <= labels; index += 1) {
    const time = start + (span * index) / labels;
    xTicks.push({ time, x: xOf(time) });
  }

  const dots = usable.map((row) => ({
    row,
    x: xOf(row.date.getTime()),
    y: yOf(row.vdot),
    role: !row.eligible ? 'short' : row.counted ? 'counted' : 'other',
  }));

  return {
    width,
    height,
    padL: PAD_LEFT,
    padR: PAD_RIGHT,
    padT: PAD_TOP,
    baseline: PAD_TOP + plotHeight,
    yTicks,
    xTicks,
    dots,
    mean: value > 0 ? { value, y: yOf(value), side: labelSide(dots, yOf(value), PAD_LEFT, PAD_LEFT + plotWidth) } : null,
  };
}
