import { describe, expect, it } from 'vitest';
import { addDaysToKey, addMonthsToKey, dayNumber, isWithinLastDays, localDayKey, runDayFraction, runDayKey, runIsWithinLastDays, runnersToday, todayKey } from './calendarDays';

describe('runDayKey', () => {
  it('reads the date off a wall-clock start as it is, whatever the hour', () => {
    expect(runDayKey({ startTime: '2026-10-07T23:30:00' })).toBe('2026-10-07');
    expect(runDayKey({ startTime: '2026-10-08T00:05:00' })).toBe('2026-10-08');
    expect(runDayKey({ startTime: '2026-10-07T23:30' })).toBe('2026-10-07');
    expect(runDayKey({ startTime: '2026-10-07' })).toBe('2026-10-07');
  });

  it('falls back to the start date text when there is no start time', () => {
    expect(runDayKey({ startDate: '2026-10-07T23:30:00' })).toBe('2026-10-07');
  });

  it('turns an instant that names its zone into the date it has on this device', () => {
    const instant = new Date(2026, 9, 7, 23, 30).toISOString();
    expect(runDayKey({ startTime: instant })).toBe('2026-10-07');
  });

  it('is null for a run with no date, or one that is not a date', () => {
    expect(runDayKey({})).toBeNull();
    expect(runDayKey({ startTime: null, startDate: '' })).toBeNull();
    expect(runDayKey({ startTime: 'sometime last week' })).toBeNull();
    expect(runDayKey({ startTime: '2026-13-45T10:00:00' })).toBeNull();
    expect(runDayKey(null)).toBeNull();
  });
});

describe('the last seven calendar days', () => {
  const today = '2026-10-10';

  it('are today and the six days before it', () => {
    expect(isWithinLastDays('2026-10-10', 7, today)).toBe(true);
    expect(isWithinLastDays('2026-10-04', 7, today)).toBe(true);
    expect(isWithinLastDays('2026-10-03', 7, today)).toBe(false);
    expect(isWithinLastDays('2026-10-11', 7, today)).toBe(false);
  });

  it('do not depend on the hour of the run or of the moment of looking', () => {
    // 3 October at 9:25 and 11:00 are "inside now minus seven days" at 09:00 on the 10th by the clock, and outside by the calendar.
    expect(runIsWithinLastDays({ startTime: '2026-10-03T09:25:00' }, 7, today)).toBe(false);
    expect(runIsWithinLastDays({ startTime: '2026-10-03T11:00:00' }, 7, today)).toBe(false);
    expect(runIsWithinLastDays({ startTime: '2026-10-04T00:01:00' }, 7, today)).toBe(true);
  });

  it('leave out a run with no date', () => {
    expect(runIsWithinLastDays({ distanceKm: 4 }, 7, today)).toBe(false);
  });

  it('count the 28 days the same way', () => {
    expect(isWithinLastDays('2026-09-13', 28, today)).toBe(true);
    expect(isWithinLastDays('2026-09-12', 28, today)).toBe(false);
  });
});

describe('addDaysToKey', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDaysToKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDaysToKey('2026-10-10', -6)).toBe('2026-10-04');
  });
});

describe('todayKey', () => {
  it('is the date on this device', () => {
    const now = new Date(2026, 9, 10, 23, 59);
    expect(todayKey(now)).toBe('2026-10-10');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

// BUG-043: a run's date is the clock on the runner's wall, and that clock can be a day ahead of this device's (the zone in Settings is
// east of the device's, or a file's UTC time was moved into it), so a run from this evening was left out of the week until the device's
// own date caught up.
describe('runnersToday', () => {
  const now = new Date(2026, 9, 14, 15, 0);

  it('is the date on this device when no run is ahead of it', () => {
    expect(runnersToday([], now)).toBe('2026-10-14');
    expect(runnersToday([{ startTime: '2026-10-14T07:00:00' }, { startTime: '2026-10-09T18:00:00' }], now)).toBe('2026-10-14');
  });

  it('is the date of a run that is ahead of it: a run is never from the future, so the runner\'s clock is ahead of the device\'s', () => {
    expect(runnersToday([{ startTime: '2026-10-15T07:00:00' }, { startTime: '2026-10-14T13:00:00' }], now)).toBe('2026-10-15');
    expect(runnersToday([{ startDate: '2026-10-15T00:10:00' }], now)).toBe('2026-10-15');
  });

  it('follows the latest of the runs that are ahead, up to the two days that the zones of the world can be apart', () => {
    expect(runnersToday([{ startTime: '2026-10-15T07:00:00' }, { startTime: '2026-10-16T01:00:00' }], now)).toBe('2026-10-16');
  });

  it('does not follow a date that no two zones can be apart (a watch with the wrong clock)', () => {
    expect(runnersToday([{ startTime: '2026-10-17T07:00:00' }], now)).toBe('2026-10-14');
    expect(runnersToday([{ startTime: '2031-01-01T07:00:00' }, { startTime: '2026-10-15T07:00:00' }], now)).toBe('2026-10-15');
  });

  it('passes over a run with no date, a date that is not one, and a list that is not there', () => {
    expect(runnersToday([{}, { startTime: 'sometime tomorrow' }, null, { startTime: '2026-10-15T07:00:00' }], now)).toBe('2026-10-15');
    expect(runnersToday(null, now)).toBe('2026-10-14');
    expect(runnersToday(undefined, now)).toBe('2026-10-14');
  });

  it('crosses a month and a year the way the calendar does', () => {
    expect(runnersToday([{ startTime: '2027-01-01T00:30:00' }], new Date(2026, 11, 31, 22, 0))).toBe('2027-01-01');
    expect(runnersToday([{ startTime: '2026-11-01T00:30:00' }], new Date(2026, 9, 31, 22, 0))).toBe('2026-11-01');
  });
});

describe('addMonthsToKey', () => {
  it('moves to the same day of the month, forwards and backwards', () => {
    expect(addMonthsToKey('2026-10-15', -3)).toBe('2026-07-15');
    expect(addMonthsToKey('2026-10-15', -12)).toBe('2025-10-15');
    expect(addMonthsToKey('2026-10-15', 0)).toBe('2026-10-15');
    expect(addMonthsToKey('2026-01-15', -2)).toBe('2025-11-15');
    expect(addMonthsToKey('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('lands on the last day of a month that is too short for the day', () => {
    expect(addMonthsToKey('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonthsToKey('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonthsToKey('2026-05-31', -1)).toBe('2026-04-30');
    expect(addMonthsToKey('2026-12-31', 2)).toBe('2027-02-28');
  });
});

describe('dayNumber', () => {
  it('counts whole days from 1 January 1970', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('2026-10-15') - dayNumber('2026-07-15')).toBe(92);
  });

  it('is one step a day across the days the clocks change', () => {
    expect(dayNumber('2026-03-09') - dayNumber('2026-03-08')).toBe(1);
    expect(dayNumber('2026-11-02') - dayNumber('2026-11-01')).toBe(1);
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-28')).toBe(2);
  });
});

describe('runDayFraction', () => {
  it('is how far into its day a wall-clock start is', () => {
    expect(runDayFraction({ startTime: '2026-10-07T06:00:00' })).toBeCloseTo(0.25, 10);
    expect(runDayFraction({ startTime: '2026-10-07T12:00' })).toBeCloseTo(0.5, 10);
    expect(runDayFraction({ startTime: '2026-10-07 18:30:30' })).toBeCloseTo((18 * 3600 + 30 * 60 + 30) / 86400, 10);
    expect(runDayFraction({ startTime: '2026-10-07T00:00:00' })).toBe(0);
  });

  it('stays under one, even for the last second of the day', () => {
    const last = runDayFraction({ startTime: '2026-10-07T23:59:59' });
    expect(last).toBeLessThan(1);
    expect(last).toBeGreaterThan(0.999);
  });

  it('is 0 for a run with only a date, or with no usable date', () => {
    expect(runDayFraction({ startTime: '2026-10-07' })).toBe(0);
    expect(runDayFraction({ startDate: '2026-10-07' })).toBe(0);
    expect(runDayFraction({})).toBe(0);
    expect(runDayFraction(null)).toBe(0);
    expect(runDayFraction({ startTime: 'sometime last week' })).toBe(0);
  });

  it('reads an instant that names its zone as the hour it has on this device, the same device whose date runDayKey gives', () => {
    const instant = new Date(2026, 9, 7, 6, 0, 0).toISOString();
    expect(runDayFraction({ startTime: instant })).toBeCloseTo(0.25, 10);
    expect(runDayKey({ startTime: instant })).toBe('2026-10-07');
  });
});
