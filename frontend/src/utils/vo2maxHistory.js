/**
 * The VO2max number over time: what it was right after each run, by the same rule that gives today's number, and a table of
 * the years. A point is what `estimateCurrentVdot` would have said at the moment the run ended, from the runs there were by
 * then (their highest heart rate and their median pace included), so the last point is the number on the page and a runner
 * can see how it got there. Pure: it takes the run list the Analysis page loads and reads the rule from vdot.js.
 * See docs/README-ANALYSIS.md, "The number over time".
 */
import {
  VDOT_LOOKBACK_MS,
  VDOT_MIN_KM_LOOSE,
  VDOT_TOP_N,
  buildVdotEntry,
  estimateCurrentVdot,
  representativeVdotFromEntries,
} from './vdot';
import { runDayKey, runnersToday } from './calendarDays';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back a point looks: the window of the number itself (90 days). */
const WINDOW_MS = VDOT_LOOKBACK_MS;

/** The time ranges the line can be looked at over: `days` back from now, or all of it. */
export const HISTORY_RANGES = [
  { key: '6m', days: 182 },
  { key: '1y', days: 365 },
  { key: 'all', days: null },
];
export const DEFAULT_HISTORY_RANGE = '1y';

/** A point is firm when the number was the mean of this many runs; with fewer it is one run's estimate and swings with it. */
export const FIRM_POINT_RUNS = VDOT_TOP_N;

/** The time a range starts at (ms), or null for all of it. A range that is not one of the known ones is the default. */
export function historyRangeStart(rangeKey, now = Date.now()) {
  const range = HISTORY_RANGES.find((candidate) => candidate.key === rangeKey)
    ?? HISTORY_RANGES.find((candidate) => candidate.key === DEFAULT_HISTORY_RANGE);
  return range.days == null ? null : now - range.days * DAY_MS;
}

function startOf(run) {
  const time = new Date(run?.startTime || run?.startDate || 0).getTime();
  return Number.isFinite(time) && time > 0 ? time : null;
}

/** Resolve the supplied account zone's calendar boundary without changing point instants. */
function startOfYear(year, timeZone) {
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      const wall = Date.UTC(year, 0, 1);
      let instant = wall;
      for (let step = 0; step < 3; step += 1) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
        instant += wall - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      }
      return instant;
    } catch { /* Older histories without a usable account zone keep their original boundary. */ }
  }
  return new Date(year, 0, 1).getTime();
}

/** Puts `value` into the ascending list `sorted` where it belongs. */
function insertSorted(sorted, value) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < value) low = middle + 1;
    else high = middle;
  }
  sorted.splice(low, 0, value);
}

/**
 * The average of the number over a stretch, worked out from the points and not from the days (the number is worked out after each run, not every day).
 * Each point counts for the days it stood: from its run to the next point, to `to` for the last, and for 90 days at most, because the number is made
 * from the runs of the 90 days and with none for 90 days there is no number left to stand. Only the firm points count (the mean of three runs), as for
 * the highest and the lowest, so the average always lies between the two. It is the number of each point as it is printed, so it can be checked by hand
 * from the dots. Between two runs the real number can fall as runs leave the 90 days; the average holds the earlier number until the next run, so after a
 * long break it reads a little high.
 *
 * @param {Array} points the points of the stretch, oldest first, thin ones too (they end the stand of the point before them and count for nothing)
 * @param {{ to: number }} span `to`: where the stretch ends (ms): today, or the end of the year
 * @returns {{ value: number, days: number } | null} the average (not rounded) and the days it is of; null when no firm point stood any time
 */
export function averageOfPoints(points, { to }) {
  let sum = 0;
  let days = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point.firm) continue;
    const next = index + 1 < points.length ? points[index + 1].time : to;
    const stood = (Math.min(next, point.time + WINDOW_MS, to) - point.time) / DAY_MS;
    if (!(stood > 0)) continue;
    sum += point.value * stood;
    days += stood;
  }
  return days > 0 ? { value: sum / days, days } : null;
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them
 * @param {{ now?: number }} [options]
 * @returns `points`, oldest first, one for each run after which the number was worked out from some run of the 90 days
 *   before it, and last one more for the moment `now` when the number then is one (the number on the page): each has
 *   `time`, `date`, `value` (one decimal), `usedCount` (the runs the value is the mean of), `firm`, and for a run's own
 *   point the run's `id` and `name`; `years`, newest first, each with `year`, `high` and `low` (a value and the date
 *   of it, from the firm points only, null with none), `average` (see averageOfPoints, of the year's own points to its end, to today
 *   for this year), `end` (the last value of the year: today's, for the current year), `runs` and `km` (every run of the year), `current`; `now`, today's number (null when there is none); and
 *   `at`, the moment it was worked out for.
 */
export function buildVo2maxHistory(runs, { now = Date.now() } = {}) {
  const list = (Array.isArray(runs) ? runs : []).filter((run) => run && typeof run === 'object');
  const today = runnersToday(list, new Date(now));
  const accountZone = list.find(run => run.accountTimeZone)?.accountTimeZone;
  const dated = list
    .map((run) => ({ run, time: startOf(run) }))
    .filter((item) => item.time != null)
    .sort((a, b) => a.time - b.time || Number(a.run.id ?? 0) - Number(b.run.id ?? 0));

  // The rule needs two things taken from all the runs there are: the highest heart rate and the median pace. Here they are
  // taken from the runs there were by each moment, kept as the runs are read in order.
  let peak = 0;
  const paces = [];
  const points = [];
  let first = 0;
  dated.forEach(({ run, time }, index) => {
    if (Number(run.maxHeartRate) > peak) peak = Number(run.maxHeartRate);
    const km = Number(run.distanceKm || 0);
    const seconds = Number(run.movingTimeSeconds || 0);
    if (km >= VDOT_MIN_KM_LOOSE && seconds > 0) insertSorted(paces, seconds / km);
    while (first < index && time - dated[first].time > WINDOW_MS) first += 1;

    const stats = { hrMax: peak >= 130 ? peak : 0, medianPaceSecPerKm: paces.length ? paces[Math.floor(paces.length / 2)] : null };
    const entries = [];
    for (let at = first; at <= index; at += 1) {
      const entry = buildVdotEntry(dated[at].run, { maxAgeMs: WINDOW_MS, now: time, stats });
      if (entry) entries.push(entry);
    }
    const { value, usedCount } = representativeVdotFromEntries(entries);
    if (value > 0) {
      points.push({
        time, date: new Date(time), day: runDayKey(run), value, usedCount, firm: usedCount >= FIRM_POINT_RUNS, id: run.id ?? null, name: typeof run.name === 'string' ? run.name : '',
      });
    }
  });

  // Today's number, whatever the last run was: it is the number on the page, and it falls as runs age out of the 90 days.
  const current = estimateCurrentVdot(list, now);
  const nowValue = current.representativeVdot > 0 ? current.representativeVdot : null;
  const last = points[points.length - 1];
  if (nowValue != null && (!last || last.time < now)) {
    points.push({ time: now, date: new Date(now), day: today, value: nowValue, usedCount: current.usedTopN, firm: current.usedTopN >= FIRM_POINT_RUNS, id: null, name: '', now: true });
  }

  const byYear = new Map();
  const yearOf = (year) => {
    if (!byYear.has(year)) byYear.set(year, { year, high: null, low: null, average: null, end: null, runs: 0, km: 0, current: false });
    return byYear.get(year);
  };
  for (const { run } of dated) {
    const row = yearOf(Number(runDayKey(run).slice(0, 4)));
    row.runs += 1;
    row.km += Number(run.distanceKm || 0) > 0 ? Number(run.distanceKm) : 0;
  }
  for (const point of points) {
    const row = yearOf(Number(point.day.slice(0, 4)));
    row.end = point.value;
    if (!point.firm) continue;
    const date = new Date(`${point.day}T12:00:00`);
    if (row.high == null || point.value >= row.high.value) row.high = { value: point.value, date };
    if (row.low == null || point.value < row.low.value) row.low = { value: point.value, date };
  }
  const thisYear = Number(today.slice(0, 4));
  if (byYear.has(thisYear)) byYear.get(thisYear).current = true;
  for (const row of byYear.values()) {
    // The year's own points, up to the end of the year (up to today for this year).
    const ofYear = points.filter((point) => Number(point.day.slice(0, 4)) === row.year);
    row.average = averageOfPoints(ofYear, { to: row.year === thisYear ? now : startOfYear(row.year + 1, accountZone) });
  }

  return {
    points,
    years: [...byYear.values()].sort((a, b) => b.year - a.year),
    now: nowValue,
    at: now,
  };
}

const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const MIN_SPAN = 4;

function valueStep(span) {
  if (span <= 8) return 1;
  return span <= 16 ? 2 : 5;
}

/**
 * The line of the number: the day across (from `start`, or from the first point when it is null, to `now`), the VO2max up.
 * Returns null with no point in the range; otherwise the boxes, the ticks, the points with their positions, the path of
 * the line, the highest and the lowest firm point in the range (null with none) and the average of the points drawn (see
 * averageOfPoints; null with none).
 */
export function buildHistoryPlot({ points, start = null, now, width = 640, height = 260 }) {
  const visible = (Array.isArray(points) ? points : []).filter(
    (point) => Number.isFinite(point?.value) && Number.isFinite(point?.time) && (start == null || point.time >= start),
  );
  if (visible.length === 0) return null;

  const plotWidth = Math.max(120, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(80, height - PAD_TOP - PAD_BOTTOM);
  const from = start ?? visible[0].time;
  const to = Math.max(now, visible[visible.length - 1].time);
  const span = Math.max(DAY_MS, to - from);
  const xOf = (time) => PAD_LEFT + Math.min(1, Math.max(0, (time - from) / span)) * plotWidth;

  const values = visible.map((point) => point.value);
  let low = Math.floor(Math.min(...values) - 1);
  let high = Math.ceil(Math.max(...values) + 1);
  if (high - low < MIN_SPAN) {
    low = Math.floor((low + high) / 2 - MIN_SPAN / 2);
    high = low + MIN_SPAN;
  }
  const yOf = (value) => PAD_TOP + (1 - (value - low) / (high - low)) * plotHeight;

  const step = valueStep(high - low);
  const yTicks = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high; tick += step) yTicks.push({ value: tick, y: yOf(tick) });

  const labels = plotWidth >= 360 ? 3 : 2;
  const xTicks = [];
  for (let index = 0; index <= labels; index += 1) {
    const time = from + (span * index) / labels;
    xTicks.push({ time, x: xOf(time) });
  }

  const dots = visible.map((point) => ({ point, x: xOf(point.time), y: yOf(point.value) }));
  const firm = visible.filter((point) => point.firm);
  const highest = firm.length > 0 ? firm.reduce((best, point) => (point.value >= best.value ? point : best)) : null;
  const lowest = firm.length > 0 ? firm.reduce((best, point) => (point.value < best.value ? point : best)) : null;

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
    path: dots.map((dot, index) => `${index === 0 ? 'M' : 'L'}${dot.x.toFixed(2)},${dot.y.toFixed(2)}`).join(' '),
    highest: highest ? { point: highest, x: xOf(highest.time), y: yOf(highest.value) } : null,
    lowest: lowest ? { point: lowest, x: xOf(lowest.time), y: yOf(lowest.value) } : null,
    average: averageOfPoints(visible, { to: now }),
    from,
    to,
  };
}

/**
 * Where the readout of one point goes, in the plot's own units: centred on the point, above it or, with no room above, below it, and always inside the plot
 * sideways. It is never over the point it is about, whatever the width of the plot (on a phone a readout does not fit beside a point in the middle of the line).
 *
 * @param {{ x: number, y: number }} dot a dot of `buildHistoryPlot`
 * @param {{ width: number, height: number }} plot
 * @param {{ width?: number, height?: number }} [box] the readout's own size as drawn (its text sets both, and the reader sets the text size), or a guess before it has been measured
 * @returns {{ left: number, top: number }}
 */
export function historyTooltipPosition(dot, plot, { width = 208, height = 84 } = {}) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const left = clamp(dot.x - width / 2, 8, Math.max(8, plot.width - width - 8));
  const above = dot.y - height - 14;
  const top = above >= 4 ? above : clamp(dot.y + 14, 4, Math.max(4, plot.height - height - 4));
  return { left, top };
}
