import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTrainingLoad } from './analysisInsights';
import { addDaysToKey } from './calendarDays';

// BUG-043: the series the load figures are made from stopped on this device's date, so a run dated after it (the runner's clock is ahead of
// the device's) was not in the week, the load, the monotony or the strain until the device's own date caught up.
describe('the last day of the load series', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  const run = (startTime, km = 8) => ({ startTime, distanceKm: km, movingTimeSeconds: km * 330, averageHeartRate: 150, maxHeartRate: 180 });
  const days = (lastDay, count = 10) => Array.from({ length: count }, (_, index) => run(`${addDaysToKey(lastDay, -index)}T07:00:00`));

  it('is the device\'s date for a runner whose runs are all on or before it, with the days since the last run as rest days', () => {
    const load = buildTrainingLoad(days('2026-10-12'), 50);
    expect(load.days.at(-1)).toBe('2026-10-14');
    expect(load.dailyLoads.slice(-2)).toEqual([0, 0]);
  });

  it('is the date of a run that is a day ahead of the device\'s, and the run has its load on that day', () => {
    const load = buildTrainingLoad([...days('2026-10-14'), run('2026-10-15T07:00:00', 12)], 50);
    expect(load.days.at(-1)).toBe('2026-10-15');
    expect(load.dailyLoads.at(-1)).toBeGreaterThan(load.dailyLoads.at(-2));
    expect(load.dailyLoads).toHaveLength(load.days.length);
    expect(load.acuteSeries).toHaveLength(load.days.length);
  });

  it('is two days ahead at most', () => {
    expect(buildTrainingLoad([...days('2026-10-14'), run('2026-10-16T01:00:00')], 50).days.at(-1)).toBe('2026-10-16');
    expect(buildTrainingLoad([...days('2026-10-14'), run('2026-10-17T01:00:00')], 50).days.at(-1)).toBe('2026-10-14');
  });

  it('is not moved by a run that has no distance or time: it is not a run of the series', () => {
    const empty = { startTime: '2026-10-15T07:00:00', distanceKm: 0, movingTimeSeconds: 0 };
    expect(buildTrainingLoad([...days('2026-10-14'), empty], 50).days.at(-1)).toBe('2026-10-14');
  });
});
