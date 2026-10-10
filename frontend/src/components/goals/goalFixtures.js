// Answers of the goals routes, shaped as the server sends them. Today is Wednesday 7 October 2026.

let nextId = 0;

/** A goal in the middle of a week: 23 of 70 km done, 15 of them by the start of today, 20 expected. */
export function goal(overrides = {}) {
  nextId += 1;
  return {
    id: nextId,
    period: 'WEEK',
    metric: 'DISTANCE',
    unit: 'km',
    target: 70,
    createdAt: '2026-09-01T08:00:00',
    updatedAt: '2026-09-01T08:00:00',
    periodStart: '2026-10-05',
    periodEnd: '2026-10-11',
    daysTotal: 7,
    daysLeft: 5,
    progress: 23,
    remaining: 47,
    percent: 32,
    reached: false,
    neededPerDay: 9.4,
    expectedByNow: 20,
    doneByNow: 15,
    status: 'behind',
    previous: { start: '2026-09-28', end: '2026-10-04', progress: 63, reached: false },
    thisRun: null,
    ...overrides,
  };
}

export const MAX_TARGET = { DISTANCE: 100000, TIME: 31536000, COUNT: 10000, ELEVATION: 1000000 };

export function response(goals = [], overrides = {}) {
  return {
    today: '2026-10-07',
    timeZone: 'Z',
    goals,
    periods: ['WEEK', 'MONTH', 'YEAR'],
    metrics: ['DISTANCE', 'TIME', 'COUNT', 'ELEVATION'],
    maxTarget: MAX_TARGET,
    ...overrides,
  };
}

export const reachedGoal = (overrides = {}) => goal({
  period: 'MONTH', metric: 'COUNT', unit: 'runs', target: 12, progress: 14, remaining: 0, percent: 116, reached: true,
  neededPerDay: null, expectedByNow: 3.4, doneByNow: 5, status: 'reached', daysTotal: 31, daysLeft: 25,
  periodStart: '2026-10-01', periodEnd: '2026-10-31', previous: { start: '2026-09-01', end: '2026-09-30', progress: 13, reached: true },
  ...overrides,
});

export const earlyGoal = (overrides = {}) => goal({
  period: 'YEAR', metric: 'ELEVATION', unit: 'm', target: 20000, progress: 0, remaining: 20000, percent: 0, neededPerDay: 54.79,
  expectedByNow: 0, doneByNow: 0, status: 'early', daysTotal: 365, daysLeft: 365,
  periodStart: '2026-01-01', periodEnd: '2026-12-31', previous: { start: '2025-01-01', end: '2025-12-31', progress: 0, reached: false },
  ...overrides,
});
