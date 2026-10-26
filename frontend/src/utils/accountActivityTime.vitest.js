import { expect, it } from 'vitest';
import * as time from './timeZone';
import { buildRunActivityCalendar } from './runActivityContribution';
import { slimRunForRunsCache } from '../pages/runs/runsCache';
import { calculateStreaks } from './streakUtils';
import { buildProgressionAtlas } from './progressionAtlas';

it('keeps date-only calendar arithmetic independent of browser zone and DST', () => {
  expect(typeof time.accountWeekStart).toBe('function');
  expect(time.accountWeekStart('2026-10-11')).toBe('2026-10-05');
  expect(time.accountWeekStart('2027-01-01')).toBe('2026-12-28');
  expect(time.addCalendarDays('2026-03-08', 1)).toBe('2026-03-09');
  expect(time.addCalendarDays('2025-11-02', 1)).toBe('2025-11-03');
});

it('uses account time from UTC instants and never reinterprets Strava wall clocks', () => {
  expect(typeof time.getActivityDateKey).toBe('function');
  const file = { activityInstant: '2026-10-05T03:55:00Z' };
  expect(time.getActivityDateKey(file, 'America/New_York')).toBe('2026-10-04');
  expect(time.getActivityDateKey(file, 'Asia/Tokyo')).toBe('2026-10-05');
  const wall = { startTime: '2026-10-05T03:55:00', accountLocalDate: '2026-10-05', accountLocalTime: '03:55:00', timeRepresentation: 'STRAVA_LOCAL_WALL_TIME', activityInstant: null };
  expect(time.getActivityDateKey(wall, 'America/New_York')).toBe('2026-10-05');
  expect(time.formatActivityTime(wall, 'en-US', { hour: 'numeric', minute: '2-digit' })).toBe('3:55 AM');
});

it('puts imported NY evening activity in the Oct4 contribution cell', () => {
  const calendar = buildRunActivityCalendar([{ startTime: '2026-10-05T03:55:00', accountLocalDate: '2026-10-04', accountLocalTime: '23:55:00', distanceKm: 1 }], { now: new Date('2026-10-10T12:00:00'), weeks: 2 });
  const days = calendar.weeks.flatMap(w => w.days);
  expect(days.find(d => d.key === '2026-10-04').distanceKm).toBe(1);
  expect(days.find(d => d.key === '2026-10-05').count).toBe(0);
});

it('retains explicit time semantics through the Runs first-paint cache', () => {
  const fields = { activityInstant: '2026-10-05T03:55:00Z', accountLocalDate: '2026-10-04', accountLocalTime: '23:55:00', accountTimeZone: 'America/New_York', timeRepresentation: 'UTC_INSTANT' };
  expect(slimRunForRunsCache(fields)).toMatchObject(fields);
});

it('keeps two account days separate in profile streaks across midnight', () => {
  const runs = [
    { startTime: '2026-10-05T03:55:00', accountLocalDate: '2026-10-04', accountLocalTime: '23:55:00' },
    { startTime: '2026-10-05T04:05:00', accountLocalDate: '2026-10-05', accountLocalTime: '00:05:00' },
  ];
  expect(calculateStreaks(runs).best).toBe(2);
});

it('keeps profile progression week totals on the account calendar', () => {
  const runs = [
    { startTime: '2026-10-05T03:55:00', accountLocalDate: '2026-10-04', distanceKm: 1 },
    { startTime: '2026-10-05T04:05:00', accountLocalDate: '2026-10-05', distanceKm: 2 },
  ];
  const atlas = buildProgressionAtlas(runs, 'week', 'en', new Date('2026-10-10T12:00:00'));
  expect(atlas.totalDistanceKm).toBe(2);
});
