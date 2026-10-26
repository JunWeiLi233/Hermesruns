// Runs for the VO2max estimates page and the util behind it. The estimates (by Daniels and Gilbert, as vdot.js has them):
//   A  45.61  10 km in 50:00, average 150 of 190 bpm (heart rate)
//   B  44.54  5 km in 22:00, no heart rate (race equation)
//   C  46.23  8 km in 40:00, average 148 (heart rate)
//   D  43.40  12 km in 66:00, average 140 (heart rate)
//   E  44.02  6 km in 33:00, average 138 (heart rate)
//   F  45.58  2 km in 9:30, average 160 (heart rate): the highest estimate of a run under 3 km, so it is outside the pool
//   G  a 10 km run 100 days ago: outside the 90 days
//   H  5 km in 40:00 with no heart rate: 8:00 a km, past 1.18 times the median pace, so it has no estimate
// The three best of the pool (runs of 3 km or more) are C, A and B: 45.46, shown as 45.5. Without C the next three
// (A, B, E) would give 44.73, 0.7 lower.

export const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function run(id, name, { daysAgo, km, minutes, heartRate = null, maxHeartRate = null, penalty = 0 }) {
  return {
    id,
    name,
    startTime: new Date(NOW - daysAgo * DAY).toISOString(),
    distanceKm: km,
    movingTimeSeconds: Math.round(minutes * 60),
    averageHeartRate: heartRate,
    maxHeartRate,
    pacePenaltySecPerKm: penalty,
  };
}

export function mixedRuns() {
  return [
    run(1, 'Tempo on the canal', { daysAgo: 2, km: 10, minutes: 50, heartRate: 150, maxHeartRate: 190 }),
    run(2, 'Park 5K', { daysAgo: 6, km: 5, minutes: 22 }),
    run(3, 'Hill repeats', { daysAgo: 10, km: 8, minutes: 40, heartRate: 148, maxHeartRate: 188 }),
    run(4, 'Long steady run', { daysAgo: 14, km: 12, minutes: 66, heartRate: 140, maxHeartRate: 186 }),
    run(5, 'Easy six', { daysAgo: 20, km: 6, minutes: 33, heartRate: 138, maxHeartRate: 184 }),
    run(6, 'Strides', { daysAgo: 3, km: 2, minutes: 9.5, heartRate: 160, maxHeartRate: 178 }),
    run(7, 'Old tempo', { daysAgo: 100, km: 10, minutes: 45, heartRate: 160, maxHeartRate: 182 }),
    run(8, 'Recovery jog', { daysAgo: 4, km: 5, minutes: 40 }),
  ];
}

/**
 * Three easy 5 km runs at 25:00 and three races, none with a heart rate (so every estimate is Daniels' race equation):
 *   44  Spring 10K, 10 days ago, 10 km in 45:00      the number before it is the easy runs' 38.3
 *   46  Fun run, 5 days ago, 1.2 km in 5:00          under 1.5 km: no number from its time
 *   45  Club 5K, 2 days ago, 5 km in 22:00           the number before it is the mean of the 10K and two easy runs
 */
export function racesRuns() {
  return [
    run(41, 'Easy one', { daysAgo: 30, km: 5, minutes: 25 }),
    run(42, 'Easy two', { daysAgo: 25, km: 5, minutes: 25 }),
    run(43, 'Easy three', { daysAgo: 20, km: 5, minutes: 25 }),
    { ...run(44, 'Spring 10K', { daysAgo: 10, km: 10, minutes: 45 }), runType: 'RACE' },
    { ...run(45, 'Club 5K', { daysAgo: 2, km: 5, minutes: 22 }), runType: 'RACE' },
    { ...run(46, 'Fun run', { daysAgo: 5, km: 1.2, minutes: 5 }), runType: 'RACE' },
  ];
}

/** A race with no run before it at all, and a race 200 days ago with one run ten days before it (and none in the last 90 days). */
export function lonelyRaces() {
  return [
    { ...run(51, 'First ever race', { daysAgo: 3, km: 5, minutes: 24 }), runType: 'RACE' },
  ];
}

export function oldRaceRuns() {
  return [
    run(61, 'Last summer', { daysAgo: 200, km: 10, minutes: 50, heartRate: 150, maxHeartRate: 190 }),
    { ...run(62, 'Autumn 10K', { daysAgo: 190, km: 10, minutes: 46 }), runType: 'RACE' },
  ];
}

/**
 * 140 runs of 5 km, one every three days from 420 days ago to 3 days ago, each a little quicker than the one before (25:30
 * down to 23:00 in even steps), none with a heart rate: the number after run i is the mean of runs i, i-1 and i-2, the
 * quickest three of the 31 within 90 days of it.
 */
export const LONG_HISTORY_RUNS = 140;
export const longHistoryMinutes = (index) => 25.5 - (2.5 * index) / (LONG_HISTORY_RUNS - 1);
/** What a run is recorded as: whole seconds, which is what the estimate is worked out from. */
export const longHistorySeconds = (index) => Math.round(longHistoryMinutes(index) * 60);
export function longHistory() {
  return Array.from({ length: LONG_HISTORY_RUNS }, (_, index) => run(300 + index, `Long ${index + 1}`, { daysAgo: 420 - index * 3, km: 5, minutes: longHistoryMinutes(index) }));
}

/** Three runs more than a year old, nothing since. */
export function ancientRuns() {
  return [
    run(401, 'Ancient one', { daysAgo: 400, km: 5, minutes: 25 }),
    run(402, 'Ancient two', { daysAgo: 398, km: 5, minutes: 25 }),
    run(403, 'Ancient three', { daysAgo: 396, km: 5, minutes: 25 }),
  ];
}

/** Only short runs in the window: nothing is 3 km, so the pool is every run. */
export function shortRuns() {
  return [
    run(11, 'Shakeout', { daysAgo: 3, km: 2.2, minutes: 11, heartRate: 150, maxHeartRate: 190 }),
    run(12, 'Strides', { daysAgo: 8, km: 2, minutes: 9.5, heartRate: 160, maxHeartRate: 180 }),
  ];
}

/** Runs, none in the last 90 days. */
export function oldRuns() {
  return [run(21, 'Last summer', { daysAgo: 200, km: 10, minutes: 50, heartRate: 150, maxHeartRate: 190 })];
}

/** More than a screen of runs, with a name far too long for a row. */
export function manyRuns() {
  const longName = 'An early morning progression run along the river and up the long hill to the observatory and back';
  return Array.from({ length: 24 }, (_, index) => run(
    100 + index,
    index === 0 ? longName : `Run ${index + 1}`,
    {
      daysAgo: 1 + index * 3,
      km: 5 + (index % 5) * 1.5,
      minutes: (5 + (index % 5) * 1.5) * (5 + (index % 3) * 0.2),
      heartRate: 140 + (index % 7) * 2,
      maxHeartRate: 190,
      penalty: index % 4 === 0 ? 8 : 0,
    },
  ));
}
