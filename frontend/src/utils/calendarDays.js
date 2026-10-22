// Calendar days, as the runner counts them: "the last 7 days" is today and the six days before it, each run on the day it was
// run, whatever the hour. One definition for every screen that adds up a week (Home, Load balance, the coach pages), so the
// same runs give the same distance everywhere (BUG-026).
//
// A run's start in an answer from the server is the clock on the runner's wall (a run from a file is moved to the profile's
// time zone there), so its date is read off the text as it is. Parsing it as an instant and asking for its date would move an
// evening run to the next day for anyone west of Greenwich.

import { getAccountDate } from './timeZone.js';

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const CLOCK = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})(?::(\d{2}))?/;
const DAY_MS = 86_400_000;

const pad = (value) => String(value).padStart(2, '0');

/** "2026-10-08" for a Date, in this device's zone. */
export function localDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's date as "YYYY-MM-DD", on this device's clock. */
export function todayKey(now = new Date()) {
  return localDayKey(now);
}

function validKey(year, month, day) {
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const date = new Date(time);
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

/**
 * The day a run was run, "YYYY-MM-DD", or null when it has no date. A start without a zone is a wall clock and gives its own
 * date; a start that names a zone ("...Z", "+02:00") is an instant and gives the date it has on this device.
 */
export function runDayKey(run) {
  const accountDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(run?.accountLocalDate || '');
  if (accountDay && validKey(accountDay[1], accountDay[2], accountDay[3])) return accountDay[0];
  const raw = run?.startTime || run?.startDate;
  if (!raw) return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!HAS_ZONE.test(text)) {
      const match = WALL_CLOCK.exec(text);
      if (match && validKey(match[1], match[2], match[3])) return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : localDayKey(parsed);
}

/**
 * How far into its day a run started, from 0 up to (not including) 1: the hour on the wall clock for a start with no zone, the hour it has on this device for a start
 * that names one, and 0 for a run that has only a date. It is for putting two runs of one day side by side on a time axis; it never moves a run to another day (that is
 * `runDayKey`'s to say).
 */
export function runDayFraction(run) {
  const accountClock = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(run?.accountLocalTime || '');
  if (accountClock && Number(accountClock[1]) < 24 && Number(accountClock[2]) < 60 && Number(accountClock[3] || 0) < 60) {
    return (Number(accountClock[1]) * 3600 + Number(accountClock[2]) * 60 + Number(accountClock[3] || 0)) / (DAY_MS / 1000);
  }
  const raw = run?.startTime || run?.startDate;
  if (!raw) return 0;
  let seconds = 0;
  if (typeof raw === 'string' && !HAS_ZONE.test(raw.trim())) {
    const match = CLOCK.exec(raw.trim());
    if (match) seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0);
  } else {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) seconds = parsed.getHours() * 3600 + parsed.getMinutes() * 60 + parsed.getSeconds();
  }
  return Math.min(seconds, DAY_MS / 1000 - 1) / (DAY_MS / 1000);
}

/** The day `delta` days from a "YYYY-MM-DD" day. */
export function addDaysToKey(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day) + delta * DAY_MS);
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/**
 * The day `months` calendar months from a "YYYY-MM-DD" day: the same day of the month, or the last day of that month when it has no such day
 * (31 March a month back is 28 February, or the 29th in a leap year).
 */
export function addMonthsToKey(key, months) {
  const [year, month, day] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** A "YYYY-MM-DD" day as a whole number of days since 1 January 1970: one step for every day, whatever the zone, and a day that clocks make 23 or 25 hours long is still one. */
export function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

// The clocks of the world are 26 hours apart at most (UTC-12 and UTC+14), so a run's date is never more than two days ahead of this device's.
const MOST_DAYS_AHEAD = 2;

/**
 * Today on the runner's own calendar, as far as their runs tell it: this device's date, or the date of their latest run when that is
 * ahead of it. A run's date is the clock on the runner's wall, which can be a day or two ahead of this device's (the zone in Settings is
 * east of the device's, or a file's UTC time was moved into it), and a run is never from the future, so the runner's today is at least
 * the date of the latest run. Counting from the device's date left such a run out of the week until the device caught up (BUG-043). A date
 * further ahead than two zones can be apart is a watch with the wrong clock and is not followed. `days` are "YYYY-MM-DD" days, any order.
 */
export function runnersTodayFromDays(days, now = new Date()) {
  const device = todayKey(now);
  const limit = addDaysToKey(device, MOST_DAYS_AHEAD);
  let latest = device;
  for (const day of days || []) {
    if (day && day > latest && day <= limit) latest = day;
  }
  return latest;
}

/** The runner's today (see `runnersTodayFromDays`) from the runs themselves. */
export function runnersToday(runs, now = new Date()) {
  const accountZone = (runs || []).find(run => run?.accountTimeZone)?.accountTimeZone;
  if (accountZone) return getAccountDate(accountZone, now);
  return runnersTodayFromDays((runs || []).map(runDayKey), now);
}

/** True for today and the `days - 1` days before it. A run with no date is in no window. */
export function isWithinLastDays(key, days, today = todayKey()) {
  if (!key) return false;
  return key <= today && key > addDaysToKey(today, -days);
}

/** True when a run falls in the last `days` calendar days. */
export function runIsWithinLastDays(run, days, today = todayKey()) {
  return isWithinLastDays(runDayKey(run), days, today);
}
