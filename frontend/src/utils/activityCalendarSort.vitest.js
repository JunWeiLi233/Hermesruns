import { expect, it } from 'vitest';
import { activityCalendarSortTime as activitySortTime } from './timeZone';

it('orders mixed imported instants and unknown Strava times on the displayed account calendar', () => {
  const imported = { id: 'file', activityInstant: '2026-10-10T03:55:00Z', accountLocalDate: '2026-10-09', accountLocalTime: '23:55', accountTimeZone: 'America/New_York', timeRepresentation: 'UTC_INSTANT' };
  const strava = { id: 'strava', startTime: '2026-10-10T00:05:00', activityInstant: null, accountLocalDate: '2026-10-10', accountLocalTime: '00:05', accountTimeZone: 'America/New_York', timeRepresentation: 'STRAVA_LOCAL_WALL_TIME' };
  expect([imported, strava].sort((a, b) => activitySortTime(b) - activitySortTime(a)).map(a => a.id)).toEqual(['strava', 'file']);
  expect(strava.activityInstant).toBeNull();
});

it('uses the account calendar for imported rows, including cached rows', () => {
  const imported = { activityInstant: '2026-10-10T03:55:00Z', accountLocalDate: '2026-10-09', accountLocalTime: '23:55', accountTimeZone: 'America/New_York' };
  expect(activitySortTime(imported)).toBe(Date.UTC(2026, 9, 9, 23, 55));
  const later = { ...imported, activityInstant: '2026-10-10T04:05:00Z', accountLocalDate: '2026-10-10', accountLocalTime: '00:05' };
  expect(activitySortTime(later)).toBeGreaterThan(activitySortTime(imported));
});

it('preserves offset-free legacy wall clocks and invalid-date behavior', () => {
  const wall = { startTime: '2026-10-10T00:05:00', activityInstant: null };
  expect(activitySortTime(wall)).toBe(Date.UTC(2026, 9, 10, 0, 5));
  expect(Number.isNaN(activitySortTime({}))).toBe(true);
});

it('keeps instant-only and same-calendar UTC fixtures chronologically ordered', () => {
  const before = { activityInstant: '2026-10-10T03:55:00Z' };
  const after = { activityInstant: '2026-10-10T04:05:00Z' };
  expect(activitySortTime(after)).toBeGreaterThan(activitySortTime(before));
  expect(activitySortTime(before)).toBe(Date.parse(before.activityInstant));
});
