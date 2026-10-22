/**
 * Trends: one thing about the runner's runs, run by run over a period (the pace, the distance, the time, the heart rate, the efficiency or the cadence), with the
 * middle of it, the spread the runs usually keep to, a trend line, and the stretch of the same length before it for comparison. Pure: it takes the run list the
 * Analysis page loads (/api/activities/analysis) and works everything out from that in the browser, so what the page shows can be checked against the runs. It
 * describes and does not judge: no run is good or bad and no change is for the better. See docs/README-ANALYSIS.md, "Trends".
 */
import { addDaysToKey, addMonthsToKey, dayNumber, runDayFraction, runDayKey, runnersToday } from './calendarDays';

/** The things that can be followed, one value for each run. */
export const METRICS = Object.freeze(['pace', 'distance', 'duration', 'heartRate', 'efficiency', 'cadence']);
export const DEFAULT_METRIC = 'pace';

/** Which of the runner's runs are looked at: all, those with no type set, or those of one type the runner set. */
export const RUN_SETS = Object.freeze(['all', 'ordinary', 'long', 'workout', 'race']);
export const DEFAULT_RUN_SET = 'all';
const TYPE_OF_SET = Object.freeze({ long: 'LONG_RUN', workout: 'WORKOUT', race: 'RACE' });
const TYPED = new Set(Object.values(TYPE_OF_SET));

/** The periods, in calendar months back from the runner's today; "all" starts at the first run. */
export const RANGES = Object.freeze([
  { key: '3m', months: 3 },
  { key: '6m', months: 6 },
  { key: '1y', months: 12 },
  { key: 'all', months: null },
]);
export const DEFAULT_RANGE = '6m';

/** The two trend lines: the least-squares straight line through the runs, or the mean of the latest runs at each run. */
export const LINES = Object.freeze(['straight', 'average']);
export const DEFAULT_LINE = 'straight';

/** How many runs the moving average is the mean of, and how many runs there have to be behind it for the line to start. */
export const AVERAGE_RUNS = 10;
export const AVERAGE_FROM = 5;
/** What a straight line needs: this many runs, spread over at least this many days. Under it a line would only be drawn through noise. */
export const MIN_RUNS_FOR_LINE = 5;
export const MIN_DAYS_FOR_LINE = 14;
/** The days a "month" is when a slope is given for a month. */
export const DAYS_PER_MONTH = 30;
/** With this many runs the usual spread is the 10th to the 90th percentile; with fewer it is the lowest to the highest, which is all there is to say. */
export const SPREAD_FROM_RUNS = 10;
/** A comparison with the stretch before needs this many runs in each of the two. */
export const MIN_RUNS_TO_COMPARE = 3;
/** How well a line fits: the share of the differences between the runs that it accounts for (R squared). Under the first it fits hardly at all, under the second loosely. */
export const FIT_LOOSE = 0.1;
export const FIT_CLEAR = 0.3;

/** A heart rate outside these is a sensor fault, not a run's heart rate; the same floor the VO2max estimate uses. */
const HEART_RATE_LOW = 40;
const HEART_RATE_HIGH = 250;
const CADENCE_HIGH = 300;

function distanceKmOf(run) {
  const km = Number(run?.distanceKm);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters);
  return meters > 0 ? meters / 1000 : 0;
}

function heartRateOf(run) {
  const bpm = Number(run?.averageHeartRate);
  return bpm > HEART_RATE_LOW && bpm < HEART_RATE_HIGH ? bpm : null;
}

/**
 * The value of one run for a metric, or null when the run has none (a run with no heart rate has no heart rate and no efficiency, and one with no cadence no
 * cadence). Pace is seconds per kilometre (moving time over distance), the distance is in kilometres, the time is the moving time in seconds, the heart rate is
 * the run's average in beats a minute, the efficiency is the metres run for each heartbeat (speed in metres a minute over the average heart rate) and the cadence
 * is the average the run carries, in steps a minute.
 */
export function metricValue(run, metric) {
  const km = distanceKmOf(run);
  const seconds = Number(run?.movingTimeSeconds);
  if (!(km > 0) || !(seconds > 0)) return null;
  switch (metric) {
    case 'pace': return seconds / km;
    case 'distance': return km;
    case 'duration': return seconds;
    case 'heartRate': return heartRateOf(run);
    case 'efficiency': {
      const bpm = heartRateOf(run);
      return bpm == null ? null : (km * 1000) / (seconds / 60) / bpm;
    }
    case 'cadence': {
      const cadence = Number(run?.averageCadence);
      return cadence > 0 && cadence < CADENCE_HIGH ? cadence : null;
    }
    default: return null;
  }
}

/** Whether a run is one of a set of runs: `ordinary` is a run with none of the three types set (race, long run, workout). */
export function inRunSet(run, runSet) {
  if (runSet === 'all') return true;
  const type = typeof run?.runType === 'string' ? run.runType.toUpperCase() : '';
  if (runSet === 'ordinary') return !TYPED.has(type);
  return type === TYPE_OF_SET[runSet];
}

/** The value below which a share `p` (0 to 1) of an ascending list falls, between its two nearest neighbours in proportion (the usual "linear" quantile). */
export function quantile(sorted, p) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (position - low) * (sorted[high] - sorted[low]);
}

/** The middle, the mean, the lowest, the highest and the usual spread of a list of values; null for none. */
export function summarize(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const usual = count >= SPREAD_FROM_RUNS;
  return {
    count,
    median: quantile(sorted, 0.5),
    mean: sorted.reduce((sum, value) => sum + value, 0) / count,
    min: sorted[0],
    max: sorted[count - 1],
    low: usual ? quantile(sorted, 0.1) : sorted[0],
    high: usual ? quantile(sorted, 0.9) : sorted[count - 1],
    usual,
  };
}

/**
 * The least-squares straight line through points of a day number `x` and a `value`, in the order of x. `ok` is false, with a reason ('few' or 'short'), when the
 * line would be drawn through too little: fewer than MIN_RUNS_FOR_LINE runs or fewer than MIN_DAYS_FOR_LINE days between the first and the last.
 * Otherwise: the change in the value for a month of DAYS_PER_MONTH days, the change along the line from the first run to the last, the two ends of the line to draw,
 * and r2, the share of the differences between the runs that the line accounts for (0 for runs that are all the same, which have nothing to account for).
 */
export function straightLine(points) {
  const count = points.length;
  if (count < MIN_RUNS_FOR_LINE) return { ok: false, reason: 'few' };
  const first = points[0].x;
  const last = points[count - 1].x;
  const span = last - first;
  if (span < MIN_DAYS_FOR_LINE) return { ok: false, reason: 'short' };
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count;
  const meanY = points.reduce((sum, point) => sum + point.value, 0) / count;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.value - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const at = (x) => meanY + slope * (x - meanX);
  return {
    ok: true,
    slopePerDay: slope,
    slopePerMonth: slope * DAYS_PER_MONTH,
    change: slope * span,
    r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy),
    from: { x: first, value: at(first) },
    to: { x: last, value: at(last) },
  };
}

/**
 * At each run from the AVERAGE_FROM-th on, the mean of the values of the AVERAGE_RUNS runs up to and including it (fewer than that for the first ones).
 * `path` is the line; `ok` is false, with the reason 'few', when there are fewer runs than AVERAGE_FROM.
 */
export function movingAverage(points) {
  const path = [];
  for (let index = AVERAGE_FROM - 1; index < points.length; index += 1) {
    const window = points.slice(Math.max(0, index - AVERAGE_RUNS + 1), index + 1);
    path.push({ x: points[index].x, value: window.reduce((sum, point) => sum + point.value, 0) / window.length });
  }
  if (path.length === 0) return { ok: false, reason: 'few', path };
  return { ok: true, path, start: path[0], end: path[path.length - 1], change: path[path.length - 1].value - path[0].value };
}

/** The first and the last day of a period that ends on the runner's `today`, and of the stretch of the same length that ends the day before it begins (null for "all"). */
export function trendPeriod(range, today, firstDay = null) {
  const months = (RANGES.find((candidate) => candidate.key === range) ?? RANGES.find((candidate) => candidate.key === DEFAULT_RANGE)).months;
  if (months == null) return { from: firstDay ?? today, to: today, before: null };
  const from = addMonthsToKey(today, -months);
  return { from, to: today, before: { from: addMonthsToKey(from, -months), to: addDaysToKey(from, -1) } };
}

function toRow(run, metric, today) {
  const day = runDayKey(run);
  if (!day || day > today) return null;
  if (!(distanceKmOf(run) > 0) || !(Number(run.movingTimeSeconds) > 0)) return null;
  return { run, day, value: metricValue(run, metric) };
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them
 * @param {{ metric?: string, runSet?: string, range?: string, line?: string, today?: string }} [options] `today` is the runner's today as "YYYY-MM-DD" (default: `runnersToday`)
 * @returns
 *   - `points`: the runs of the period that have a value, oldest first, each `{ key, id, name, runType, km, day, x, value }` where `x` is the day number with the
 *     hour of the start as a fraction of a day;
 *   - `leftOut`: how many runs of the period (of the chosen set) have no value for the metric and are not among the points;
 *   - `stats`: the summary of the values (see `summarize`), null with no point;
 *   - `trend`: the chosen line, `{ line: 'straight', ... }` (see `straightLine`) or `{ line: 'average', ... }` (see `movingAverage`); `ok: false` with a reason
 *     ('none' with no point) when it cannot be drawn;
 *   - `comparison`: the stretch before, `{ from, to, count, median, ok, change, reason }`, or null for "all"; `ok` needs MIN_RUNS_TO_COMPARE runs in each
 *     stretch and then `change` is the median now less the median then;
 *   - the period (`from`, `to`, `fromX`, `toX`: the day axis, which ends with the end of today) and the choices made.
 */
export function buildMetricTrend(runs, { metric = DEFAULT_METRIC, runSet = DEFAULT_RUN_SET, range = DEFAULT_RANGE, line = DEFAULT_LINE, today } = {}) {
  const list = Array.isArray(runs) ? runs : [];
  const now = today ?? runnersToday(list);
  const rows = list.map((run) => (run && typeof run === 'object' && inRunSet(run, runSet) ? toRow(run, metric, now) : null)).filter(Boolean);

  const withValue = rows.filter((row) => row.value != null);
  const period = trendPeriod(range, now, withValue.reduce((first, row) => (first == null || row.day < first ? row.day : first), null));
  const inPeriod = (row, from, to) => row.day >= from && row.day <= to;

  const points = withValue
    .filter((row) => inPeriod(row, period.from, period.to))
    .map((row) => ({
      key: row.run.id != null ? `run-${row.run.id}` : `${row.day}-${row.value}`,
      id: row.run.id ?? null,
      name: typeof row.run.name === 'string' ? row.run.name : '',
      runType: typeof row.run.runType === 'string' ? row.run.runType.toUpperCase() : '',
      km: distanceKmOf(row.run),
      day: row.day,
      x: dayNumber(row.day) + runDayFraction(row.run),
      value: row.value,
    }))
    .sort((a, b) => a.x - b.x || String(a.key).localeCompare(String(b.key)));
  const leftOut = rows.filter((row) => row.value == null && inPeriod(row, period.from, period.to)).length;

  const stats = summarize(points.map((point) => point.value));
  let trend;
  if (points.length === 0) trend = { line, ok: false, reason: 'none' };
  else if (line === 'average') trend = { line, ...movingAverage(points) };
  else trend = { line: 'straight', ...straightLine(points) };

  let comparison = null;
  if (period.before) {
    const earlier = summarize(withValue.filter((row) => inPeriod(row, period.before.from, period.before.to)).map((row) => row.value));
    const enough = stats != null && stats.count >= MIN_RUNS_TO_COMPARE && earlier != null && earlier.count >= MIN_RUNS_TO_COMPARE;
    comparison = {
      from: period.before.from,
      to: period.before.to,
      count: earlier?.count ?? 0,
      median: earlier?.median ?? null,
      ok: enough,
      change: enough ? stats.median - earlier.median : null,
      reason: enough ? null : 'few',
    };
  }

  return {
    metric, runSet, range, line: trend.line, today: now, from: period.from, to: period.to,
    fromX: dayNumber(period.from), toX: dayNumber(period.to) + 1,
    points, leftOut, stats, trend, comparison,
  };
}
