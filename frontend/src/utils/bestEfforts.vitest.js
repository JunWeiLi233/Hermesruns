import { describe, expect, it } from 'vitest';
import {
  buildYearTrend,
  effortTimeForEditing,
  formatCalendarDate,
  formatEffortTime,
  isPlausibleEffortTime,
  MAX_TYPED_SPEED_MPS,
  MIN_TYPED_SPEED_MPS,
  paceFromEffort,
  parseEffortTime,
} from './bestEfforts';

describe('parseEffortTime', () => {
  it.each([
    ['21:30', 1290],
    ['0:59', 59],
    ['1:05:12', 3912],
    ['  21:30  ', 1290],
    ['75:00', 4500],
    ['21:5', 1265],
    ['01:05:12', 3912],
    ['100:00:00', 360000],
  ])('reads %s as %d seconds', (text, seconds) => {
    expect(parseEffortTime(text)).toBe(seconds);
  });

  it.each([
    ['21'], ['1290'], [''], ['   '], ['abc'], ['21:60'], ['1:75:00'], ['1:05:60'], ['-21:30'], ['21:30.5'], ['21.5:30'],
    ['1:2:3:4'], ['0:00'], ['00:00:00'], [':30'], ['21:'], [null], [undefined], [1290],
  ])('refuses %s instead of guessing what it meant', (text) => {
    expect(parseEffortTime(text)).toBeNull();
  });
});

describe('isPlausibleEffortTime', () => {
  it('uses the same limits as the server: 10 m/s and a 30:00 per km pace', () => {
    expect(MAX_TYPED_SPEED_MPS).toBe(10);
    expect(MIN_TYPED_SPEED_MPS).toBeCloseTo(1000 / 1800, 12);
  });

  it('accepts a time between 1:40 per km and 30:00 per km, edges included', () => {
    expect(isPlausibleEffortTime(500, 5000)).toBe(true);
    expect(isPlausibleEffortTime(9000, 5000)).toBe(true);
    expect(isPlausibleEffortTime(1500, 5000)).toBe(true);
  });

  it('refuses a faster or a slower one', () => {
    expect(isPlausibleEffortTime(499, 5000)).toBe(false);
    expect(isPlausibleEffortTime(9001, 5000)).toBe(false);
  });

  it('refuses nonsense', () => {
    expect(isPlausibleEffortTime(0, 5000)).toBe(false);
    expect(isPlausibleEffortTime(-5, 5000)).toBe(false);
    expect(isPlausibleEffortTime(1500, 0)).toBe(false);
    expect(isPlausibleEffortTime(Number.NaN, 5000)).toBe(false);
  });
});

describe('time and pace text', () => {
  it('writes a time to the nearest second as m:ss or h:mm:ss', () => {
    expect(formatEffortTime(1290.4)).toBe('21:30');
    expect(formatEffortTime(1290.5)).toBe('21:31');
    expect(formatEffortTime(3912)).toBe('1:05:12');
    expect(formatEffortTime(59)).toBe('0:59');
  });

  it('starts the editor from what is on screen, in the shape that can be typed back', () => {
    for (const seconds of [59, 1290.4, 3912, 4500]) {
      expect(parseEffortTime(effortTimeForEditing(seconds))).toBe(Math.round(seconds));
    }
  });

  it('works out a pace per kilometre', () => {
    expect(paceFromEffort(1500, 5000)).toBe(300);
    expect(paceFromEffort(0, 5000)).toBeNull();
    expect(paceFromEffort(1500, 0)).toBeNull();
  });
});

describe('formatCalendarDate', () => {
  it('writes the day it is given, not the day before, whatever the time zone of the reader', () => {
    // The day is read at noon of the reader's clock, so no zone from UTC-11 to UTC+13 can move it.
    expect(formatCalendarDate('2026-10-03', 'en')).toBe('Oct 3, 2026');
    expect(formatCalendarDate('2026-01-01', 'en')).toBe('Jan 1, 2026');
    expect(formatCalendarDate('2026-12-31', 'en')).toBe('Dec 31, 2026');
  });

  it('writes it in the language of the page', () => {
    expect(formatCalendarDate('2026-10-03', 'zh-CN')).toContain('2026');
    expect(formatCalendarDate('2026-10-03', 'zh-CN')).toContain('3');
    expect(formatCalendarDate('2026-10-03', 'zh-CN')).not.toBe(formatCalendarDate('2026-10-03', 'en'));
  });

  it('answers a dash for anything that is not a day', () => {
    for (const value of [null, undefined, '', 'yesterday', 20261003]) {
      expect(formatCalendarDate(value, 'en')).toBe('--');
    }
  });

  it('answers a dash for a month or a day that does not exist instead of rolling over into the next', () => {
    for (const value of ['2026-13-05', '2026-00-10', '2026-02-30', '2026-04-31', '2026-05-00', '2026-06-32', '2026-13-40']) {
      expect(formatCalendarDate(value, 'en'), value).toBe('--');
    }
    expect(formatCalendarDate('2024-02-29', 'en')).toBe('Feb 29, 2024');
    expect(formatCalendarDate('2026-02-28', 'en')).toBe('Feb 28, 2026');
  });

  it('takes the day of a date and time too, as the server sends a start time', () => {
    expect(formatCalendarDate('2026-10-03T23:59:00', 'en')).toBe('Oct 3, 2026');
  });
});

describe('buildYearTrend', () => {
  const trend = [
    { year: 2024, bestSeconds: 1500, count: 12 },
    { year: 2025, bestSeconds: 1440, count: 20 },
    { year: 2026, bestSeconds: 1470, count: 7 },
  ];

  it('is nothing for no years, or years without a usable time', () => {
    expect(buildYearTrend([])).toBeNull();
    expect(buildYearTrend(null)).toBeNull();
    expect(buildYearTrend([{ year: 2025, bestSeconds: 0, count: 1 }, { year: 2026, bestSeconds: null, count: 1 }])).toBeNull();
  });

  it('spaces the years evenly, the first and the last a little in from the edges of the plot', () => {
    const chart = buildYearTrend(trend);
    expect(chart.points.map((point) => point.year)).toEqual([2024, 2025, 2026]);
    expect(chart.points[0].x).toBe(chart.left + 28);
    expect(chart.points[2].x).toBe(chart.width - chart.right - 28);
    expect(chart.points[1].x).toBeCloseTo((chart.points[0].x + chart.points[2].x) / 2, 6);
    expect(buildYearTrend(trend, { inset: 0 }).points[0].x).toBe(chart.left);
  });

  it('puts the faster time nearer the top, and keeps every dot inside the plot', () => {
    const chart = buildYearTrend(trend);
    const [a, b, c] = chart.points;
    expect(b.y).toBeLessThan(c.y);
    expect(c.y).toBeLessThan(a.y);
    for (const point of chart.points) {
      expect(point.y).toBeGreaterThanOrEqual(chart.top);
      expect(point.y).toBeLessThanOrEqual(chart.height - chart.bottom);
    }
  });

  it('labels the fastest and the slowest time and draws one line through the dots', () => {
    const chart = buildYearTrend(trend);
    expect(chart.ticks.map((tick) => tick.seconds)).toEqual([1440, 1500]);
    expect(chart.path.startsWith('M')).toBe(true);
    expect(chart.path.match(/L/g)).toHaveLength(2);
  });

  it('centres a single year and labels one time', () => {
    const chart = buildYearTrend([{ year: 2026, bestSeconds: 1470, count: 3 }]);
    expect(chart.points).toHaveLength(1);
    expect(chart.points[0].x).toBeCloseTo((chart.left + chart.width - chart.right) / 2, 6);
    expect(chart.ticks).toHaveLength(1);
    expect(Number.isFinite(chart.points[0].y)).toBe(true);
  });

  it('copes with every year having the same time', () => {
    const chart = buildYearTrend([{ year: 2025, bestSeconds: 1470, count: 3 }, { year: 2026, bestSeconds: 1470, count: 4 }]);
    expect(chart.points[0].y).toBe(chart.points[1].y);
    expect(chart.ticks).toHaveLength(1);
    expect(Number.isFinite(chart.points[0].y)).toBe(true);
  });
});
