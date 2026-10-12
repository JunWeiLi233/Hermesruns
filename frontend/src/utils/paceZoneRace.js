import { formatDuration } from './format';
import { calculateVdot } from './vdot';

/**
 * A race or time trial the runner cut their pace zones from (see docs/README-ANALYSIS.md, "Pace zones from a race"): the standard
 * distances to pick from, the time as a runner writes it, and the fitness (VDOT) it stands for, with the same formula as the rest of
 * the analysis. Pure, so Settings and the run page say the same thing.
 */

export const RACE_PRESETS = [
  { key: '5k', meters: 5000 },
  { key: '10k', meters: 10000 },
  { key: 'half', meters: 21097.5 },
  { key: 'marathon', meters: 42195 },
];

const KM_PER_MILE = 1.609344;

/** The preset a distance is, to the metre; null for any other distance. */
export function presetFor(distanceMeters) {
  return RACE_PRESETS.find((preset) => Math.abs(preset.meters - Number(distanceMeters)) < 1) || null;
}

/** "45:00" or "1:45:30" as seconds; null for anything else (a bare number is not guessed at: 45 could be minutes or hours). */
export function parseRaceTime(text) {
  const match = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$/.exec(String(text ?? ''));
  if (!match) return null;
  const hours = match[1] == null ? 0 : Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (seconds > 59 || (match[1] != null && minutes > 59)) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

/** 2700 as "45:00" and 6330 as "1:45:30": the way the rest of the app writes a duration. */
export function formatRaceTime(seconds) {
  return formatDuration(Math.round(Number(seconds) || 0));
}

/** The text of a distance typed in the runner's unit ("12.5", "12,5") as metres; null when it is not a positive number. */
export function customDistanceMeters(text, unit = 'km') {
  const typed = Number(String(text ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(typed) || typed <= 0) return null;
  return Math.round(typed * (unit === 'mile' ? KM_PER_MILE : 1) * 1000 * 10) / 10;
}

/** A distance in metres as the runner's unit writes it, without trailing zeros: 12.5 for km, 7.77 for miles. */
export function distanceInUnit(distanceMeters, unit = 'km') {
  const value = Number(distanceMeters) / 1000 / (unit === 'mile' ? KM_PER_MILE : 1);
  return Math.round(value * 100) / 100;
}

/** The fitness (VDOT) a race stands for, to one decimal like the VDOT of a runner's runs; null for a race that does not give one. */
export function raceVdot(race) {
  const meters = Number(race?.distanceMeters);
  const seconds = Number(race?.seconds);
  if (!(meters > 0) || !(seconds > 0)) return null;
  const vdot = calculateVdot(meters, seconds / 60);
  return Number.isFinite(vdot) && vdot > 0 ? Math.round(vdot * 10) / 10 : null;
}

/** How many days ago a race was, on the day it is looked at (a date "YYYY-MM-DD" and today's), for saying a race has gone stale. */
export function raceAgeDays(raceDate, todayKeyText) {
  const race = Date.parse(`${raceDate}T12:00:00Z`);
  const today = Date.parse(`${todayKeyText}T12:00:00Z`);
  return Number.isFinite(race) && Number.isFinite(today) ? Math.round((today - race) / 86_400_000) : null;
}

/** After this many days a race result says less about today's pace, and Settings says so. */
export const STALE_RACE_DAYS = 183;

/** A "YYYY-MM-DD" that is a day on the calendar ("2026-02-31" is not). */
export function isRealDay(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? ''));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * What is wrong with a race as typed: one `{ field, key }` for each thing the form has to say, empty when the race can be saved.
 * The rules are the server's (PaceZoneRaceService), and its limits come with the form, so the numbers live in one place; the
 * server still has the last word.
 *
 * @param typed  `{ meters, seconds, date }`: the distance in metres and the time in seconds (null when they could not be read),
 *               and the date as written
 * @param limits `limits` from /api/training/pace-zones
 * @param today  the runner's today, "YYYY-MM-DD"
 */
export function raceProblems({ meters, seconds, date }, limits, today) {
  const problems = [];
  let distanceOk = false;
  let timeOk = false;
  if (meters == null) problems.push({ field: 'distance', key: 'distance' });
  else if (meters < limits.minDistanceMeters || meters > limits.maxDistanceMeters) problems.push({ field: 'distance', key: 'distance_range' });
  else distanceOk = true;
  if (seconds == null) problems.push({ field: 'time', key: 'time' });
  else if (seconds < limits.minSeconds || seconds > limits.maxSeconds) problems.push({ field: 'time', key: 'time_range' });
  else timeOk = true;
  if (distanceOk && timeOk) {
    const pace = seconds / (meters / 1000);
    if (pace < limits.minPaceSecondsPerKm || pace > limits.maxPaceSecondsPerKm) problems.push({ field: 'time', key: 'pace' });
  }
  if (!isRealDay(date)) problems.push({ field: 'date', key: 'date' });
  else if (date > today) problems.push({ field: 'date', key: 'date_future' });
  else if (raceAgeDays(date, today) > limits.maxAgeDays) problems.push({ field: 'date', key: 'date_old' });
  return problems;
}
