/**
 * What the training log page works out for itself: the filters it keeps in the address, the next request for earlier weeks,
 * the shape of a week's strip, and how a week, a day and a pace are written (see docs/README-ANALYSIS.md, "Training Log").
 * Pure, so the page only draws what it is given.
 */
import { isoDay } from './fitnessChart';
import { DEFAULT_MAX_TAGS, tagKey, tidyTag } from './runLabels';

/** How many weeks one request asks for, and so how many "load earlier weeks" adds. */
export const PAGE_WEEKS = 12;
export const RUN_TYPES = ['RACE', 'LONG_RUN', 'WORKOUT'];
const KM_PER_MILE = 1.609344;

/** A day written yyyy-MM-dd as a date at noon in the browser's calendar, or null if it is not a real day. */
function parseDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(date.getTime()) || date.getMonth() !== Number(match[2]) - 1 ? null : date;
}

/** The day before the given one, written yyyy-MM-dd; null for something that is not a day. */
export function dayBefore(iso) {
  const date = parseDay(iso);
  if (!date) return null;
  date.setDate(date.getDate() - 1);
  return isoDay(date);
}

/**
 * The filters in the address: a run type that is one of the three, and tags (tidied, each once whatever its case, at most as
 * many as a run can have). Anything else in the address is ignored, so a hand-edited link cannot ask the server for nonsense.
 */
export function readFilters(searchParams) {
  const type = searchParams.get('runType');
  const seen = new Set();
  const tags = [];
  for (const word of searchParams.getAll('tag')) {
    const tag = tidyTag(word);
    if (tag !== '' && !seen.has(tagKey(tag)) && tags.length < DEFAULT_MAX_TAGS) {
      seen.add(tagKey(tag));
      tags.push(tag);
    }
  }
  return { runType: RUN_TYPES.includes(type) ? type : '', tags };
}

/** The filters as an address query, nothing for a filter that is not set. */
export function writeFilters({ runType = '', tags = [] }) {
  const params = new URLSearchParams();
  if (runType) params.set('runType', runType);
  for (const tag of tags) params.append('tag', tag);
  return params;
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

/**
 * The seven days of a week for its strip, Monday first: the distance run on each (all the runs of the day added up) and a
 * height from 0 to 1 against `scaleKm`, the longest day on the page, so the strips of different weeks can be compared.
 */
export function weekStrip(week, scaleKm) {
  const start = parseDay(week.start);
  const byDay = new Map((week.days ?? []).map((day) => [day.date, day]));
  const top = scaleKm > 0 ? scaleKm : 1;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12, 0, 0);
    const iso = isoDay(date);
    const day = byDay.get(iso);
    const km = day ? day.runs.reduce((sum, run) => sum + (run.distanceKm || 0), 0) : 0;
    return { date: iso, km, runs: day ? day.runs.length : 0, height: km > 0 ? Math.max(0.08, Math.min(1, km / top)) : 0 };
  });
}

/** The longest single day among the weeks, in km: the scale every strip is drawn against. */
export function longestDayKm(weeks) {
  let longest = 0;
  for (const week of weeks) {
    for (const day of week.days ?? []) {
      longest = Math.max(longest, day.runs.reduce((sum, run) => sum + (run.distanceKm || 0), 0));
    }
  }
  return longest;
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
