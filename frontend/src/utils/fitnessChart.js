/**
 * The geometry and the words of the fitness, fatigue and form chart (see docs/README-ANALYSIS.md, "Fitness, fatigue
 * and form"). Pure, so the card only has to draw what it is given and the numbers can be tested without a browser.
 *
 * The chart is up to three panels one above the other, sharing the days along the bottom: fitness and fatigue as lines
 * on the top (both are an average of the daily effort, so they share a scale), form, which is the gap between them and
 * can be negative, as an area around a zero line below, and each day's own effort as a bar in a strip of its own (a
 * day's effort is not an average and can be several times either line, so it has its own scale). The days after today,
 * if the runner rested, continue the lines as a dotted stretch.
 */

/** The windows a runner can look at. `days` counts today. */
export const FITNESS_RANGES = [
  { key: '6w', days: 42 },
  { key: '3m', days: 91 },
  { key: '6m', days: 182 },
  { key: '1y', days: 365 },
];
export const DEFAULT_FITNESS_RANGE = '6m';

/** A day as `yyyy-MM-dd` in the browser's own calendar (what the server reads as a date, not a moment). */
export function isoDay(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The first day of a range that ends today. A range that is not one of the known ones is the default. */
export function rangeStart(rangeKey, today = new Date()) {
  const range = FITNESS_RANGES.find((candidate) => candidate.key === rangeKey)
    ?? FITNESS_RANGES.find((candidate) => candidate.key === DEFAULT_FITNESS_RANGE);
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (range.days - 1), 12, 0, 0);
  return isoDay(first);
}

/** "Oct 7": a day without its year, for axes and tooltips. Anything that is not a real day is "--". */
export function formatShortDate(isoDate, lang) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ''));
  if (!match) return '--';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1) return '--';
  return date.toLocaleDateString(lang || 'en', { month: 'short', day: 'numeric' });
}

/** "+3.2", "−1.4" or "0.0": a change with its sign, using a real minus. */
export function formatChange(value, { digits = 1 } = {}) {
  if (!Number.isFinite(value)) return '–';
  const rounded = Number(Math.abs(value).toFixed(digits));
  if (rounded === 0) return (0).toFixed(digits);
  return `${value > 0 ? '+' : '−'}${rounded.toFixed(digits)}`;
}

/**
 * How fresh the runner is, in a word: `fresh` when form is clearly above zero, `tired` when it is clearly below, `even`
 * in between. "Clearly" is a tenth of fitness, never less than 3 effort points, so a runner with a small fitness is not
 * called tired by one hard day. A convention of Hermes', set out in the docs; not a measurement.
 */
export function describeForm(form, fitness) {
  if (!Number.isFinite(form)) return 'even';
  const band = Math.max(3, 0.1 * (Number.isFinite(fitness) ? Math.max(0, fitness) : 0));
  if (form > band) return 'fresh';
  if (form < -band) return 'tired';
  return 'even';
}

/** A change smaller than this share of where a number started is called level (the share the chronic-load trend uses). */
export const FLAT_SHARE = 0.03;

/** The arrow printed before a change. Decoration only: the change is written out beside it. */
export const TREND_ARROW = { up: '↑', down: '↓', flat: '→' };

/**
 * Which way a number moved: `up`, `down`, or `flat` when the change prints as 0.0 or is under 3% of `scale`, the size of
 * the number it moved from (for form, which can start near zero or below it, the larger of where it started and ended).
 * A HermesRuns convention to point an arrow, not a measurement.
 */
export function trendDirection(change, scale) {
  if (!Number.isFinite(change) || Number(Math.abs(change).toFixed(1)) === 0) return 'flat';
  const reference = Number.isFinite(scale) ? Math.abs(scale) : 0;
  if (reference > 0 && Math.abs(change) < FLAT_SHARE * reference) return 'flat';
  return change > 0 ? 'up' : 'down';
}

/**
 * How far `key` (`fitness`, `fatigue` or `form`) moved over the last `days` days, read off the daily points as the
 * difference of the two numbers a runner can read on the chart. Null when the points do not reach back that far.
 * `ratio` is the change as a share of where it started (null when it started at zero or below).
 */
export function movementOver(points, key, days) {
  const list = Array.isArray(points) ? points : [];
  if (!(days > 0) || list.length <= days) return null;
  const now = list[list.length - 1]?.[key];
  const before = list[list.length - 1 - days]?.[key];
  if (!Number.isFinite(now) || !Number.isFinite(before)) return null;
  const change = now - before;
  const scale = key === 'form' ? Math.max(Math.abs(before), Math.abs(now)) : before;
  return { days, change, before, ratio: before > 0 ? change / before : null, direction: trendDirection(change, scale) };
}

/** Whether a form number reads zero or above as the card prints it, to one decimal (-0.04 prints as 0.0). */
const readsZeroOrAbove = (form) => Number.isFinite(form) && Number(form.toFixed(1)) >= 0;

/**
 * How many days without a run it would take for form to reach zero, read off the dotted stretch after today (which is
 * arithmetic: no load, so fatigue falls faster than fitness; see the docs, "The days after today"). `none` when form is
 * zero or above already or there is no stretch to read; `later` when none of its days gets there; otherwise `days` is the
 * first day that does, counting tomorrow as 1, and `date` is that day.
 */
export function restDaysToZeroForm(series) {
  const current = series?.current;
  const projection = Array.isArray(series?.projection) ? series.projection : [];
  if (!current || !Number.isFinite(current.form) || readsZeroOrAbove(current.form) || projection.length === 0) return { state: 'none' };
  const index = projection.findIndex((day) => readsZeroOrAbove(day?.form));
  if (index < 0) return { state: 'later', days: projection.length };
  return { state: 'days', days: index + 1, date: projection[index].date };
}

const LADDER = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** The smallest "round" number (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten) that is at least {@code value}. */
export function niceCeiling(value) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const factor = LADDER.find((candidate) => candidate * magnitude >= value - 1e-9);
  return Number((factor * magnitude).toPrecision(12));
}

const line = (entries, key) => entries.map((entry, index) => `${index ? 'L' : 'M'}${entry.x.toFixed(2)},${entry[key].toFixed(2)}`).join(' ');

/**
 * @param series `{ points, projection, raceDays }` as the server sends them: `points` is a day each with `date`, `load`,
 *               `fitness`, `fatigue` and `form`; `projection` the days after today if the runner rests; `raceDays`
 *               the days of the window the runner raced on (flagged on the chart)
 * @param options `showFitness` and `showFatigue` say which lines are drawn (the axis is sized to those); `withForm`
 *                whether the form panel is drawn below them; `withEffort` whether the strip of daily effort bars is
 *                added below that (the chart then grows by the strip: `height` is the height without it)
 * @returns null when there are no days to draw, else the panels' boxes, every day with its position, the paths and ticks
 */
export function buildFitnessChart(series, { width = 640, height: baseHeight = 300, withForm = true, showFitness = true, showFatigue = true, withEffort = false } = {}) {
  const points = Array.isArray(series?.points) ? series.points : [];
  if (points.length === 0) return null;
  const projection = Array.isArray(series?.projection) ? series.projection : [];
  const raceDays = new Set(Array.isArray(series?.raceDays) ? series.raceDays : []);

  const padL = 40;
  const padR = 14;
  const padT = 12;
  const axisH = 26;
  // Without the form panel the lines have the whole height.
  const gap = withForm ? 24 : 0;
  const formH = withForm ? (baseHeight < 270 ? 64 : 84) : 0;
  const mainTop = padT;
  const mainBottom = baseHeight - axisH - gap - formH;
  const formTop = mainBottom + gap;
  const formBottom = formTop + formH;
  // The effort strip goes below the lowest panel, with room above it for its caption; it adds to the height.
  const effortGap = withEffort ? 24 : 0;
  const effortH = withEffort ? (baseHeight < 270 ? 46 : 58) : 0;
  const effortTop = (withForm ? formBottom : mainBottom) + effortGap;
  const effortBottom = effortTop + effortH;
  const height = withEffort ? effortBottom + axisH : baseHeight;
  const bottom = withEffort ? effortBottom : (withForm ? formBottom : mainBottom);
  const plotW = width - padL - padR;

  const all = [...points.map((point) => ({ ...point, projected: false })), ...projection.map((point) => ({ ...point, load: 0, projected: true }))];
  const last = all.length - 1;
  const xOf = (index) => (last === 0 ? padL + plotW / 2 : padL + (index / last) * plotW);

  // Four equal steps of a round size, so the labels read 0, 60, 120, 180, 240 and not 63, 125, 188.
  // The axis fits the lines that are showing: with fatigue switched off, fitness gets the whole height.
  const averageMax = Math.max(0, ...all.flatMap((day) => [showFitness || !showFatigue ? day.fitness : 0, showFatigue || !showFitness ? day.fatigue : 0]));
  const step = Math.max(5, niceCeiling((averageMax * 1.1) / 4));
  const yMax = step * 4;
  const yMain = (value) => mainBottom - (Math.max(0, value) / yMax) * (mainBottom - mainTop);

  const formReach = niceCeiling(Math.max(5, ...all.map((day) => Math.abs(day.form))) * 1.1);
  const zeroY = formTop + formH / 2;
  const yForm = (value) => zeroY - (Math.max(-formReach, Math.min(formReach, value)) / formReach) * (formH / 2);

  // Daily effort: a bar for each real day with any, on a scale of its own that never reads under 10.
  const effortMax = Math.max(10, niceCeiling(Math.max(0, ...points.map((point) => Number(point.load) || 0))));
  const pitch = last === 0 ? plotW : plotW / last;
  const barWidth = Math.max(1, Math.min(12, pitch * 0.72));
  const barHeight = (day) => {
    const load = day.projected || !withEffort ? 0 : Math.max(0, Number(day.load) || 0);
    return load > 0 ? Math.max(1, (Math.min(load, effortMax) / effortMax) * effortH) : 0;
  };

  const entries = all.map((day, index) => {
    const x = xOf(index);
    const barH = barHeight(day);
    return {
      index,
      date: day.date,
      load: day.load,
      fitness: day.fitness,
      fatigue: day.fatigue,
      form: day.form,
      projected: day.projected,
      race: !day.projected && raceDays.has(day.date),
      x,
      fitnessY: yMain(day.fitness),
      fatigueY: yMain(day.fatigue),
      formY: yForm(day.form),
      barX: x - barWidth / 2,
      barY: effortBottom - barH,
      barH,
    };
  });
  const real = entries.filter((entry) => !entry.projected);
  const tail = entries.slice(real.length - 1);   // the last real day and the projection, so the dotted line joins the solid one

  const tickCount = Math.min(real.length, width < 480 ? 3 : width < 720 ? 4 : 6);
  const xTicks = Array.from({ length: tickCount }, (_, index) => real[Math.round((index / Math.max(1, tickCount - 1)) * (real.length - 1))]);
  const yTicks = [0, 1, 2, 3, 4].map((index) => ({ value: step * index, y: yMain(step * index) }));
  const formTicks = [formReach, 0, -formReach].map((value) => ({ value, y: yForm(value) }));

  const formArea = `${line(real, 'formY')} L${real[real.length - 1].x.toFixed(2)},${zeroY.toFixed(2)} L${real[0].x.toFixed(2)},${zeroY.toFixed(2)} Z`;
  const effortTicks = withEffort ? [0, effortMax].map((value) => ({ value, y: effortBottom - (value / effortMax) * effortH })) : [];
  const effortPath = real.filter((entry) => entry.barH > 0)
    .map((entry) => `M${entry.barX.toFixed(2)},${entry.barY.toFixed(2)}h${barWidth.toFixed(2)}v${entry.barH.toFixed(2)}h${(-barWidth).toFixed(2)}Z`)
    .join(' ');

  return {
    width, height, padL, padR, mainTop, mainBottom, formTop, formBottom, zeroY, yMax, formReach, withForm,
    withEffort, effortTop, effortBottom, effortMax, effortTicks, effortPath, barWidth, bottom,
    entries,
    realCount: real.length,
    raceMarks: real.filter((entry) => entry.race).map((entry) => ({ date: entry.date, x: entry.x, index: entry.index })),
    projectionStartX: projection.length ? real[real.length - 1].x : null,
    xTicks, yTicks, formTicks,
    fitnessPath: line(real, 'fitnessY'),
    fatiguePath: line(real, 'fatigueY'),
    projectedFitnessPath: tail.length > 1 ? line(tail, 'fitnessY') : '',
    projectedFatiguePath: tail.length > 1 ? line(tail, 'fatigueY') : '',
    projectedFormPath: tail.length > 1 ? line(tail, 'formY') : '',
    formPath: line(real, 'formY'),
    formArea,
  };
}

/** Where a tooltip for a day goes: beside the day, on whichever side has room, clear of the edges of the chart. */
export function fitnessTooltipPosition(entry, geometry, { width = 176, height = 128 } = {}) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const boxWidth = Math.min(width, geometry.width - 16);
  const right = entry.x + 16;
  const left = clamp(right + boxWidth <= geometry.width - 8 ? right : entry.x - boxWidth - 16, 8, geometry.width - boxWidth - 8);
  const top = clamp(Math.min(entry.fitnessY, entry.fatigueY) - height / 2, 8, geometry.mainBottom - height + 24);
  return { width: boxWidth, left, top };
}
