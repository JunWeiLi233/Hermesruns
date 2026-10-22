// @vitest-environment node
import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTodayRunRecommendation } from './todayRun.js';

const zones = ['UTC', 'Asia/Tokyo', 'America/New_York'];
const originalZone = process.env.TZ;
const fixedNow = '2026-10-10T22:10:00Z';
const dayMs = 86400000;
const run = (activityInstant, distanceKm = 5) => ({
  startTime: activityInstant.slice(0, -1), activityInstant,
  distanceKm, movingTimeSeconds: distanceKm * 390, timeRepresentation: 'UTC_INSTANT',
});
const recommend = (runs, extras = {}) => getTodayRunRecommendation({
  runs, races: [], t: key => key, lang: 'en', unit: 'km', timeZone: 'America/New_York', ...extras,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(fixedNow));
});
afterEach(() => {
  vi.useRealTimers();
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

function useBrowserZone(zone) {
  process.env.TZ = zone;
  // This test must genuinely exercise separate native Date calendars, not labels.
  expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
}

function expectedEwmaRatio(loads, startKey, endKey) {
  const cursor = new Date(startKey + 'T00:00:00Z');
  const end = new Date(endKey + 'T00:00:00Z');
  let acute = loads[startKey] || 0;
  let chronic = acute;
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  for (; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const load = loads[cursor.toISOString().slice(0, 10)] || 0;
    acute = load * (2 / 8) + acute * (1 - 2 / 8);
    chronic = load * (2 / 29) + chronic * (1 - 2 / 29);
  }
  return acute / chronic;
}

describe.each(zones)('account calendar in %s browser zone', zone => {
  it('uses NY day buckets with the existing acute/chronic EWMA weights', () => {
    useBrowserZone(zone);
    const runs = ['2026-09-04T16:00:00Z', '2026-09-06T16:00:00Z', '2026-09-08T16:00:00Z', '2026-09-10T16:00:00Z', '2026-10-05T03:55:00Z', '2026-10-05T04:05:00Z'].map(value => run(value));
    const actual = recommend(runs).metrics;
    // Equal pace/duration gives equal scores. Ratio is scale-invariant; no new
    // physiological assumption is introduced by this independent calendar oracle.
    const loads = Object.fromEntries(['2026-09-04', '2026-09-06', '2026-09-08', '2026-09-10', '2026-10-04', '2026-10-05'].map(key => [key, 100]));
    expect(actual.acwr).toBeCloseTo(expectedEwmaRatio(loads, '2026-09-04', '2026-10-10'), 12);
    expect(actual.recent7Km).toBe(10);
  });

  it('counts the actual NY midnight pair as two account days without losing elapsed km', () => {
    useBrowserZone(zone);
    const result = recommend([run('2026-10-05T03:55:00Z', 1), run('2026-10-05T04:05:00Z', 2)]).metrics;
    expect(result.runDays7).toBe(2);
    expect(result.recent7Km).toBe(3);
    expect(result.recent14Km).toBe(3);
  });

  it('does not mutate now during race filtering or round elapsed7/14day cutoffs to midnight', () => {
    useBrowserZone(zone);
    const now = Date.now();
    const ageRun = (days, hours, km) => run(new Date(now - days * dayMs - hours * 3600000).toISOString(), km);
    const runs = [ageRun(6, 23, 2), ageRun(7, 1, 7), ageRun(13, 23, 3), ageRun(14, 1, 14)];
    const result = recommend(runs, { races: [{ eventDate: '2026-11-01', registrationStatus: 'REGISTERED' }] }).metrics;
    expect(result.recent7Km).toBe(2);
    expect(result.recent14Km).toBe(12);
    expect(result.runDays7).toBe(1);
  });

  it('does not let a race listing replace the shared coach prescription', () => {
    useBrowserZone(zone);
    const active = { name: 'Synthetic race', eventDate: '2026-10-10', registrationStatus: 'REGISTERED', distanceKm: 10 };
    expect(recommend([], { races: [active] }).recommendation.source).toBe('unavailable');
    expect(recommend([], { races: [{ ...active, registrationStatus: 'CANCELED' }, { ...active, eventDate: '2026-10-12' }] }).recommendation.distance).toBe('—');
  });

  it('keeps unknown Strava wall dates without manufacturing an instant', () => {
    useBrowserZone(zone);
    const wallRuns = [
      { startTime: '2026-10-05T23:55:00', accountLocalDate: '2026-10-05', distanceKm: 1, movingTimeSeconds: 390 },
      { startTime: '2026-10-06T00:05:00', accountLocalDate: '2026-10-06', distanceKm: 2, movingTimeSeconds: 780 },
    ].map(value => ({ ...value, activityInstant: null, timeRepresentation: 'STRAVA_LOCAL_WALL_TIME' }));
    const before = JSON.stringify(wallRuns);
    expect(recommend(wallRuns).metrics.runDays7).toBe(2);
    expect(JSON.stringify(wallRuns)).toBe(before);
  });

  it.each([
    ['spring', '2026-03-09T10:00:00Z', ['2026-03-08T06:55:00Z', '2026-03-08T07:05:00Z'], '2026-03-01', '2026-03-08', '2026-03-09'],
    ['fall', '2026-11-02T10:00:00Z', ['2026-11-01T05:55:00Z', '2026-11-01T06:05:00Z'], '2026-10-25', '2026-11-01', '2026-11-02'],
  ])('iterates one calendar coordinate per day through NY%s DST', (_label, now, pair, firstKey, pairKey, todayKey) => {
    useBrowserZone(zone);
    vi.setSystemTime(new Date(now));
    const runs = [run(firstKey + 'T16:00:00Z'), ...pair.map(value => run(value))];
    const result = recommend(runs).metrics;
    expect(result.acwr).toBeCloseTo(expectedEwmaRatio({ [firstKey]: 100, [pairKey]: 200 }, firstKey, todayKey), 12);
    expect(result.runDays7).toBe(1);
  });
});

it.each([undefined, null, '', 'invalid/zone'])('uses UTC fallback for optional/invalid account zone %s', timeZone => {
  const runs = [
    { ...run('2026-10-05T03:55:00Z', 1), accountLocalDate: '2026-10-04' },
    { ...run('2026-10-05T04:05:00Z', 2), accountLocalDate: '2026-10-05' },
  ];
  expect(recommend(runs, { timeZone }).metrics.runDays7).toBe(1);
});
