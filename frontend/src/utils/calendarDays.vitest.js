import { describe, expect, it } from 'vitest';
import { addDaysToKey, isWithinLastDays, localDayKey, runDayKey, runIsWithinLastDays, todayKey } from './calendarDays';

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
