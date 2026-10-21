/**
 * The picture of a trend: the day across, the value up, a dot for each run, the middle as a line, the usual spread as a band and the trend line. Pure geometry in the
 * plot's own units, from the model of `buildMetricTrend`; the page draws it. The pace axis is turned over (the quicker pace is higher up), so a line that climbs is a
 * runner getting quicker, as it is for every other value.
 */
const PAD_LEFT = 52;
const PAD_RIGHT = 16;
/** The top margin has a line of its own for the unit of the axis, above the first tick. */
const PAD_TOP = 26;
const PAD_BOTTOM = 30;

/** The steps an axis may take, for a value that is a time (seconds) so that the ticks fall on whole minutes and quarters, not on 2.5 seconds. */
const SECOND_STEPS = Object.freeze([5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200]);
/** The share of the span of the values that is left above and below them. */
const PADDING = 0.08;
/** The ticks an axis is meant to have, near enough. */
const TARGET_TICKS = 5;

/** The metrics whose value is a number of seconds: their ticks fall on whole minutes. */
const SECONDS_METRICS = new Set(['pace', 'duration']);

/** The steps an axis may take for the other metrics: whole beats and steps, tenths and halves of a kilometre, hundredths of a metre for a heartbeat. */
const STEPS_BY_METRIC = Object.freeze({
  heartRate: [1, 2, 5, 10, 20, 25, 50],
  cadence: [1, 2, 5, 10, 20, 25, 50],
  distance: [0.5, 1, 2, 5, 10, 20, 50, 100],
  efficiency: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5],
});

const KM_PER_MILE = 1.609344;

/** What a value of the model (seconds a kilometre, kilometres) is multiplied by to be in the runner's unit: a pace is seconds a mile, a distance miles; the rest has no unit of distance. */
export function unitFactor(metric, unit) {
  if (unit !== 'mile') return 1;
  if (metric === 'pace') return KM_PER_MILE;
  if (metric === 'distance') return 1 / KM_PER_MILE;
  return 1;
}

/** Axis steps for a value of any size: 1, 2, 2.5 and 5 of a power of ten. */
function generalSteps(span) {
  const base = 10 ** Math.floor(Math.log10(Math.max(span, Number.EPSILON) / TARGET_TICKS));
  return [1, 2, 2.5, 5, 10, 20, 25, 50].map((factor) => factor * base);
}

/** Round numbers from below `low` to above `high`, no more than about TARGET_TICKS + 1 of them. */
export function niceTicks(low, high, { seconds = false, steps: given = null } = {}) {
  // A span of nothing (one value, or all the same) is given a width of a tenth of the value, or 1, and centred on it.
  if (!(high - low > 0)) {
    const width = Math.max(Math.abs(low) * 0.1, 1);
    const centre = low;
    low = centre - width / 2;
    high = centre + width / 2;
  }
  const span = high - low;
  const steps = given ?? (seconds ? SECOND_STEPS : generalSteps(span));
  const step = steps.find((candidate) => span / candidate <= TARGET_TICKS) ?? steps[steps.length - 1];
  const first = Math.floor(low / step + 1e-9);
  const last = Math.ceil(high / step - 1e-9);
  const ticks = [];
  // Each tick is a whole number of steps, rounded to twelve digits so that 12 steps of 0.1 are 1.2 and not 1.2000000000000002.
  for (let index = first; index <= last; index += 1) ticks.push(Number((index * step).toPrecision(12)));
  return ticks;
}

/**
 * @param {ReturnType<import('./metricTrend').buildMetricTrend>} trend the model; it has at least one point
 * @param {{ width?: number, height?: number, unit?: string }} [size] `unit` is the runner's ('km' or 'mile'): the axis, its ticks and the dots are in it, so that the ticks are round in miles
 * (the `value` of a tick is in that unit; the `point` of a dot keeps the model's own value).
 * @returns null with no point; otherwise the boxes, the ticks, a dot for each run (`dots`), where the middle and the band fall, and the trend line to draw:
 *   `straight` (two ends) or `averagePath` (an SVG path), whichever the model has and can draw.
 */
export function buildTrendPlot(trend, { width = 640, height = 270, unit = 'km' } = {}) {
  if (!trend || trend.points.length === 0) return null;
  const invert = trend.metric === 'pace';
  const factor = unitFactor(trend.metric, unit);
  const scaled = (value) => value * factor;
  const seconds = SECONDS_METRICS.has(trend.metric);
  const plotWidth = Math.max(120, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(80, height - PAD_TOP - PAD_BOTTOM);

  const values = trend.points.map((point) => scaled(point.value));
  if (trend.stats) values.push(scaled(trend.stats.low), scaled(trend.stats.high));
  if (trend.trend.ok && trend.trend.line === 'straight') values.push(scaled(trend.trend.from.value), scaled(trend.trend.to.value));
  if (trend.trend.ok && trend.trend.line === 'average') values.push(...trend.trend.path.map((point) => scaled(point.value)));
  let low = Math.min(...values);
  let high = Math.max(...values);
  const margin = (high - low) * PADDING || Math.abs(high) * 0.05 || 1;
  low -= margin;
  high += margin;
  if (Math.min(...values) >= 0 && low < 0) low = 0;
  const ticks = niceTicks(low, high, { seconds, steps: STEPS_BY_METRIC[trend.metric] ?? null });
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  const yOf = (modelValue) => {
    const share = (scaled(modelValue) - bottom) / (top - bottom);
    return PAD_TOP + (invert ? share : 1 - share) * plotHeight;
  };

  const spanX = Math.max(1, trend.toX - trend.fromX);
  const xOf = (x) => PAD_LEFT + Math.min(1, Math.max(0, (x - trend.fromX) / spanX)) * plotWidth;
  const labels = plotWidth >= 360 ? 3 : 2;
  const xTicks = [];
  for (let index = 0; index <= labels; index += 1) {
    const at = trend.fromX + (spanX * index) / labels;
    xTicks.push({ at, x: xOf(at) });
  }

  const dots = trend.points.map((point) => ({ point, x: xOf(point.x), y: yOf(point.value) }));
  const stats = trend.stats;
  const straight = trend.trend.ok && trend.trend.line === 'straight'
    ? { x1: xOf(trend.trend.from.x), y1: yOf(trend.trend.from.value), x2: xOf(trend.trend.to.x), y2: yOf(trend.trend.to.value) }
    : null;
  const averagePath = trend.trend.ok && trend.trend.line === 'average'
    ? trend.trend.path.map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(point.x).toFixed(2)},${yOf(point.value).toFixed(2)}`).join(' ')
    : null;
  const bandY = [yOf(stats.low), yOf(stats.high)];

  return {
    width,
    height,
    padL: PAD_LEFT,
    padR: PAD_RIGHT,
    padT: PAD_TOP,
    baseline: PAD_TOP + plotHeight,
    invert,
    yTicks: ticks.map((value) => ({ value, y: yOf(value / factor) })),
    xTicks,
    dots,
    medianY: yOf(stats.median),
    band: { top: Math.min(...bandY), bottom: Math.max(...bandY) },
    straight,
    averagePath,
  };
}
