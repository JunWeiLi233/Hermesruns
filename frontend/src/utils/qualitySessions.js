/**
 * Quality sessions combine manual types with automatic estimates for unlabelled
 * runs. Detection is local to this view and never changes stored run labels.
 * See docs/README-ANALYSIS.md, "Quality Sessions", for the detection rules.
 */
import { dayNumber, runDayFraction, runDayKey, runnersToday } from './calendarDays';
import { quantile, trendPeriod } from './metricTrend';

/** The types a session can be, in the order they are listed: the keys of the run sets of Trends. */
export const SESSION_TYPES = Object.freeze(['workout', 'race', 'long']);
export const DEFAULT_SESSION_TYPES = Object.freeze(['workout', 'race']);
export const DEFAULT_SESSION_RANGE = '3m';

const HEART_RATE_LOW = 40;
const HEART_RATE_HIGH = 250;

function distanceKmOf(run) {
  const km = Number(run?.distanceKm);
  if (km > 0) return km;
  const meters = Number(run?.distanceMeters);
  return meters > 0 ? meters / 1000 : 0;
}

function heartRateOf(value) {
  const bpm = Number(value);
  return bpm > HEART_RATE_LOW && bpm < HEART_RATE_HIGH ? bpm : null;
}

const median = (values) => (values.length === 0 ? null : quantile([...values].sort((a, b) => a - b), 0.5));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const KIND_OF_TYPE = { WORKOUT: 'workout', RACE: 'race', LONG_RUN: 'long' };
const WORKOUT_NAME = /\b(?:intervals?|tempo|threshold|fartlek|hill repeats?|track session|workouts?)\b|\d+\s*[x×*]\s*\d+|间歇|节奏|阈值|法特莱克|变速|坡跑|爬坡训练/i;
const LONG_NAME = /\blong run\b|\blsd\b|长距离|长跑/i;
const RACE_NAME = /\b(?:race|parkrun)\b|比赛|竞赛/i;
const RACE_PACE_NAME = /\brace (?:pace|warm[- ]?up|cool[- ]?down)\b|比赛配速|赛配|赛前热身|赛后放松/i;
const EASY_NAME = /\b(?:easy|recovery)\b|轻松|恢复/i;

function namedType(name) {
  if (RACE_NAME.test(name) && !RACE_PACE_NAME.test(name)) return 'RACE';
  if (WORKOUT_NAME.test(name)) return 'WORKOUT';
  if (LONG_NAME.test(name)) return 'LONG_RUN';
  return null;
}

/** Earlier ordinary runs provide a rolling baseline; later runs never relabel the past. */
function classifySessions(rows) {
  const history = [];
  let start = 0;
  for (const row of [...rows].sort((a, b) => a.when - b.when)) {
    const explicit = typeof row.run.runType === 'string' ? row.run.runType.trim().toUpperCase() : '';
    const name = typeof row.run.name === 'string' ? row.run.name : '';
    if (explicit) {
      row.runType = explicit;
    } else {
      row.runType = namedType(name);
      if (row.runType) row.autoReason = 'name';
      else if (row.km >= 16 || row.seconds >= 90 * 60) {
        row.runType = 'LONG_RUN';
        row.autoReason = 'long';
      }
    }

    while (start < history.length && row.when - history[start].when > 90) start++;
    if (!row.runType && !EASY_NAME.test(name) && row.km >= 3 && row.seconds >= 20 * 60) {
      const comparable = history.slice(start).filter(previous => previous.when < row.when
        && previous.km >= row.km / 2 && previous.km <= row.km * 2);
      if (comparable.length >= 3) {
        const usualPace = median(comparable.map(previous => previous.seconds / previous.km));
        if (row.seconds / row.km <= usualPace * 0.9) {
          row.runType = 'WORKOUT';
          row.autoReason = 'pace';
        }
      }
    }
    // Do not let workouts, races or long runs become the ordinary-pace baseline.
    if (!KIND_OF_TYPE[row.runType] && row.km >= 3 && row.seconds >= 20 * 60) history.push(row);
  }
}

/**
 * @param {Array} runs the runner's runs as /api/activities/analysis lists them (with `runType`)
 * @param {{ types?: string[], range?: string, today?: string }} [options] `types` are the keys of SESSION_TYPES that count; `today` is the runner's today (default: `runnersToday`)
 * @returns
 *   - `sessions`: the runs of the period that are of a type that counts, newest first, each `{ key, id, name, runType, day, km, seconds, pace, averageHeartRate, maxHeartRate }`
 *     (a heart rate outside what a heart has is null); automatic rows also include `autoReason`;
 *   - `count`, `km` (their distance), `share` (of all the distance run in the period; null with none), `perWeek` (sessions over the weeks of the period, as many as there
 *     are days of it over seven), `medianPace` of the sessions and `otherMedianPace` of the other runs of the period (null for none), `otherCount`;
 *   - `comparison`, for a period that has a stretch before it: `{ from, to, runs, sessions, ok, change }`, `ok` when the runner ran at all in that stretch (otherwise there is nothing
 *     to compare with, not "no sessions"), `change` the count now less the count then; null for all time;
 *   - the choices made (`kinds`, `range`) and the period (`from`, `to`).
 */
export function buildQualitySessions(runs, { types = DEFAULT_SESSION_TYPES, range = DEFAULT_SESSION_RANGE, today } = {}) {
  // Local development fixtures can coexist with synced activities in older accounts.
  // Only explicit provenance identifies a fixture; never infer it from a run's name.
  const list = (Array.isArray(runs) ? runs : []).filter(run => run?.sourceFileName !== 'local-shared-runner-bootstrap'
    && !String(run?.stravaId ?? '').startsWith('local-shared-'));
  const now = today ?? runnersToday(list);
  const kinds = SESSION_TYPES.filter((type) => types.includes(type));

  const rows = [];
  for (const run of list) {
    if (!run || typeof run !== 'object') continue;
    const day = runDayKey(run);
    const km = distanceKmOf(run);
    const seconds = Number(run.movingTimeSeconds);
    if (!day || day > now || !Number.isFinite(km) || !Number.isFinite(seconds) || !(km > 0) || !(seconds > 0)) continue;
    rows.push({ run, day, km, seconds, when: dayNumber(day) + runDayFraction(run) });
  }
  classifySessions(rows);
  for (const row of rows) row.counts = kinds.includes(KIND_OF_TYPE[row.runType]);

  const firstDay = rows.reduce((first, row) => (first == null || row.day < first ? row.day : first), null);
  const period = trendPeriod(range, now, firstDay);
  const within = (row, from, to) => row.day >= from && row.day <= to;
  const inPeriod = rows.filter((row) => within(row, period.from, now));
  const chosen = inPeriod.filter((row) => row.counts);
  const others = inPeriod.filter((row) => !row.counts);

  // Newest first: by the day and the hour of the start, and for two runs that began together the one with the higher id.
  const sessions = chosen
    .map((row) => ({ row, when: dayNumber(row.day) + runDayFraction(row.run) }))
    .sort((a, b) => b.when - a.when || (Number(b.row.run.id) || 0) - (Number(a.row.run.id) || 0))
    .map(({ row }) => ({
      key: row.run.id != null ? `run-${row.run.id}` : `${row.day}-${row.seconds}`,
      id: row.run.id ?? null,
      name: typeof row.run.name === 'string' ? row.run.name : '',
      runType: row.runType || '',
      ...(row.autoReason ? { autoReason: row.autoReason } : {}),
      day: row.day,
      km: row.km,
      seconds: row.seconds,
      pace: row.seconds / row.km,
      averageHeartRate: heartRateOf(row.run.averageHeartRate),
      maxHeartRate: heartRateOf(row.run.maxHeartRate),
    }));

  const weeks = (dayNumber(now) - dayNumber(period.from) + 1) / 7;
  const km = sum(chosen.map((row) => row.km));
  const totalKm = sum(inPeriod.map((row) => row.km));

  let comparison = null;
  if (period.before) {
    const earlier = rows.filter((row) => within(row, period.before.from, period.before.to));
    const earlierSessions = earlier.filter((row) => row.counts).length;
    comparison = {
      from: period.before.from,
      to: period.before.to,
      runs: earlier.length,
      sessions: earlierSessions,
      ok: earlier.length > 0,
      change: earlier.length > 0 ? chosen.length - earlierSessions : null,
    };
  }

  return {
    today: now,
    from: period.from,
    to: now,
    kinds,
    range,
    sessions,
    count: sessions.length,
    km,
    share: totalKm > 0 ? km / totalKm : null,
    perWeek: weeks > 0 ? sessions.length / weeks : 0,
    medianPace: median(chosen.map((row) => row.seconds / row.km)),
    otherMedianPace: median(others.map((row) => row.seconds / row.km)),
    otherCount: others.length,
    comparison,
  };
}
