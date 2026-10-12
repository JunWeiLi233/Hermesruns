import { describe, expect, it } from 'vitest';
import {
  PREDICTION_ANCHOR_DAYS,
  VDOT_LOOKBACK_MS,
  computeRollingRepresentativeSeries,
  collectAllVdotEntries,
  predictRaceTime,
  predictRaceTimeCalibrated,
} from './vdot';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);

/** A 5 km run of the given time, `daysBack` days before NOW, with a heart rate so that it counts towards fitness. */
function fiveK(daysBack, minutes) {
  return {
    id: daysBack,
    distanceKm: 5,
    movingTimeSeconds: Math.round(minutes * 60),
    averageHeartRate: 170,
    maxHeartRate: 190,
    startTime: new Date(NOW - daysBack * DAY).toISOString(),
  };
}

describe('how far back a run can anchor a prediction', () => {
  it('is the 90 days the fitness figure is taken from, and the pages say so', () => {
    expect(PREDICTION_ANCHOR_DAYS).toBe(90);
    expect(PREDICTION_ANCHOR_DAYS * DAY).toBe(VDOT_LOOKBACK_MS);
  });

  it('is not moved by a run older than that, however fast it was (BUG-015)', () => {
    const vdot = 45;
    const without = predictRaceTimeCalibrated(vdot, 5000, [fiveK(20, 26)], { asOf: NOW });
    const withOldFastRun = predictRaceTimeCalibrated(vdot, 5000, [fiveK(20, 26), fiveK(130, 21)], { asOf: NOW });

    expect(withOldFastRun).toBe(without);
  });

  it('is moved by a run inside the window', () => {
    const vdot = 45;
    const without = predictRaceTimeCalibrated(vdot, 5000, [fiveK(20, 26)], { asOf: NOW });
    const withRecentFastRun = predictRaceTimeCalibrated(vdot, 5000, [fiveK(20, 26), fiveK(40, 21)], { asOf: NOW });

    expect(withRecentFastRun).toBeLessThan(without);
  });
});

describe('a prediction as of an earlier day (BUG-035)', () => {
  const runs = [fiveK(70, 31.7), fiveK(40, 29.2), fiveK(14, 26.7), fiveK(4, 25)];
  const entries = collectAllVdotEntries(runs.map((run) => ({ ...run, startTime: run.startTime })));
  const series = computeRollingRepresentativeSeries(entries);

  it('leaves out the runs that had not happened yet', () => {
    // At the day of the first run only that run exists: the prediction is what that run says, not what today's best run pulls it to.
    const first = series[0];
    const asThen = predictRaceTimeCalibrated(first.y, 5000, runs, { asOf: first.x });
    const asToday = predictRaceTimeCalibrated(first.y, 5000, runs, { asOf: NOW });

    expect(asThen).toBeGreaterThan(asToday);
    // The run itself (31:42) and the formula agree within seconds, so the first point of the history is about 31:40, not 26:35.
    expect(asThen).toBeGreaterThan(30);
    expect(asThen).toBeLessThan(33);
  });

  it('counts ages from that day, not from today', () => {
    const point = series[1];
    const asThen = predictRaceTimeCalibrated(point.y, 5000, runs, { asOf: point.x });
    const baseline = predictRaceTime(point.y, 5000);

    // 29:12 was run on that very day, so it anchors fully fresh; counted from today it would be 40 days old and weigh less.
    expect(asThen).toBeLessThan(baseline);
    const asIfTwoMonthsLater = predictRaceTimeCalibrated(point.y, 5000, runs.slice(0, 2), { asOf: point.x + 60 * DAY });
    expect(asIfTwoMonthsLater).toBeGreaterThan(asThen);
  });

  it('falls steadily as the runner got faster, over a spread as wide as the runs themselves', () => {
    const history = series.map((point) => predictRaceTimeCalibrated(point.y, 5000, runs, { asOf: point.x }));

    expect(history).toEqual([...history].sort((a, b) => b - a));
    expect(history[0] - history[history.length - 1]).toBeGreaterThan(4);
  });
});
