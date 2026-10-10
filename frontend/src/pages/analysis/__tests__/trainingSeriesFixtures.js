// Answers of the two training series routes, shaped as the server sends them.

const pad = (value) => String(value).padStart(2, '0');
const day = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The same recursion the server runs (42 and 7 days), so the fixture's numbers agree with each other. */
function average(loads, days) {
  const k = 1 - Math.exp(-1 / days);
  let value = 0;
  return loads.map((load) => {
    value += (load - value) * k;
    return value;
  });
}
const round = (value) => Math.round(value * 10) / 10;

/**
 * A ready answer for `count` days ending on 10 Oct 2026: easy running with a hard block in the middle and the last five
 * days off, so the runner ends fresh. `loadOf(i)` is the effort of day i (0 is the oldest).
 */
export function series({ count = 40, loadOf = (i) => (i >= 35 || i % 7 === 6 ? 0 : i > 12 && i < 30 ? 140 : 70), overrides = {} } = {}) {
  const today = new Date(2026, 9, 10, 12);
  const loads = Array.from({ length: count }, (_, i) => loadOf(i));
  const fitness = average(loads, 42);
  const fatigue = average(loads, 7);
  const points = loads.map((load, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (count - 1 - i));
    return { date: day(date), load: round(load), fitness: round(fitness[i]), fatigue: round(fatigue[i]), form: round(fitness[i] - fatigue[i]) };
  });
  const lastFitness = fitness[count - 1];
  const lastFatigue = fatigue[count - 1];
  const projection = Array.from({ length: 14 }, (_, k) => {
    const date = new Date(today);
    date.setDate(today.getDate() + k + 1);
    const f = lastFitness * Math.exp(-(k + 1) / 42);
    const g = lastFatigue * Math.exp(-(k + 1) / 7);
    return { date: day(date), fitness: round(f), fatigue: round(g), form: round(f - g) };
  });
  const last = points[count - 1];
  const before = points[Math.max(0, count - 8)];
  return {
    from: points[0].date,
    to: last.date,
    today: last.date,
    timeZone: 'America/New_York',
    status: 'ready',
    historyDays: count,
    minHistoryDays: 14,
    fitnessDays: 42,
    fatigueDays: 7,
    points,
    projection,
    current: {
      date: last.date,
      fitness: last.fitness,
      fatigue: last.fatigue,
      form: last.form,
      fitnessChange7d: round(last.fitness - before.fitness),
      fatigueChange7d: round(last.fatigue - before.fatigue),
      formChange7d: round(last.form - before.form),
    },
    sources: { HR_ZONES: 24, PERCEIVED: 3, PACE_MODEL: 1 },
    runs: 28,
    pendingRuns: 0,
    ...overrides,
  };
}

export const noRuns = () => series({
  count: 1,
  overrides: { status: 'none', points: [], projection: [], current: null, sources: {}, runs: 0, historyDays: 0 },
});

export const tooYoung = () => series({
  count: 9,
  overrides: { status: 'building', points: [], projection: [], current: null, sources: { HR_ZONES: 4 }, runs: 4, historyDays: 9 },
});

export const noRunsInWindow = () => series({
  count: 1,
  overrides: { points: [], projection: [], current: null, sources: {}, runs: 0, historyDays: 200 },
});

const MONDAY = new Date(2026, 9, 5, 12);

/** Twelve weeks ending with the week of 5 Oct 2026, which is still going. */
export function weekly({ totals = [320, 300, 340, 280, 310, 360, 390, 420, 380, 330, 350, 210], overrides = {} } = {}) {
  const weeks = totals.map((total, i) => {
    const start = new Date(MONDAY);
    start.setDate(MONDAY.getDate() - 7 * (totals.length - 1 - i));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const complete = i < totals.length - 1;
    const prior = totals.slice(Math.max(0, i - 3), i);
    const range = prior.length === 3
      ? (() => {
        const mean = prior.reduce((sum, value) => sum + value, 0) / 3;
        return { low: round(mean * 0.8), high: round(mean * 1.2), average: round(mean) };
      })()
      : null;
    let status = 'none';
    if (range) {
      if (total > range.high) status = 'above';
      else if (total >= range.low) status = 'within';
      else status = complete ? 'below' : 'building';
    }
    return { start: day(start), end: day(end), total, runs: 4, complete, range, status };
  });
  return {
    today: '2026-10-10',
    timeZone: 'America/New_York',
    bandPercent: 20,
    weeks,
    pendingRuns: 0,
    ...overrides,
  };
}

export const noWeeks = () => weekly({ totals: [], overrides: { weeks: [] } });
