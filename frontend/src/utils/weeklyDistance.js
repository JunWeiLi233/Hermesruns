/**
 * Weekly distance and its moving average: how far the runner ran in each week, and for each finished week the mean of the distance of the four weeks
 * up to and including it. Pure: it takes the run list the Analysis page loads (the weeks are the runner's own, Monday to Sunday, read off the date of
 * each run as `calendarDays` does) and has no judgement in it, no target and no "too much": the average is a description of the runner's own habit.
 * See docs/README-ANALYSIS.md, "Weekly distance and its moving average".
 */
import { addDaysToKey, runDayKey, runnersToday } from './calendarDays';
import { niceCeiling } from './fitnessChart';

/** How many weeks the average is the mean of. */
export const AVERAGE_WEEKS = 4;

/** The ranges the chart can be looked at over: that many weeks back from this one, this week included. */
export const DISTANCE_RANGES = [
  { key: '12w', weeks: 12 },
  { key: '26w', weeks: 26 },
  { key: '52w', weeks: 52 },
];
export const DEFAULT_DISTANCE_RANGE = '26w';

const KM_PER_MILE = 1.609344;

/** The Monday of the week a "YYYY-MM-DD" day is in. */
export function mondayOf(key) {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysToKey(key, -((weekday + 6) % 7));
}

/** The number of weeks a range covers; a key that is not one of the ranges is the default. */
export function distanceRangeWeeks(rangeKey) {
  return (DISTANCE_RANGES.find((range) => range.key === rangeKey) ?? DISTANCE_RANGES.find((range) => range.key === DEFAULT_DISTANCE_RANGE)).weeks;
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them
 * @param {{ today?: string }} [options] the runner's today as "YYYY-MM-DD" (default: see `runnersToday`)
 * @returns {null | { today: string, weeks: Array<{ start: string, km: number, runs: number, open: boolean, average: number | null }> }}
 *   null when no run has both a date and a distance. Otherwise every week from the one with the first run to the one that `today` is in, oldest first, a
 *   week with no run in it too (with 0). `open` is the week still going. `average` is the mean of the kilometres of the week and the three before it, for a
 *   week that is over and has three weeks of the runner's history behind it; null for the others (the first three weeks, and the week still going).
 *   Runs with no distance, no date or a date after the runner's today are left out; so a run is counted once, in the week of its date.
 */
export function buildWeeklyDistance(runs, { today } = {}) {
  const list = Array.isArray(runs) ? runs : [];
  const now = today ?? runnersToday(list);
  const byWeek = new Map();
  for (const run of list) {
    const day = runDayKey(run);
    const km = Number(run?.distanceKm);
    if (!day || day > now || !(km > 0)) continue;
    const start = mondayOf(day);
    const week = byWeek.get(start) ?? { km: 0, runs: 0 };
    week.km += km;
    week.runs += 1;
    byWeek.set(start, week);
  }
  if (byWeek.size === 0) return null;

  const thisWeek = mondayOf(now);
  let first = thisWeek;
  for (const start of byWeek.keys()) if (start < first) first = start;

  const weeks = [];
  for (let start = first; start <= thisWeek; start = addDaysToKey(start, 7)) {
    const found = byWeek.get(start);
    weeks.push({ start, km: found?.km ?? 0, runs: found?.runs ?? 0, open: start === thisWeek, average: null });
  }
  weeks.forEach((week, index) => {
    if (week.open || index < AVERAGE_WEEKS - 1) return;
    let sum = 0;
    for (let back = 0; back < AVERAGE_WEEKS; back += 1) sum += weeks[index - back].km;
    week.average = sum / AVERAGE_WEEKS;
  });
  return { today: now, weeks };
}

/** What a kilometre figure reads as in the runner's unit. */
export const toUnit = (km, unit) => (unit === 'mile' ? km / KM_PER_MILE : km);

/**
 * The three readings above the chart, from the weeks the range shows: the week still going, the average of the last four finished weeks (the average of
 * the last finished week that has one), and the highest finished week of the range with its Monday (the later one when two are the same).
 * @returns {{ thisWeek: object | null, average: { km: number, to: string } | null, highest: { km: number, start: string } | null }}
 */
export function distanceReadings(weeks) {
  const rows = Array.isArray(weeks) ? weeks : [];
  const thisWeek = rows.find((week) => week.open) ?? null;
  const finished = rows.filter((week) => !week.open);
  const lastAverage = [...finished].reverse().find((week) => week.average != null) ?? null;
  const best = finished.reduce((top, week) => (top == null || week.km >= top.km ? week : top), null);
  return {
    thisWeek,
    average: lastAverage ? { km: lastAverage.average, to: lastAverage.start } : null,
    highest: best && best.km > 0 ? { km: best.km, start: best.start } : null,
  };
}

/**
 * The chart's geometry, in the runner's unit: a bar for the distance of each week, a line through the averages, ticks, and a box for each week for a
 * pointer to pick. `weeks` are the weeks to draw, oldest first (a range's share of what `buildWeeklyDistance` gave).
 * @returns null with no weeks
 */
export function buildDistanceChart(weeks, { width = 640, height = 230, unit = 'km' } = {}) {
  const rows = Array.isArray(weeks) ? weeks.filter((week) => week && Number.isFinite(week.km)) : [];
  if (rows.length === 0) return null;

  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = Math.max(120, width - padL - padR);
  const baseline = height - padB;
  const top = padT;
  const shown = rows.map((week) => ({ ...week, value: toUnit(week.km, unit), averageValue: week.average == null ? null : toUnit(week.average, unit) }));
  const tallest = Math.max(...shown.map((week) => Math.max(week.value, week.averageValue ?? 0)));
  // Whole steps, so that every label of the scale is a whole number (a step of 2.5 would print as 3).
  const step = Math.max(1, Math.ceil(niceCeiling((tallest * 1.1) / 4)));
  const yMax = step * 4;
  const yOf = (value) => baseline - (Math.max(0, value) / yMax) * (baseline - top);

  const slot = plotW / shown.length;
  const barW = Math.max(4, Math.min(44, slot * 0.56));
  const bars = shown.map((week, index) => {
    const centre = padL + slot * (index + 0.5);
    const barTop = yOf(week.value);
    return {
      index,
      week,
      x: centre - barW / 2,
      centre,
      width: barW,
      y: barTop,
      height: Math.max(week.value > 0 ? 2 : 0, baseline - barTop),
      slotX: padL + slot * index,
      slotWidth: slot,
      averageY: week.averageValue == null ? null : yOf(week.averageValue),
    };
  });
  const withAverage = bars.filter((bar) => bar.averageY != null);
  const path = withAverage.map((bar, index) => `${index ? 'L' : 'M'}${bar.centre.toFixed(2)},${bar.averageY.toFixed(2)}`).join(' ');

  // A label under every n-th week counted back from the current one, so the gaps between them are the same and the newest week is named.
  const maxTicks = width < 480 ? 3 : width < 720 ? 5 : 7;
  const every = Math.max(1, Math.ceil(bars.length / maxTicks));
  const xTicks = bars.filter((bar) => (bars.length - 1 - bar.index) % every === 0);
  const yTicks = [0, 1, 2, 3, 4].map((index) => ({ value: step * index, y: yOf(step * index) }));

  return { width, height, padL, padR, padT: top, baseline, yMax, step, bars, xTicks, yTicks, path, withAverage, slot, barW };
}

/** How wide and how tall the readout of a week is taken to be (four rows) until it has been drawn and measured: as it is drawn at the usual text size, a pixel or two over. */
export const DISTANCE_READOUT_WIDTH = 188;
export const DISTANCE_READOUT_HEIGHT = 112;

/**
 * Where the readout for a week goes: beside the bar, on whichever side of the chart has room, and inside the chart; on a chart too narrow for that,
 * above the bar (or at the top of the chart when the bar is that tall), centred on it.
 */
export function distanceTooltipPosition(bar, geometry, { width = DISTANCE_READOUT_WIDTH, height = DISTANCE_READOUT_HEIGHT } = {}) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const toRight = bar.centre + 18;
  const toLeft = bar.centre - width - 18;
  const sideTop = clamp(bar.y - height / 2, 8, Math.max(8, geometry.baseline - height + 24));
  if (toRight + width <= geometry.width - 8) return { left: toRight, top: sideTop };
  if (toLeft >= 8) return { left: toLeft, top: sideTop };
  return { left: clamp(bar.centre - width / 2, 8, Math.max(8, geometry.width - width - 8)), top: Math.max(4, bar.y - height - 8) };
}
