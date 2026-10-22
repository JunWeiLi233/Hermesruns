/**
 * Trends in words: how a value of each metric is written (a pace in the runner's unit, a heart rate in beats a minute...), how big a change is and which way it goes,
 * and the sentences that say what the trend line and the comparison with the stretch before found. Pure, with the page's `t` and number formatter passed in, so the
 * same words are used by the page, its tests and the list a screen reader reads.
 */
import { AVERAGE_FROM, AVERAGE_RUNS, FIT_CLEAR, FIT_LOOSE, MIN_DAYS_FOR_LINE, MIN_RUNS_FOR_LINE, MIN_RUNS_TO_COMPARE } from './metricTrend';
import { formatDistance, formatDuration, formatPaceSeconds } from './format';
import { paceForUnit } from './paceCurveChart';

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const TWO_DECIMALS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * @param {string} metric one of METRICS
 * @param {{ unit: string, lang: string, t: Function, formatNumber: Function }} context the runner's unit and language, the page's `t` and number formatter
 * @returns
 *   - `axisUnit`: the unit to write beside an axis (empty for a time, whose ticks say it themselves);
 *   - `value(v)`: a value as it is written ("5:48 /km", "152 bpm"); `axis(v)`: the same for a tick, which is a number in the runner's unit, without the unit;
 *   - `amount(delta)`: how much a change is, unsigned ("0:07 /km"); `level(delta)`: whether that is nothing at the precision it is written to;
 *   - `way(delta)`: the word for its direction (quicker or slower for a pace, longer or shorter for a distance or a time, higher or lower for the rest).
 */
export function metricWords(metric, { unit, lang, t, formatNumber }) {
  const paceUnit = t(unit === 'mile' ? 'trends.unit_pace_mile' : 'trends.unit_pace_km');
  const paceOf = (seconds) => `${formatPaceSeconds(paceForUnit(seconds, unit))} ${paceUnit}`;
  const rounded = (number, places) => Math.round(number * 10 ** places) / 10 ** places;

  const writers = {
    pace: {
      value: paceOf,
      axis: (v) => formatPaceSeconds(v),
      amount: (delta) => paceOf(Math.abs(delta)),
      level: (delta) => Math.round(paceForUnit(Math.abs(delta), unit)) === 0,
      way: (delta) => (delta < 0 ? 'quicker' : 'slower'),
    },
    distance: {
      value: (v) => formatDistance(v, 1, lang, unit),
      axis: (v) => formatNumber(v, { maximumFractionDigits: 1 }),
      amount: (delta) => formatDistance(Math.abs(delta), 1, lang, unit),
      level: (delta) => rounded(Math.abs(delta) * (unit === 'mile' ? 1 / 1.609344 : 1), 1) === 0,
      way: (delta) => (delta > 0 ? 'longer' : 'shorter'),
    },
    duration: {
      value: (v) => formatDuration(v),
      axis: (v) => formatDuration(v),
      amount: (delta) => formatDuration(Math.abs(delta)),
      level: (delta) => Math.round(Math.abs(delta)) === 0,
      way: (delta) => (delta > 0 ? 'longer' : 'shorter'),
    },
    heartRate: {
      value: (v) => t('trends.unit_bpm', { value: formatNumber(Math.round(v)) }),
      axis: (v) => formatNumber(Math.round(v)),
      amount: (delta) => t('trends.unit_bpm', { value: formatNumber(Math.abs(delta), ONE_DECIMAL) }),
      level: (delta) => rounded(Math.abs(delta), 1) === 0,
      way: (delta) => (delta > 0 ? 'higher' : 'lower'),
    },
    efficiency: {
      value: (v) => t('trends.unit_efficiency', { value: formatNumber(v, TWO_DECIMALS) }),
      axis: (v) => formatNumber(v, TWO_DECIMALS),
      amount: (delta) => t('trends.unit_efficiency', { value: formatNumber(Math.abs(delta), TWO_DECIMALS) }),
      level: (delta) => rounded(Math.abs(delta), 2) === 0,
      way: (delta) => (delta > 0 ? 'higher' : 'lower'),
    },
    cadence: {
      value: (v) => t('trends.unit_cadence', { value: formatNumber(Math.round(v)) }),
      axis: (v) => formatNumber(Math.round(v)),
      amount: (delta) => t('trends.unit_cadence', { value: formatNumber(Math.abs(delta), ONE_DECIMAL) }),
      level: (delta) => rounded(Math.abs(delta), 1) === 0,
      way: (delta) => (delta > 0 ? 'higher' : 'lower'),
    },
  };
  const writer = writers[metric] ?? writers.pace;
  const axisUnits = {
    pace: paceUnit,
    distance: t(unit === 'mile' ? 'trends.axis_unit_distance_mile' : 'trends.axis_unit_distance_km'),
    duration: '',
    heartRate: t('trends.axis_unit_heartRate'),
    efficiency: t('trends.axis_unit_efficiency'),
    cadence: t('trends.axis_unit_cadence'),
  };
  return { ...writer, axisUnit: axisUnits[metric] ?? '', way: (delta) => t(`trends.way_${writer.way(delta)}`) };
}

/** What the trend line found, in one or two sentences: how far it goes, how much of the runs' differences it accounts for, or why there is no line. Empty with no runs. */
export function describeTrend(model, words, { t, formatNumber }) {
  const trend = model.trend;
  if (!trend || (!trend.ok && trend.reason === 'none')) return [];
  if (trend.line === 'average') {
    if (!trend.ok) return [t('trends.trend_few_average', { window: AVERAGE_RUNS, min: AVERAGE_FROM, count: model.points.length })];
    if (words.level(trend.change)) return [t('trends.trend_average_level', { window: AVERAGE_RUNS, end: words.value(trend.end.value) })];
    return [t('trends.trend_average', {
      window: AVERAGE_RUNS,
      start: words.value(trend.start.value),
      end: words.value(trend.end.value),
      amount: words.amount(trend.change),
      way: words.way(trend.change),
    })];
  }
  if (!trend.ok) {
    return [trend.reason === 'short'
      ? t('trends.trend_short_straight', { days: MIN_DAYS_FOR_LINE })
      : t('trends.trend_few_straight', { min: MIN_RUNS_FOR_LINE, count: model.points.length })];
  }
  if (words.level(trend.slopePerMonth)) return [t('trends.trend_straight_level')];
  const fit = trend.r2 < FIT_LOOSE ? 'none' : trend.r2 < FIT_CLEAR ? 'loose' : 'clear';
  return [
    t('trends.trend_straight', {
      amount: words.amount(trend.slopePerMonth),
      way: words.way(trend.slopePerMonth),
      total: words.amount(trend.change),
    }),
    t(`trends.trend_fit_${fit}`, { percent: formatNumber(Math.round(trend.r2 * 100)) }),
  ];
}

/** The middle of the period against the middle of the stretch before, in a sentence; null for a period that has no stretch before it ("all time"). */
export function describeComparison(model, words, { t }) {
  const comparison = model.comparison;
  if (!comparison) return null;
  const span = t(`trends.span_${model.range}`);
  if (!comparison.ok) return t('trends.compare_few', { span, need: MIN_RUNS_TO_COMPARE, count: comparison.count });
  const before = words.value(comparison.median);
  if (words.level(comparison.change)) return t('trends.compare_level', { span, before });
  return t('trends.compare_sentence', {
    now: words.value(model.stats.median), span, before, amount: words.amount(comparison.change), way: words.way(comparison.change),
  });
}
