// Runs for the tests of the Quality sessions page, made so that every figure on the page can be worked out by hand (the same season as utils/qualitySessions.vitest.js).

/** The device's clock for the tests: the morning of 15 October 2026. The 3 months to it start on 15 July and are 93 days. */
export const NOW = new Date(2026, 9, 15, 9, 0, 0);

function run(id, day, km, seconds, extra = {}) {
  return { id, name: `Run ${id}`, startTime: `${day}T07:00:00`, distanceKm: km, movingTimeSeconds: seconds, ...extra };
}

/**
 * In the 3 months: a workout of 8 km at 290 s/km (10 October), a workout of 6 km at 300 (20 September), a race of 10 km at 295 (30 August), a long run of 20 km at 310
 * (1 September) and five ordinary runs of 5 km at 330; in the 3 months before: a workout of 7 km on 1 June and an ordinary run on 10 May.
 */
export function runs() {
  return [
    run(1, '2026-10-10', 8, 8 * 290, { runType: 'WORKOUT', averageHeartRate: 165, maxHeartRate: 178 }),
    run(2, '2026-09-20', 6, 6 * 300, { runType: 'WORKOUT', averageHeartRate: 160, maxHeartRate: 175 }),
    run(3, '2026-08-30', 10, 10 * 295, { runType: 'RACE', averageHeartRate: 172, maxHeartRate: 186 }),
    run(4, '2026-09-01', 20, 20 * 310, { runType: 'LONG_RUN', averageHeartRate: 150, maxHeartRate: 165 }),
    ...['2026-10-12', '2026-10-02', '2026-09-10', '2026-08-15', '2026-07-25'].map((day, index) => run(10 + index, day, 5, 5 * 330, { averageHeartRate: 140 })),
    run(20, '2026-06-01', 7, 7 * 300, { runType: 'WORKOUT' }),
    run(21, '2026-05-10', 5, 5 * 330),
  ];
}

/** The same runs with no type on any of them. */
export function runsWithNoTypes() {
  return runs().map((item) => ({ ...item, runType: null }));
}
