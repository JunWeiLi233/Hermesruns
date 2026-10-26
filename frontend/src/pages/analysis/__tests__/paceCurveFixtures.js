// Answers of GET /api/training/pace-curve, shaped as the server sends them.

const LINE = { cs: 4.0, dPrime: 200 };

const DISTANCES = [
  ['half_mile', 804.672],
  ['1km', 1000],
  ['1mile', 1609.344],
  ['3km', 3000],
  ['5km', 5000],
  ['10km', 10000],
];

const round1 = (value) => Math.round(value * 10) / 10;

/** A point on the line d = 200 + 4 t, which is where the fitted line of the answer below passes. */
function pointOn(key, meters, { inModel, activityId, date, name }) {
  const seconds = (meters - LINE.dPrime) / LINE.cs;
  return {
    key,
    meters,
    seconds: round1(seconds),
    paceSecondsPerKm: round1((seconds / meters) * 1000),
    date,
    activityId,
    name,
    edited: false,
    inModel,
  };
}

/**
 * An answer for a runner whose best efforts all lie on one line (critical speed 4 m/s, D' 200 m): the half mile is too
 * short for the fit and the 10 km too long, the other four are in it.
 */
export function paceCurve({ overrides = {} } = {}) {
  const used = new Set(['1km', '1mile', '3km', '5km']);
  const points = DISTANCES.map(([key, meters], index) => pointOn(key, meters, {
    inModel: used.has(key),
    activityId: 100 + index,
    date: `2026-09-${String(10 + index).padStart(2, '0')}`,
    name: `Run ${index + 1}`,
  }));
  return {
    today: '2026-10-10',
    timeZone: 'America/New_York',
    days: 180,
    from: '2026-04-14',
    to: '2026-10-10',
    complete: true,
    points,
    model: { status: 'ok', criticalSpeedMps: 4.0, criticalPaceSecondsPerKm: 250.0, dPrimeMeters: 200.0, pointsUsed: 4, maxErrorPercent: 0.0 },
    limits: { minSeconds: 180, maxSeconds: 2400, minPoints: 3, minSpread: 2.5, okErrorPercent: 5, roughErrorPercent: 10 },
    ...overrides,
  };
}

/** No effort at all in the window. */
export const noPoints = () => paceCurve({
  overrides: {
    points: [],
    model: { status: 'too_few_points', criticalSpeedMps: null, criticalPaceSecondsPerKm: null, dPrimeMeters: null, pointsUsed: 0, maxErrorPercent: null },
  },
});

/** Two efforts, so no line. */
export const twoPoints = () => {
  const base = paceCurve();
  return paceCurve({
    overrides: {
      points: base.points.filter((point) => point.key === '1km' || point.key === '5km').map((point) => ({ ...point, inModel: false })),
      model: { status: 'too_few_points', criticalSpeedMps: null, criticalPaceSecondsPerKm: null, dPrimeMeters: null, pointsUsed: 2, maxErrorPercent: null },
    },
  });
};

/** A fit the server calls rough. */
export const roughFit = () => paceCurve({
  overrides: {
    model: { status: 'rough', criticalSpeedMps: 3.9, criticalPaceSecondsPerKm: 256.4, dPrimeMeters: 230.0, pointsUsed: 4, maxErrorPercent: 7.4 },
  },
});
