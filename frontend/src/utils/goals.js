/**
 * How a goal is read and written on screen (see docs/README-ANALYSIS.md, "Goals"). The server keeps every target in one unit
 * per metric (km, seconds, runs, metres); the runner reads and types distance in kilometres or miles and time in hours.
 * Pure, so the card only draws what it is given.
 */

export const PERIODS = ['WEEK', 'MONTH', 'YEAR'];
export const METRICS = ['DISTANCE', 'TIME', 'COUNT', 'ELEVATION'];
const KM_PER_MILE = 1.609344;

const round = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** What the target box shows for a stored target: kilometres or miles, hours, runs, metres. */
export function targetToForm(metric, target, unit = 'km') {
  const value = Number(target);
  if (!Number.isFinite(value)) return '';
  switch (metric) {
    case 'DISTANCE': return String(round(unit === 'mile' ? value / KM_PER_MILE : value, 2));
    case 'TIME': return String(round(value / 3600, 2));
    default: return String(Math.round(value));
  }
}

/**
 * A number as someone typed it, in plain digits with a point: "5,5" is 5.5, and groups of three after a first digit that is
 * not zero are thousands ("1,250", "1.250", "12,345.6" and "12.345,6" are 1250, 1250, 12345.6 and 12345.6). A number that
 * reads both ways ("5.500") is taken as thousands; it is rare to type a distance to the metre.
 */
function plainNumber(text) {
  const typed = String(text ?? '').trim();
  if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(typed)) return typed.replace(/,/g, '');
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(typed)) return typed.replace(/\./g, '').replace(',', '.');
  return typed.replace(',', '.');
}

/**
 * What the runner typed, as the number the server takes (km, seconds, runs, metres), or null when it is not a positive number.
 */
export function formToTarget(metric, text, unit = 'km') {
  const cleaned = plainNumber(text);
  if (cleaned === '' || !/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return null;
  const typed = Number(cleaned);
  if (!Number.isFinite(typed) || typed <= 0) return null;
  switch (metric) {
    case 'DISTANCE': return round(unit === 'mile' ? typed * KM_PER_MILE : typed, 2);
    case 'TIME': return Math.round(typed * 3600);
    default: return Math.round(typed);
  }
}

/** The largest target a metric takes, in the unit the box is in, for saying so; null if the server did not say. */
export function maxInFormUnit(metric, maxTarget, unit = 'km') {
  const stored = maxTarget?.[metric];
  if (!Number.isFinite(stored)) return null;
  return Number(targetToForm(metric, stored, unit));
}

/** "6 h 20 min", "45 min", "0 min": seconds as a person says a stretch of time. */
export function formatDurationWords(seconds, t) {
  const total = Math.max(0, Math.round((Number(seconds) || 0) / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return hours > 0 ? t('goals.time_hm', { hours, minutes }) : t('goals.time_m', { minutes });
}

/**
 * A goal's number with its unit, in the words of the language: "42.5 km", "26.4 mi", "6 h 20 min", "12 runs", "1,250 m".
 *
 * @param options `unit` ('km' or 'mile'), `t`, `formatNumber`
 */
export function formatAmount(metric, value, { unit = 'km', t, formatNumber }) {
  const amount = Number(value) || 0;
  switch (metric) {
    case 'DISTANCE': {
      const shown = unit === 'mile' ? amount / KM_PER_MILE : amount;
      return `${formatNumber(round(shown, 1), { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ${t(unit === 'mile' ? 'goals.unit_mi' : 'goals.unit_km')}`;
    }
    case 'TIME': return formatDurationWords(amount, t);
    case 'COUNT': return t(Math.round(amount) === 1 ? 'goals.runs_one' : 'goals.runs_many', { count: formatNumber(round(amount, 1)) });
    case 'ELEVATION': return `${formatNumber(Math.round(amount))} ${t('goals.unit_m')}`;
    default: return formatNumber(amount);
  }
}

/** How much of the target is done, for the bar: 0 to 100, whatever the percent says. */
export function barWidth(goal) {
  if (!goal || !(goal.target > 0)) return 0;
  return Math.max(0, Math.min(100, (goal.progress / goal.target) * 100));
}

/** The goals of a response as the server sent them, in the order of the period, then the metric, so the list reads the same each time. */
export function sortGoals(goals) {
  return [...(Array.isArray(goals) ? goals : [])].sort((a, b) => (
    PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period) || METRICS.indexOf(a.metric) - METRICS.indexOf(b.metric)
  ));
}

/** Whether a runner already has a goal for this period and metric. */
export function hasGoal(goals, period, metric) {
  return Array.isArray(goals) && goals.some((goal) => goal.period === period && goal.metric === metric);
}

/** The first period and metric (weekly first, distance first) that the runner has no goal for: where "set a goal" starts. */
export function firstFree(goals) {
  for (const period of PERIODS) {
    for (const metric of METRICS) {
      if (!hasGoal(goals, period, metric)) return { period, metric };
    }
  }
  return { period: PERIODS[0], metric: METRICS[0] };
}
