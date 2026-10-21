// Answers of GET /api/training/intensity, shaped as the server sends them.

const pad = (value) => String(value).padStart(2, '0');
const day = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const sum = (values) => values.reduce((total, value) => total + value, 0);

/** Twelve weeks that each spend 60, 60, 40, 10 and 30 minutes in zones 1 to 5: 80% low, 5% moderate, 15% high. */
export const POLARIZED_WEEK = [60, 60, 40, 10, 30];

/**
 * A ready answer. `weekMinutes` is the minutes in zones 1 to 5 of each week, oldest first; the last week is the one
 * still going (Monday 5 October 2026, today is Saturday the 10th). `pattern` and `index` are what the server would say.
 */
export function intensity({
  weekMinutes = Array.from({ length: 12 }, () => POLARIZED_WEEK),
  runsPerWeek = 4,
  runsWithHeartRatePerWeek = runsPerWeek,
  pattern = 'polarized',
  index = 2.38,
  overrides = {},
} = {}) {
  const count = weekMinutes.length;
  const lastMonday = new Date(2026, 9, 5, 12);
  const weeks = weekMinutes.map((minutes, i) => {
    const start = new Date(lastMonday);
    start.setDate(lastMonday.getDate() - 7 * (count - 1 - i));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const zoneSeconds = minutes.map((value) => value * 60);
    const covered = sum(zoneSeconds);
    return {
      start: day(start),
      end: day(end),
      complete: i < count - 1,
      runs: covered > 0 || runsWithHeartRatePerWeek === 0 ? runsPerWeek : 0,
      runsWithHeartRate: covered > 0 ? runsWithHeartRatePerWeek : 0,
      zoneSeconds,
      coveredSeconds: covered,
    };
  });
  const zoneSeconds = [0, 1, 2, 3, 4].map((zone) => sum(weeks.map((week) => week.zoneSeconds[zone])));
  const coveredSeconds = sum(zoneSeconds);
  const shares = coveredSeconds > 0
    ? {
      low: Math.round(((zoneSeconds[0] + zoneSeconds[1] + zoneSeconds[2]) / coveredSeconds) * 10000) / 10000,
      moderate: Math.round((zoneSeconds[3] / coveredSeconds) * 10000) / 10000,
      high: Math.round((zoneSeconds[4] / coveredSeconds) * 10000) / 10000,
    }
    : null;
  return {
    today: '2026-10-10',
    timeZone: 'America/New_York',
    lowZones: 3,
    minRuns: 3,
    minCoveredSeconds: 3600,
    weeks,
    summary: {
      runs: sum(weeks.map((week) => week.runs)),
      runsWithHeartRate: sum(weeks.map((week) => week.runsWithHeartRate)),
      coveredSeconds,
      zoneSeconds,
      shares,
      polarizationIndex: shares ? index : null,
      pattern: shares ? pattern : 'insufficient',
    },
    pendingRuns: 0,
    ...overrides,
  };
}

/** A runner whose runs have no analysed weeks at all. */
export const noIntensityWeeks = () => intensity({
  weekMinutes: [],
  overrides: { weeks: [], summary: { runs: 0, runsWithHeartRate: 0, coveredSeconds: 0, zoneSeconds: [0, 0, 0, 0, 0], shares: null, polarizationIndex: null, pattern: 'insufficient' } },
});
