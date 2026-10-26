// Runs for the tests of the Trends page, made so that every figure on the page can be worked out by hand.
import { addDaysToKey } from '../../../utils/calendarDays';

/** The device's clock for the tests: the morning of 15 October 2026. */
export const NOW = new Date(2026, 9, 15, 9, 0, 0);
export const TODAY = '2026-10-15';

/**
 * Forty runs five days apart, the newest four days before today (11 October) and the oldest 199 days before it (1 April). Counting from the oldest, `c` = 0 to 39:
 *   - 8 km each, at 360 - 2c seconds a kilometre: the pace falls by exactly 2 s/km a run, which is 0.4 s/km a day and 12 s/km for a month, along a perfect line;
 *   - an average heart rate of 140 + (c mod 5), except that c = 3, 10, 17, 24, 31 and 38 (every c with c mod 7 = 3) carry none;
 *   - a cadence of 160 + (c mod 4);
 *   - the type Workout for c = 0, 9, 18, 27 and 36; Race for c = 3, 17 and 31; Long run for c = 22; no type for the other 30.
 * In the last 6 months (from 15 April) there are the 36 runs c = 4 to 39, and the 6 months before hold the 4 runs c = 0 to 3.
 */
export function runs() {
  return Array.from({ length: 40 }, (_, c) => {
    const day = addDaysToKey(TODAY, -(4 + 5 * (39 - c)));
    let runType = null;
    if (c % 9 === 0) runType = 'WORKOUT';
    else if (c % 14 === 3) runType = 'RACE';
    else if (c === 22) runType = 'LONG_RUN';
    return {
      id: c + 1,
      name: `Morning run ${c}`,
      startTime: `${day}T07:00:00`,
      startDate: day,
      distanceKm: 8,
      distanceMeters: 8000,
      movingTimeSeconds: 8 * (360 - 2 * c),
      averageHeartRate: c % 7 === 3 ? null : 140 + (c % 5),
      maxHeartRate: 175,
      averageCadence: 160 + (c % 4),
      runType,
    };
  });
}

/** The same runs with no heart rate on any of them. */
export function runsWithoutHeartRate() {
  return runs().map((run) => ({ ...run, averageHeartRate: null }));
}
