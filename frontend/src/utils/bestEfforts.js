/**
 * Helpers for the best-effort and same-route cards: the words for a place, a time typed by the runner, and calendar
 * dates. Pure, so they are tested without the page.
 */
import { formatDuration } from './format';

/** The fastest and slowest a runner can run a typed time over its distance, m/s. The server holds the same limits. */
export const MAX_TYPED_SPEED_MPS = 10;
export const MIN_TYPED_SPEED_MPS = 1000 / 1800;

/**
 * Whole seconds from what a runner typed: "21:30" or "1:05:12". A time without a colon is refused rather than guessed
 * at ("21" could be seconds or minutes), and so is a minute or second part of 60 or more once there is an hour or a
 * minute in front of it. Returns null for anything else.
 */
export function parseEffortTime(text) {
  const typed = String(text ?? '').trim();
  const match = /^(?:(\d{1,3}):)?(\d{1,4}):(\d{1,2})$/.exec(typed);
  if (!match) return null;
  const hours = match[1] === undefined ? null : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds >= 60) return null;
  if (hours !== null && minutes >= 60) return null;
  const total = (hours ?? 0) * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** Whether a time over a distance is one a runner could run (see the limits above). */
export function isPlausibleEffortTime(seconds, distanceMeters) {
  if (!(seconds > 0) || !(distanceMeters > 0)) return false;
  const speed = distanceMeters / seconds;
  return speed <= MAX_TYPED_SPEED_MPS && speed >= MIN_TYPED_SPEED_MPS;
}

/** "21:30" or "1:05:12", to the nearest second, for the time an effort counts as. */
export function formatEffortTime(seconds) {
  return formatDuration(seconds);
}

/**
 * The same time as `formatEffortTime`, in the shape a runner types it back, so the editor starts from what is on screen.
 */
export function effortTimeForEditing(seconds) {
  return formatDuration(Math.round(seconds));
}

/**
 * A calendar day (the runner's own, "2026-10-03") written out in the page's language. The day is read at noon of the
 * viewer's clock: parsing it as midnight UTC would show the day before anywhere west of Greenwich.
 */
export function formatCalendarDate(isoDate, lang) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate ?? ''));
  if (!match) return '--';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  // A month or a day out of range rolls over into the next month ("2026-13-05" is January, "2026-02-30" is March), so
  // a date that landed in another month than the one written is no day.
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1) return '--';
  return date.toLocaleDateString(lang || 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Seconds per kilometre for a time over a distance, or null when either is missing. */
export function paceFromEffort(seconds, distanceMeters) {
  if (!(seconds > 0) || !(distanceMeters > 0)) return null;
  return seconds / (distanceMeters / 1000);
}

/**
 * The geometry of the best-time-by-year chart: one dot per year, evenly spaced, faster (a smaller time) nearer the top,
 * joined by a line. Returns null for no years. `inset` keeps the first and last dots off the edges of the plot.
 *
 * @param trend `[{ year, bestSeconds, count }]`, oldest year first
 */
export function buildYearTrend(trend, { width = 520, height = 190, left = 52, right = 20, top = 22, bottom = 30, inset = 28 } = {}) {
  const years = (Array.isArray(trend) ? trend : []).filter((entry) => Number.isFinite(entry?.bestSeconds) && entry.bestSeconds > 0);
  if (years.length === 0) return null;
  const times = years.map((entry) => entry.bestSeconds);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);
  const pad = Math.max(1, (slowest - fastest) * 0.2, fastest * 0.01);
  const timeTop = fastest - pad;
  const timeBottom = slowest + pad;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  // The first and the last year sit a little in from the edges, clear of the time labels on the left.
  const xOf = (index) => (years.length === 1 ? left + plotWidth / 2 : left + inset + (index / (years.length - 1)) * (plotWidth - 2 * inset));
  const yOf = (seconds) => top + ((seconds - timeTop) / (timeBottom - timeTop)) * plotHeight;
  const points = years.map((entry, index) => ({ ...entry, x: xOf(index), y: yOf(entry.bestSeconds) }));
  const ticks = fastest === slowest ? [{ seconds: fastest, y: yOf(fastest) }] : [fastest, slowest].map((seconds) => ({ seconds, y: yOf(seconds) }));
  return {
    width, height, left, right, top, bottom,
    points,
    ticks,
    path: points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' '),
  };
}
