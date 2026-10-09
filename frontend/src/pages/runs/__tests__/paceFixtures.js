/**
 * A pace profile as the endpoint sends it, for the pace card tests. Four splits (three full kilometres and 350 m), a
 * smoothed series of eleven samples 100 s apart, and paces that fall in every VDOT 50 pace zone.
 *
 * By pace the fastest split is 2 and the slowest is 1; adjusted for grade it is the other way round (split 1 was a
 * climb, split 2 a descent).
 */
export function paceProfile(overrides = {}) {
  const profile = {
    hasStream: true,
    hasElevation: true,
    summary: {
      distanceMeters: 3350.0,
      elapsedSeconds: 1035.0,
      movingSeconds: 1035.0,
      stoppedSeconds: 0.0,
      paceSecPerKm: 309.0,
      gapSecPerKm: 304.0,
    },
    splits: [
      { index: 1, distanceMeters: 1000.0, seconds: 330.0, paceSecPerKm: 330.0, gapSecPerKm: 280.0, elevationChangeMeters: 20.0, partial: false },
      { index: 2, distanceMeters: 1000.0, seconds: 300.0, paceSecPerKm: 300.0, gapSecPerKm: 330.0, elevationChangeMeters: -20.0, partial: false },
      { index: 3, distanceMeters: 1000.0, seconds: 315.0, paceSecPerKm: 315.0, gapSecPerKm: 315.0, elevationChangeMeters: 0.0, partial: false },
      { index: 4, distanceMeters: 350.0, seconds: 108.5, paceSecPerKm: 310.0, gapSecPerKm: 305.0, elevationChangeMeters: 1.0, partial: true },
    ],
    markers: {
      pace: { fastestSplit: 2, slowestSplit: 1 },
      gap: { fastestSplit: 1, slowestSplit: 2 },
    },
    smoothed: {
      stepSeconds: 100,
      windowSeconds: 300,
      t: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
      distanceKm: [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0],
      paceSecPerKm: [380, 330, 330, 300, null, 280, 280, 255, 235, 210, 330],
      gapSecPerKm: [330, 330, 300, 280, null, 255, 255, 235, 210, 200, 300],
      elevationMeters: [100, 104, 108, 112, 110, 108, 104, 100, 100, 100, 101],
    },
  };
  return { ...profile, ...overrides };
}

/** A run with a stream but no elevation: nothing to adjust for grade, so no grade-adjusted figures at all. */
export function paceProfileWithoutElevation() {
  const base = paceProfile();
  return paceProfile({
    hasElevation: false,
    summary: { ...base.summary, gapSecPerKm: undefined },
    splits: base.splits.map((split) => {
      const copy = { ...split };
      delete copy.gapSecPerKm;
      delete copy.elevationChangeMeters;
      return copy;
    }),
    markers: { pace: base.markers.pace },
    smoothed: {
      ...base.smoothed,
      gapSecPerKm: base.smoothed.gapSecPerKm.map(() => null),
      elevationMeters: base.smoothed.elevationMeters.map(() => null),
    },
  });
}

export const NO_STREAM = {
  hasStream: false,
  hasElevation: false,
  splits: [],
};
