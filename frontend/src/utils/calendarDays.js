// Calendar days, as the runner counts them: "the last 7 days" is today and the six days before it, each run on the day it was
// run, whatever the hour. One definition for every screen that adds up a week (Home, Load balance, the coach pages), so the
// same runs give the same distance everywhere (BUG-026).
//
// A run's start in an answer from the server is the clock on the runner's wall (a run from a file is moved to the profile's
// time zone there), so its date is read off the text as it is. Parsing it as an instant and asking for its date would move an
// evening run to the next day for anyone west of Greenwich.

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
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

/** The day `delta` days from a "YYYY-MM-DD" day. */
export function addDaysToKey(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day) + delta * DAY_MS);
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
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
