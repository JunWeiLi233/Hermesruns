/**
 * What the training log page works out for itself: the filters and the view it keeps in the address, the next request for
 * earlier or later weeks, the shape of a week's strip, and how a week, a day and a pace are written (see
 * docs/README-ANALYSIS.md, "Training Log"). Pure, so the page only draws what it is given.
 */
import { isoDay } from './fitnessChart';
import { formatDistance } from './format';
import { DEFAULT_MAX_TAGS, tagKey, tidyTag } from './runLabels';

/** How many weeks one request asks for, and so how many "load earlier weeks" adds. */
export const PAGE_WEEKS = 12;
export const RUN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];
/** What the strip, the day totals and the highlighted figures are about; the first is the one the log opens with. */
export const METRICS = ['distance', 'time', 'climb', 'effort'];
export const DEFAULT_METRIC = METRICS[0];
/** The earliest day the date jump takes. Typing a year passes through 0002, 0020 and 0202, none of which is a day to jump to. */
export const JUMP_FLOOR = '1970-01-01';
const KM_PER_MILE = 1.609344;

/** A day written yyyy-MM-dd as a date at noon in the browser's calendar, or null if it is not a real day. */
function parseDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1 ? null : date;
}

/** The day `days` after the given one (before it, when negative), written yyyy-MM-dd; null for something that is not a day. */
export function addDays(iso, days) {
  const date = parseDay(iso);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

/** The day before the given one, written yyyy-MM-dd; null for something that is not a day. */
export function dayBefore(iso) {
  return addDays(iso, -1);
}

/** The Monday of the week a day is in; null for something that is not a day. */
export function weekStartOf(iso) {
  const date = parseDay(iso);
  if (!date) return null;
  return addDays(iso, -((date.getDay() + 6) % 7));
}

/**
 * What the address says about the log. The filters (they go to the server): a run type that is one of the three, and tags
 * (tidied, each once whatever its case, at most as many as a run can have). The view (it does not): the metric the strip and
 * the highlighted figures are about, and a day to jump to. Anything else in the address is ignored, so a hand-edited link
 * cannot ask the server for nonsense.
 */
export function readFilters(searchParams) {
  const type = searchParams.get('runType');
  const metric = searchParams.get('metric');
  const seen = new Set();
  const tags = [];
  for (const word of searchParams.getAll('tag')) {
    const tag = tidyTag(word);
    if (tag !== '' && !seen.has(tagKey(tag)) && tags.length < DEFAULT_MAX_TAGS) {
      seen.add(tagKey(tag));
      tags.push(tag);
    }
  }
  const to = searchParams.get('to');
  return {
    runType: RUN_TYPES.includes(type) ? type : '',
    tags,
    metric: METRICS.includes(metric) ? metric : DEFAULT_METRIC,
    to: parseDay(to) && String(to).length === 10 && String(to) >= JUMP_FLOOR ? String(to) : '',
  };
}

/** The filters and the view as an address query, nothing for one that is not set (the metric, when it is the usual one). */
export function writeFilters({ runType = '', tags = [], metric = DEFAULT_METRIC, to = '' }) {
  const params = new URLSearchParams();
  if (runType) params.set('runType', runType);
  for (const tag of tags) params.append('tag', tag);
  if (metric && metric !== DEFAULT_METRIC) params.set('metric', metric);
  if (to) params.set('to', to);
  return params;
}

/**
 * The day a date field has been set to, for the log to jump to; null while it holds something that is not one yet (empty,
 * half typed, a year still on its way, a day after today). Only a whole, real day between the floor and today counts, so
 * typing 2026 does not ask for the weeks of the years 2, 20 and 202 on the way.
 */
export function jumpDay(value, today) {
  const text = String(value ?? '');
  if (text.length !== 10 || !parseDay(text) || text < JUMP_FLOOR) return null;
  return !today || text <= today ? text : null;
}

/** The request for a page of weeks: those ending with the week of `to` (today when null), through the filters. */
export function logUrl({ to = null, weeks = PAGE_WEEKS, runType = '', tags = [] } = {}) {
  const params = new URLSearchParams();
  params.set('weeks', String(weeks));
  if (to) params.set('to', to);
  if (runType) params.set('runType', runType);
  for (const tag of tags) params.append('tag', tag);
  return `/api/training/log?${params.toString()}`;
}

/** The day to ask for to get the weeks before the oldest one loaded: the day before it. Null when none is loaded. */
export function nextPageTo(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  return dayBefore(weeks[weeks.length - 1].start);
}

/** Adds weeks to the end of the list, leaving out any the list already has. */
export function mergeWeeks(loaded, incoming) {
  const have = new Set(loaded.map((week) => week.start));
  return [...loaded, ...incoming.filter((week) => !have.has(week.start))];
}

/** Whether the weeks on screen run up to the runner's today: the newest one is the week it falls in. */
export function showsLatestWeek(weeks, today) {
  return Array.isArray(weeks) && weeks.length > 0 && Boolean(today) && weeks[0].end >= today;
}

/**
 * The day to ask for to get the weeks after the newest one on screen: a page of weeks further on, or today if that is
 * sooner. Null when the newest week is already the one the runner's today is in (or nothing is loaded).
 */
export function newerPageTo(weeks, today, pageWeeks = PAGE_WEEKS) {
  if (!Array.isArray(weeks) || weeks.length === 0 || !today || showsLatestWeek(weeks, today)) return null;
  const target = addDays(weeks[0].end, pageWeeks * 7);
  if (!target) return null;
  return target < today ? target : today;
}

/** Adds weeks (newest first, as they come) to the start of the list, leaving out any that are not newer than the newest on it. */
export function prependWeeks(loaded, incoming) {
  const newest = loaded.length > 0 ? loaded[0].start : '';
  return [...incoming.filter((week) => week.start > newest), ...loaded];
}

/**
 * The weeks as the page lists them. With no filter every week gets its own line, because a week without a run is part of
 * the picture. With a filter on, two or more empty weeks in a row are folded into one line (`{ gap: true, count, start,
 * end }`), since "no match" ten times over says nothing more than once.
 */
export function listWeeks(weeks, { foldEmpty = false } = {}) {
  if (!foldEmpty) return weeks.map((week) => ({ week }));
  const items = [];
  let index = 0;
  while (index < weeks.length) {
    if (weeks[index].runs > 0) {
      items.push({ week: weeks[index] });
      index += 1;
      continue;
    }
    let end = index;
    while (end + 1 < weeks.length && weeks[end + 1].runs === 0) end += 1;
    const count = end - index + 1;
    if (count >= 2) {
      items.push({ gap: true, count, start: weeks[end].start, end: weeks[index].end });
    } else {
      items.push({ week: weeks[index] });
    }
    index = end + 1;
  }
  return items;
}

/** Whether the runner's today falls in the week. */
export function isCurrentWeek(week, today) {
  return Boolean(week && today && week.start <= today && today <= week.end);
}

/** What a run adds to a metric: km, moving seconds, metres climbed or its Effort score; nothing for a run without the figure. */
export function runMetric(run, metric) {
  switch (metric) {
    case 'time': return run.movingSeconds || 0;
    case 'climb': return run.elevationGainM || 0;
    case 'effort': return run.effort || 0;
    default: return run.distanceKm || 0;
  }
}

/** What all the runs of a day add up to in a metric. */
export function dayMetric(day, metric) {
  return day.runs.reduce((sum, run) => sum + runMetric(run, metric), 0);
}

/**
 * The seven days of a week for its strip, Monday first: what the runs of each day add up to in the metric and a height
 * from 0 to 1 against `scale`, the biggest day on the page in that metric, so the strips of different weeks can be compared.
 */
export function weekStrip(week, scale, metric = DEFAULT_METRIC) {
  const start = parseDay(week.start);
  const byDay = new Map((week.days ?? []).map((day) => [day.date, day]));
  const top = scale > 0 ? scale : 1;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12, 0, 0);
    const iso = isoDay(date);
    const day = byDay.get(iso);
    const value = day ? dayMetric(day, metric) : 0;
    return { date: iso, value, runs: day ? day.runs.length : 0, height: value > 0 ? Math.max(0.08, Math.min(1, value / top)) : 0 };
  });
}

/** The biggest single day among the weeks in a metric: the scale every strip is drawn against. */
export function longestDay(weeks, metric = DEFAULT_METRIC) {
  let longest = 0;
  for (const week of weeks) {
    for (const day of week.days ?? []) {
      longest = Math.max(longest, dayMetric(day, metric));
    }
  }
  return longest;
}

/**
 * A figure in a metric as the log writes it: distance with its unit, time as a clock, climb in metres, Effort as a whole
 * number; a dash for nothing (a day whose runs have no Effort yet). `formatNumber` is the language's.
 */
export function metricText(value, metric, { lang, unit, formatNumber }) {
  if (!(value > 0)) return '–';
  switch (metric) {
    case 'time': return clockText(value);
    case 'climb': return `${formatNumber(Math.round(value))} m`;
    case 'effort': return formatNumber(Math.round(value));
    default: return formatDistance(value, 1, lang, unit);
  }
}

/** "Oct 5 – 11" or "Sep 28 – Oct 4", in the language. */
export function formatWeekRange(startIso, endIso, lang) {
  const start = parseDay(startIso);
  const end = parseDay(endIso);
  if (!start || !end) return '--';
  return new Intl.DateTimeFormat(lang || 'en', { month: 'short', day: 'numeric' }).formatRange(start, end);
}

/** "Mon, Oct 5". */
export function formatDayHeading(iso, lang) {
  const date = parseDay(iso);
  if (!date) return '--';
  return date.toLocaleDateString(lang || 'en', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A weekday as one short letter or word for a strip: "M", "Mon" or "一". */
export function formatWeekday(iso, lang, width = 'short') {
  const date = parseDay(iso);
  if (!date) return '';
  return date.toLocaleDateString(lang || 'en', { weekday: width });
}

/** The day of the month, for under a strip's bar. */
export function dayOfMonth(iso) {
  const date = parseDay(iso);
  return date ? date.getDate() : '';
}

/** A pace for a distance unit: seconds per kilometre in, "m:ss" out (per mile when the unit is miles). */
export function paceText(secPerKm, unit) {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '–';
  const seconds = Math.round(unit === 'mile' ? secPerKm * KM_PER_MILE : secPerKm);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** A run's or a week's time as h:mm:ss, or m:ss under an hour; "–" for none. */
export function clockText(totalSeconds) {
  const seconds = Math.round(Number(totalSeconds) || 0);
  if (seconds <= 0) return '–';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** A week's total time in hours and minutes ("6 h 20 min" / "45 min"), which reads better than a clock for a week. */
export function weekTimeParts(totalSeconds) {
  const minutes = Math.round((Number(totalSeconds) || 0) / 60);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
