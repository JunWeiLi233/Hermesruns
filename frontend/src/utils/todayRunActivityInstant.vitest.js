import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getTodayRunRecommendation } from './todayRun.js';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-10T22:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const recommendation = runs => getTodayRunRecommendation({ runs, races: [], t: key => key, lang: 'en', unit: 'km' });
const imported = {
  // The additive DTO field is the source of the instant, even if an old/cache
  // wall timestamp disagrees. This is a helper regression, not mocked acceptance.
  startTime: '2026-09-01T04:05:00', startDate: '2026-09-01T04:05',
  activityInstant: '2026-10-05T04:05:00Z', accountLocalDate: '2026-10-05', accountLocalTime: '00:05:00',
  accountTimeZone: 'America/New_York', timeRepresentation: 'UTC_INSTANT',
  distanceKm: 2, movingTimeSeconds: 780,
};

it('uses the additive import instant for rolling history and last-run age', () => {
  const result = recommendation([imported]);
  expect(result.metrics.recent7Km).toBe(2);
  expect(result.metrics.recent14Km).toBe(2);
  expect(result.metrics.runDays7).toBe(1);
});

it('feeds the same effort snapshot and recovery age as an explicit UTC input', () => {
  const instants = ['2026-10-10T20:00:00Z', '2026-10-04T04:05:00Z', '2026-09-10T16:00:00Z'];
  const additive = instants.map((activityInstant, index) => ({ ...imported, activityInstant, distanceKm: 4 + index, movingTimeSeconds: (4 + index) * 390 }));
  const explicit = additive.map(run => ({ ...run, activityInstant: undefined, accountLocalDate: undefined, accountLocalTime: undefined, startTime: run.activityInstant, startDate: run.activityInstant }));
  const actual = recommendation(additive).metrics;
  const expected = recommendation(explicit).metrics;
  expect(actual.recent7Km).toBe(expected.recent7Km);
  expect(actual.acwr).toBeCloseTo(expected.acwr, 12);
  expect(actual.recoveryHours).toBe(expected.recoveryHours);
});

it('retains legacy offset-free behavior when the backend cannot provide an instant', () => {
  const legacy = { ...imported, startTime: '2026-10-05T04:05:00', activityInstant: null };
  expect(recommendation([legacy]).metrics.recent7Km).toBe(2);
});
