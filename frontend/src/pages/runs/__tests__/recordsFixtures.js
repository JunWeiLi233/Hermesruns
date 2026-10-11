/** Answers of the records endpoints, shaped as the server sends them, for the tests of the cards that draw them. */

/** One best effort of a run (GET /api/activities/{id}/best-efforts). A 5 km in 25:00, a PR, by default. */
export function effort(overrides = {}) {
  return {
    distanceKey: '5km',
    distanceMeters: 5000,
    elapsedSeconds: 1500,
    effectiveSeconds: 1500,
    paceSecPerKm: 300,
    edited: false,
    estimated: false,
    hidden: false,
    rank: 1,
    startOffsetSeconds: 120,
    endOffsetSeconds: 1620,
    ...overrides,
  };
}

/** A run with a 400 m, a 1 km, a 5 km and an estimated 10 km. */
export function runEfforts({ complete = true, efforts } = {}) {
  return {
    complete,
    efforts: efforts ?? [
      effort({ distanceKey: '400m', distanceMeters: 400, elapsedSeconds: 84, effectiveSeconds: 84, paceSecPerKm: 210, rank: 3, startOffsetSeconds: 30, endOffsetSeconds: 114 }),
      effort({ distanceKey: '1km', distanceMeters: 1000, elapsedSeconds: 285, effectiveSeconds: 285, paceSecPerKm: 285, rank: 2, startOffsetSeconds: 600, endOffsetSeconds: 885 }),
      effort(),
      effort({ distanceKey: '10km', distanceMeters: 10000, elapsedSeconds: 3100, effectiveSeconds: 3100, paceSecPerKm: 310, rank: 12, estimated: true, startOffsetSeconds: null, endOffsetSeconds: null }),
    ],
  };
}

/** A run of the route (GET /api/activities/{id}/matches), oldest first as the server sends them. */
export function matchRun(overrides = {}) {
  const date = overrides.date ?? '2026-09-01';
  const movingSeconds = overrides.movingSeconds ?? 1800;
  const distanceMeters = overrides.distanceMeters ?? 6000;
  return {
    activityId: Number(date.replaceAll('-', '')),
    name: `Run on ${date}`,
    startTime: `${date}T07:00:00`,
    date,
    year: Number(date.slice(0, 4)),
    distanceMeters,
    movingSeconds,
    paceSecPerKm: Math.round((movingSeconds / (distanceMeters / 1000)) * 10) / 10,
    current: false,
    fastest: false,
    ...overrides,
  };
}

/** Four runs over a 6 km route in two years: the fastest is 2025-05-10 and the run on screen is 2026-09-20. */
export function matches({ complete = true, runs } = {}) {
  const list = runs ?? [
    matchRun({ date: '2025-05-10', movingSeconds: 1740, fastest: true }),
    matchRun({ date: '2025-11-02', movingSeconds: 1800 }),
    matchRun({ date: '2026-03-15', movingSeconds: 1830 }),
    matchRun({ date: '2026-09-20', movingSeconds: 1860, current: true }),
  ];
  return { complete, groupId: 7, count: list.length, loop: false, distanceMeters: 6000, runs: list };
}

/** Only run of its route: the server answers with no runs to list. */
export function aloneOnItsRoute({ groupId = 7, complete = true } = {}) {
  return { complete, groupId, count: groupId == null ? 0 : 1, loop: false, distanceMeters: groupId == null ? 0 : 6000, runs: [] };
}

/** The runner's best efforts at one distance (GET /api/training/best-efforts). */
export function analysis(overrides = {}) {
  const ranked = (rank, date, effectiveSeconds, extra = {}) => ({
    rank,
    activityId: 100 + rank,
    name: `5 km on ${date}`,
    date,
    effectiveSeconds,
    paceSecPerKm: effectiveSeconds / 5,
    edited: false,
    estimated: false,
    ...extra,
  });
  return {
    complete: true,
    distances: [
      { key: '1km', meters: 1000, count: 30, bestSeconds: 245 },
      { key: '5km', meters: 5000, count: 24, bestSeconds: 1290 },
      { key: '10km', meters: 10000, count: 9, bestSeconds: 2750 },
    ],
    key: '5km',
    meters: 5000,
    years: [2024, 2025, 2026],
    year: 2026,
    lifetime: [ranked(1, '2025-05-10', 1290), ranked(2, '2026-03-15', 1315, { edited: true }), ranked(3, '2024-10-01', 1330)],
    annual: [ranked(1, '2026-03-15', 1315, { edited: true }), ranked(2, '2026-06-01', 1340), ranked(3, '2026-08-09', 1352, { estimated: true })],
    trend: [
      { year: 2024, bestSeconds: 1330, count: 6 },
      { year: 2025, bestSeconds: 1290, count: 11 },
      { year: 2026, bestSeconds: 1315, count: 7 },
    ],
    ...overrides,
  };
}

export const NO_EFFORTS_ANALYSIS = {
  complete: true, distances: [], key: null, meters: 0, years: [], year: null, lifetime: [], annual: [], trend: [],
};
