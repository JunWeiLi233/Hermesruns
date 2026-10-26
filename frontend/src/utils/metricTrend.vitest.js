import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AVERAGE_FROM,
  AVERAGE_RUNS,
  DEFAULT_RANGE,
  MIN_DAYS_FOR_LINE,
  MIN_RUNS_FOR_LINE,
  MIN_RUNS_TO_COMPARE,
  SPREAD_FROM_RUNS,
  buildMetricTrend,
  inRunSet,
  metricValue,
  movingAverage,
  quantile,
  straightLine,
  summarize,
  trendPeriod,
} from './metricTrend';

const TODAY = '2026-10-15';

/** A run on a day (with the clock of its start), `km` long in `minutes`, with what else a test wants to say about it. */
function run(id, day, km, minutes, extra = {}) {
  return { id, name: `Run ${id}`, startTime: `${day}T07:00:00`, distanceKm: km, movingTimeSeconds: minutes * 60, ...extra };
}

describe('the value of a run', () => {
  const steady = run(1, '2026-10-01', 5, 25, { averageHeartRate: 150, averageCadence: 170 });

  it('is worked out from the distance, the moving time and the heart rate the run carries', () => {
    expect(metricValue(steady, 'pace')).toBe(300);
    expect(metricValue(steady, 'distance')).toBe(5);
    expect(metricValue(steady, 'duration')).toBe(1500);
    expect(metricValue(steady, 'heartRate')).toBe(150);
    // 5,000 m in 25 minutes is 200 m a minute, over 150 beats a minute: 1.333 metres for each beat.
    expect(metricValue(steady, 'efficiency')).toBeCloseTo(200 / 150, 10);
    expect(metricValue(steady, 'cadence')).toBe(170);
  });

  it('has no heart rate, and so no efficiency, for a run with none or with a heart rate no heart has', () => {
    for (const bad of [undefined, null, 0, 39, 40, 251, 'fast']) {
      const withBad = run(2, '2026-10-01', 5, 25, { averageHeartRate: bad });
      expect(metricValue(withBad, 'heartRate')).toBeNull();
      expect(metricValue(withBad, 'efficiency')).toBeNull();
      expect(metricValue(withBad, 'pace')).toBe(300);
    }
    expect(metricValue(run(3, '2026-10-01', 5, 25, { averageHeartRate: 41 }), 'heartRate')).toBe(41);
    expect(metricValue(run(3, '2026-10-01', 5, 25, { averageHeartRate: 249 }), 'heartRate')).toBe(249);
  });

  it('has no cadence for a run that carries none', () => {
    expect(metricValue(run(4, '2026-10-01', 5, 25), 'cadence')).toBeNull();
    expect(metricValue(run(4, '2026-10-01', 5, 25, { averageCadence: 0 }), 'cadence')).toBeNull();
    expect(metricValue(run(4, '2026-10-01', 5, 25, { averageCadence: 900 }), 'cadence')).toBeNull();
  });

  it('is nothing for a run with no distance or no time, and reads the distance in metres when the kilometres are missing', () => {
    expect(metricValue(run(5, '2026-10-01', 0, 25), 'pace')).toBeNull();
    expect(metricValue(run(5, '2026-10-01', 5, 0), 'pace')).toBeNull();
    expect(metricValue({ startTime: '2026-10-01T07:00:00', distanceMeters: 8000, movingTimeSeconds: 2400 }, 'pace')).toBe(300);
    expect(metricValue(steady, 'nonsense')).toBeNull();
    expect(metricValue(null, 'pace')).toBeNull();
  });
});

describe('which runs are looked at', () => {
  it('takes every run for "all", the runs with none of the three types for "ordinary", and the runs of one type for the others', () => {
    const plain = run(1, '2026-10-01', 5, 25);
    const race = run(2, '2026-10-02', 10, 45, { runType: 'RACE' });
    const long = run(3, '2026-10-03', 20, 110, { runType: 'LONG_RUN' });
    const workout = run(4, '2026-10-04', 8, 35, { runType: 'WORKOUT' });
    const odd = run(5, '2026-10-05', 5, 25, { runType: 'EASY' });
    const all = [plain, race, long, workout, odd];
    expect(all.filter((r) => inRunSet(r, 'all'))).toHaveLength(5);
    expect(all.filter((r) => inRunSet(r, 'ordinary'))).toEqual([plain, odd]);
    expect(all.filter((r) => inRunSet(r, 'race'))).toEqual([race]);
    expect(all.filter((r) => inRunSet(r, 'long'))).toEqual([long]);
    expect(all.filter((r) => inRunSet(r, 'workout'))).toEqual([workout]);
  });

  it('reads a type however it is cased', () => {
    expect(inRunSet({ runType: 'race' }, 'race')).toBe(true);
    expect(inRunSet({ runType: 'Workout' }, 'ordinary')).toBe(false);
  });
});

describe('the middle and the spread', () => {
  it('works the quantiles out between the two nearest values, in proportion', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(ten, 0.1)).toBeCloseTo(1.9, 10);
    expect(quantile(ten, 0.9)).toBeCloseTo(9.1, 10);
    const eleven = [...ten, 11];
    expect(quantile(eleven, 0.1)).toBe(2);
    expect(quantile(eleven, 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBeNull();
    expect(quantile([7], 0.9)).toBe(7);
  });

  it('gives the 10th to the 90th percentile as the usual spread from ten runs, and the lowest to the highest under that', () => {
    expect(SPREAD_FROM_RUNS).toBe(10);
    const ten = summarize([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(ten).toMatchObject({ count: 10, median: 5.5, mean: 5.5, min: 1, max: 10, usual: true });
    expect(ten.low).toBeCloseTo(1.9, 10);
    expect(ten.high).toBeCloseTo(9.1, 10);
    const nine = summarize([9, 1, 5, 3, 7, 2, 8, 4, 6]);
    expect(nine).toMatchObject({ count: 9, median: 5, low: 1, high: 9, usual: false });
    expect(summarize([])).toBeNull();
    expect(summarize(null)).toBeNull();
  });
});

describe('the straight line', () => {
  it('finds a line that is exact, its slope for a month, its change along the period and a fit of 1', () => {
    const points = [0, 10, 20, 30, 40].map((x) => ({ x, value: 100 - 0.2 * x }));
    const line = straightLine(points);
    expect(line.ok).toBe(true);
    expect(line.slopePerDay).toBeCloseTo(-0.2, 10);
    expect(line.slopePerMonth).toBeCloseTo(-6, 10);
    expect(line.change).toBeCloseTo(-8, 10);
    expect(line.r2).toBeCloseTo(1, 10);
    expect(line.from).toEqual({ x: 0, value: expect.closeTo(100, 10) });
    expect(line.to).toEqual({ x: 40, value: expect.closeTo(92, 10) });
  });

  it('gives the share of the differences between the runs that the line accounts for (R squared) when the runs do not lie on it', () => {
    // mean x 20, mean y 3: sxx 1000, sxy 90, syy 10, so the slope is 0.09 and r2 = 90^2 / (1000 x 10) = 0.81.
    const points = [[0, 1], [10, 3], [20, 2], [30, 4], [40, 5]].map(([x, value]) => ({ x, value }));
    const line = straightLine(points);
    expect(line.slopePerDay).toBeCloseTo(0.09, 10);
    expect(line.r2).toBeCloseTo(0.81, 10);
    expect(line.from.value).toBeCloseTo(3 + 0.09 * (0 - 20), 10);
  });

  it('is level, with nothing to account for, for runs that are all the same', () => {
    const line = straightLine([0, 10, 20, 30, 40].map((x) => ({ x, value: 5 })));
    expect(line.ok).toBe(true);
    expect(line.slopePerDay).toBe(0);
    expect(line.r2).toBe(0);
  });

  it('is not drawn through too few runs, or through runs all of a few days', () => {
    expect(MIN_RUNS_FOR_LINE).toBe(5);
    expect(MIN_DAYS_FOR_LINE).toBe(14);
    expect(straightLine([0, 10, 20, 30].map((x) => ({ x, value: x }))).reason).toBe('few');
    expect(straightLine([0, 3, 6, 9, 13.9].map((x) => ({ x, value: x }))).reason).toBe('short');
    expect(straightLine([0, 3, 6, 9, 14].map((x) => ({ x, value: x }))).ok).toBe(true);
  });
});

describe('the moving average', () => {
  it('is the mean of the latest ten runs at each run, from the fifth run on', () => {
    expect(AVERAGE_RUNS).toBe(10);
    expect(AVERAGE_FROM).toBe(5);
    const points = Array.from({ length: 12 }, (_, index) => ({ x: index * 3, value: index + 1 }));
    const average = movingAverage(points);
    expect(average.ok).toBe(true);
    expect(average.path.map((point) => point.value)).toEqual([3, 3.5, 4, 4.5, 5, 5.5, 6.5, 7.5]);
    expect(average.path.map((point) => point.x)).toEqual([12, 15, 18, 21, 24, 27, 30, 33]);
    expect(average.start.value).toBe(3);
    expect(average.end.value).toBe(7.5);
    expect(average.change).toBe(4.5);
  });

  it('is not drawn for fewer than five runs', () => {
    const average = movingAverage([1, 2, 3, 4].map((value, index) => ({ x: index, value })));
    expect(average).toMatchObject({ ok: false, reason: 'few' });
  });
});

describe('the period', () => {
  it('ends on the runner\'s today and starts the same day that many months before, with the stretch before it ending the day before', () => {
    expect(trendPeriod('6m', TODAY)).toEqual({ from: '2026-04-15', to: TODAY, before: { from: '2025-10-15', to: '2026-04-14' } });
    expect(trendPeriod('3m', TODAY)).toEqual({ from: '2026-07-15', to: TODAY, before: { from: '2026-04-15', to: '2026-07-14' } });
    expect(trendPeriod('1y', TODAY)).toEqual({ from: '2025-10-15', to: TODAY, before: { from: '2024-10-15', to: '2025-10-14' } });
  });

  it('starts at the first run for "all", which has nothing before it, and takes a range it does not know as the default', () => {
    expect(trendPeriod('all', TODAY, '2025-01-02')).toEqual({ from: '2025-01-02', to: TODAY, before: null });
    expect(trendPeriod('all', TODAY)).toEqual({ from: TODAY, to: TODAY, before: null });
    expect(trendPeriod('whenever', TODAY)).toEqual(trendPeriod(DEFAULT_RANGE, TODAY));
  });
});

describe('a trend', () => {
  /** Twelve runs, one every 12 days from 1 May, each 12 seconds a kilometre quicker than the one before, and eight in the stretch before. */
  function season() {
    const now = Array.from({ length: 12 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 4, 1 + index * 12)).toISOString().slice(0, 10);
      return run(100 + index, day, 8, (8 * (360 - index * 12)) / 60, { averageHeartRate: 150 - index, runType: index % 4 === 3 ? 'WORKOUT' : undefined });
    });
    const earlier = Array.from({ length: 8 }, (_, index) => {
      const day = new Date(Date.UTC(2025, 9, 20 + index * 15)).toISOString().slice(0, 10);
      return run(200 + index, day, 8, (8 * 400) / 60, { averageHeartRate: 160 });
    });
    return [...now, ...earlier];
  }

  it('lists the runs of the period oldest first, with each run\'s value, and works the line out from them', () => {
    const trend = buildMetricTrend(season(), { metric: 'pace', range: '6m', today: TODAY });
    expect(trend.from).toBe('2026-04-15');
    expect(trend.points).toHaveLength(12);
    expect(trend.points.map((point) => point.id)).toEqual(Array.from({ length: 12 }, (_, index) => 100 + index));
    expect(trend.points[0].value).toBeCloseTo(360, 8);
    expect(trend.points[11].value).toBeCloseTo(360 - 11 * 12, 8);
    expect(trend.points[0]).toMatchObject({ name: 'Run 100', km: 8, day: '2026-05-01' });
    // Twelve days apart, 12 s a km quicker each time: -1 s a km a day, so -30 s a km for a month, along a perfect line.
    expect(trend.trend.ok).toBe(true);
    expect(trend.trend.slopePerDay).toBeCloseTo(-1, 8);
    expect(trend.trend.slopePerMonth).toBeCloseTo(-30, 8);
    expect(trend.trend.r2).toBeCloseTo(1, 8);
    expect(trend.stats.count).toBe(12);
    expect(trend.stats.median).toBeCloseTo(360 - 5.5 * 12, 8);
  });

  it('compares the middle of the period with the middle of the stretch before it', () => {
    const trend = buildMetricTrend(season(), { metric: 'pace', range: '6m', today: TODAY });
    expect(trend.comparison).toMatchObject({ from: '2025-10-15', to: '2026-04-14', count: 8, ok: true });
    expect(trend.comparison.median).toBeCloseTo(400, 8);
    expect(trend.comparison.change).toBeCloseTo(trend.stats.median - 400, 8);
    expect(trend.comparison.change).toBeLessThan(0);
  });

  it('says there are too few runs to compare when one of the two stretches has fewer than three', () => {
    expect(MIN_RUNS_TO_COMPARE).toBe(3);
    const fewer = season().filter((r) => r.id < 200 || r.id < 202);
    const trend = buildMetricTrend(fewer, { metric: 'pace', range: '6m', today: TODAY });
    expect(trend.comparison).toMatchObject({ ok: false, reason: 'few', count: 2, change: null });
    const none = buildMetricTrend(season().filter((r) => r.id < 200), { metric: 'pace', range: '6m', today: TODAY });
    expect(none.comparison).toMatchObject({ ok: false, count: 0, median: null });
  });

  it('has no stretch before for "all", and starts it at the first run that has a value', () => {
    const trend = buildMetricTrend(season(), { metric: 'pace', range: 'all', today: TODAY });
    expect(trend.comparison).toBeNull();
    expect(trend.from).toBe('2025-10-20');
    expect(trend.points).toHaveLength(20);
  });

  it('looks at the runs of a set only', () => {
    const workouts = buildMetricTrend(season(), { metric: 'pace', runSet: 'workout', range: '6m', today: TODAY });
    expect(workouts.points.map((point) => point.id)).toEqual([103, 107, 111]);
    expect(workouts.trend).toMatchObject({ ok: false, reason: 'few' });
    const ordinary = buildMetricTrend(season(), { metric: 'pace', runSet: 'ordinary', range: '6m', today: TODAY });
    expect(ordinary.points).toHaveLength(9);
  });

  it('leaves out the runs that have no value for the metric, and counts them', () => {
    const runs = season().map((r, index) => (index === 2 || index === 5 ? { ...r, averageHeartRate: null } : r));
    const trend = buildMetricTrend(runs, { metric: 'heartRate', range: '6m', today: TODAY });
    expect(trend.points).toHaveLength(10);
    expect(trend.leftOut).toBe(2);
    expect(buildMetricTrend(runs, { metric: 'pace', range: '6m', today: TODAY }).leftOut).toBe(0);
    const efficiency = buildMetricTrend(runs, { metric: 'efficiency', range: '6m', today: TODAY });
    expect(efficiency.points).toHaveLength(10);
  });

  it('draws the moving average when it is the line asked for', () => {
    const trend = buildMetricTrend(season(), { metric: 'pace', line: 'average', range: '6m', today: TODAY });
    expect(trend.line).toBe('average');
    expect(trend.trend.ok).toBe(true);
    expect(trend.trend.path).toHaveLength(8);
    expect(trend.trend.start.value).toBeCloseTo(360 - 2 * 12, 8);
  });

  it('puts two runs of one day side by side by the hour, and leaves out a run after the runner\'s today, one with no date and one with no distance', () => {
    const runs = [
      run(1, '2026-10-10', 5, 25, { startTime: '2026-10-10T18:00:00' }),
      run(2, '2026-10-10', 5, 26, { startTime: '2026-10-10T06:00:00' }),
      run(3, '2026-10-16', 5, 27),
      { id: 4, distanceKm: 5, movingTimeSeconds: 1500 },
      run(5, '2026-10-11', 0, 20),
    ];
    const trend = buildMetricTrend(runs, { metric: 'distance', range: '3m', today: TODAY });
    expect(trend.points.map((point) => point.id)).toEqual([2, 1]);
    expect(trend.points[0].x).toBeCloseTo(trend.points[1].x - 0.5, 10);
  });

  it('has nothing to show with no run, and does not stumble over a list that is not a list', () => {
    for (const input of [[], null, undefined, 'runs', [null, 3]]) {
      const trend = buildMetricTrend(input, { metric: 'pace', range: '6m', today: TODAY });
      expect(trend.points).toEqual([]);
      expect(trend.stats).toBeNull();
      expect(trend.trend).toMatchObject({ ok: false, reason: 'none' });
    }
  });

  describe('the runner\'s today', () => {
    afterEach(() => vi.useRealTimers());

    it('is the device\'s date, or the date of a run that is ahead of it by a day or two, as everywhere else', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 15, 9, 0, 0));
      const runs = [run(1, '2026-10-01', 5, 25), run(2, '2026-10-17', 5, 25)];
      const trend = buildMetricTrend(runs, { metric: 'distance', range: '3m' });
      expect(trend.today).toBe('2026-10-17');
      expect(trend.points.map((point) => point.id)).toEqual([1, 2]);
    });
  });
});
