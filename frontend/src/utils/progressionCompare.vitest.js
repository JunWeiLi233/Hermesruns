import { describe, expect, it } from 'vitest';
import { buildProgressionAtlas, canCompareProgression } from './progressionAtlas';
import { describeProgressionDeltas } from './progressionDeltas';
import translations from '../i18n/translations';

const now = new Date(2026, 9, 10, 12);
const day = (year, month, date, hour = 9) => new Date(year, month, date, hour).toISOString();
const run = (when, km, minutes, climb = 0) => ({ startTime: when, distanceKm: km, movingTimeSeconds: Math.round(minutes * 60), totalElevationGain: climb });

describe('which ranges can be compared', () => {
  it('are the ones that have a stretch of the same length before them', () => {
    expect(['1m', '3m', '6m', '12m'].map(canCompareProgression)).toEqual([true, true, true, true]);
    expect(canCompareProgression('total')).toBe(false);
    expect(canCompareProgression('week')).toBe(false);
    expect(canCompareProgression(undefined)).toBe(false);
  });
});

describe('the stretch before', () => {
  // The last 3 months are 10 July to 10 October 2026; the 3 months before them 10 April to 9 July.
  const runs = [
    run(day(2026, 3, 20), 10, 60, 40),
    run(day(2026, 4, 5), 20, 110, 100),
    run(day(2026, 5, 30), 10, 55, 20),
    run(day(2026, 6, 15), 12, 60, 50),
    run(day(2026, 8, 1), 25, 130, 120),
    run(day(2026, 9, 5), 8, 40, 10),
  ];

  it('is not there unless asked for, or for a range with nothing before it', () => {
    expect(buildProgressionAtlas(runs, '3m', 'en', now).comparison).toBeNull();
    expect(buildProgressionAtlas(runs, '3m', 'en', now, { compare: false }).comparison).toBeNull();
    expect(buildProgressionAtlas(runs, 'total', 'en', now, { compare: true }).comparison).toBeNull();
  });

  it('adds up the same number of months ending the moment before the current ones begin', () => {
    const atlas = buildProgressionAtlas(runs, '3m', 'en', now, { compare: true });

    expect(atlas.totalDistanceKm).toBe(45);          // 12 + 25 + 8
    expect(atlas.comparison.hasData).toBe(true);
    expect(atlas.comparison.totalDistanceKm).toBe(40); // 10 + 20 + 10
    expect(atlas.comparison.sessionCount).toBe(3);
    expect(atlas.comparison.totalMovingSeconds).toBe((60 + 110 + 55) * 60);
    expect(atlas.comparison.totalElevationMeters).toBe(160);
    expect(atlas.comparison.rangeLabel).toBe('Apr 2026 - Jul 2026');
  });

  it('gives the change in every figure, and the change in distance as a percentage', () => {
    const { deltas } = buildProgressionAtlas(runs, '3m', 'en', now, { compare: true }).comparison;

    expect(deltas.distanceKm).toBe(5);
    expect(deltas.distancePercent).toBe(13);          // 5 of 40, rounded
    expect(deltas.sessions).toBe(0);
    expect(deltas.movingSeconds).toBe((60 + 130 + 40) * 60 - (60 + 110 + 55) * 60);
    expect(deltas.elevationMeters).toBe(180 - 160);
    // 230 min over 45 km is 5:07 /km; 225 min over 40 km is 5:37 /km: 30 s a kilometre faster.
    expect(deltas.paceSeconds).toBeLessThan(0);
  });

  it('has no climb change when neither stretch has any climb', () => {
    const { deltas } = buildProgressionAtlas([run(day(2026, 8, 1), 25, 130), run(day(2026, 4, 5), 20, 110)], '3m', 'en', now, { compare: true }).comparison;

    expect(deltas.elevationMeters).toBeNull();
    expect(describeProgressionDeltas({ ...deltas, paceSeconds: null }, { t: (key) => key, lang: 'en', unit: 'km' }).elevation).toBeNull();
  });

  it('has no percentage, and no pace change, when the stretch before is empty', () => {
    const { comparison } = buildProgressionAtlas([run(day(2026, 8, 1), 25, 130)], '3m', 'en', now, { compare: true });

    expect(comparison.hasData).toBe(false);
    expect(comparison.chartSeries).toEqual([]);
    expect(comparison.deltas.distancePercent).toBeNull();
    expect(comparison.deltas.paceSeconds).toBeNull();
    expect(comparison.deltas.distanceKm).toBe(25);
  });

  it('still draws the stretch before when there is nothing in the current one', () => {
    const atlas = buildProgressionAtlas([run(day(2026, 4, 5), 20, 110)], '3m', 'en', now, { compare: true });

    expect(atlas.hasData).toBe(false);
    expect(atlas.comparison.hasData).toBe(true);
    expect(atlas.comparison.chartSeries.length).toBeGreaterThan(10);
    expect(atlas.comparison.deltas.distanceKm).toBe(-20);
    expect(atlas.comparison.deltas.paceSeconds).toBeNull();
  });

  it('lays its running total on the current days: day by day, one scale for both lines', () => {
    const atlas = buildProgressionAtlas(runs, '3m', 'en', now, { compare: true });
    const before = atlas.comparison.chartSeries;

    // Baseline, then a point for each day; it ends on the total of the stretch before and it never goes down.
    expect(before[0]).toMatchObject({ cumulativeDistance: 0, x: 0 });
    expect(before.at(-1).cumulativeDistance).toBe(40);
    expect(before.map((point) => point.cumulativeDistance)).toEqual([...before.map((point) => point.cumulativeDistance)].sort((a, b) => a - b));
    // The x of day n is the x of day n of the current stretch.
    expect(before[1].x).toBe(atlas.chartSeries[1].x);
    expect(before[30].x).toBe(atlas.chartSeries[30].x);
    // One scale: the heights are read against the same ticks.
    expect(atlas.yTicks[0].valueKm).toBeGreaterThanOrEqual(45);
    expect(before.every((point) => point.y >= 0 && point.y <= 210)).toBe(true);
  });

  it('makes the scale fit the longer of the two', () => {
    const big = [run(day(2026, 4, 5), 400, 2000), run(day(2026, 8, 1), 25, 130)];
    const alone = buildProgressionAtlas(big, '3m', 'en', now);
    const compared = buildProgressionAtlas(big, '3m', 'en', now, { compare: true });

    expect(compared.yTicks[0].valueKm).toBeGreaterThan(alone.yTicks[0].valueKm);
    expect(compared.yTicks[0].valueKm).toBeGreaterThanOrEqual(400);
  });

  it('uses the month before for 1 month and the year before for 12', () => {
    const month = buildProgressionAtlas([run(day(2026, 7, 20), 9, 50), run(day(2026, 9, 3), 11, 60)], '1m', 'en', now, { compare: true });
    expect(month.totalDistanceKm).toBe(11);
    expect(month.comparison.totalDistanceKm).toBe(9);

    const year = buildProgressionAtlas([run(day(2025, 5, 1), 30, 170), run(day(2026, 5, 1), 50, 270)], '12m', 'en', now, { compare: true });
    expect(year.totalDistanceKm).toBe(50);
    expect(year.comparison.totalDistanceKm).toBe(30);
  });

  it('leaves the current stretch exactly as it was without the comparison', () => {
    const plain = buildProgressionAtlas(runs, '3m', 'en', now);
    const compared = buildProgressionAtlas(runs, '3m', 'en', now, { compare: true });

    expect(compared.totalDistanceKm).toBe(plain.totalDistanceKm);
    expect(compared.sessionCount).toBe(plain.sessionCount);
    expect(compared.rangeLabel).toBe(plain.rangeLabel);
    expect(compared.chartSeries.map((point) => point.cumulativeDistance)).toEqual(plain.chartSeries.map((point) => point.cumulativeDistance));
  });
});

describe('the change in words', () => {
  const t = (key, params = {}) => Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    key.split('.').reduce((value, part) => value?.[part], translations.en) || key,
  );
  const words = (deltas) => describeProgressionDeltas(deltas, { t, lang: 'en', unit: 'km' });

  it('says more or less with the amount, a percentage for distance, and calls more a good thing', () => {
    const result = words({ distanceKm: 12.4, distancePercent: 8, movingSeconds: -1620, elevationMeters: 120, sessions: 3, paceSeconds: -12 });

    expect(result.distance).toEqual({ text: '12.4 km more (+8%)', tone: 'better' });
    expect(result.time.text).toBe('27:00 less');
    expect(result.time.tone).toBe('worse');
    expect(result.elevation).toEqual({ text: '120 m more', tone: 'better' });
    expect(result.sessions).toEqual({ text: '3 more', tone: 'better' });
    expect(result.pace).toEqual({ text: '0:12 /km faster', tone: 'better' });
  });

  it('calls a slower pace the worse one, whatever the sign of the number', () => {
    expect(words({ distanceKm: 0, movingSeconds: 0, elevationMeters: 0, sessions: 0, paceSeconds: 25 }).pace).toEqual({ text: '0:25 /km slower', tone: 'worse' });
  });

  it('says same as before for a change too small to mean anything', () => {
    const result = words({ distanceKm: 0.02, distancePercent: 0, movingSeconds: 20, elevationMeters: 0.4, sessions: 0, paceSeconds: 0.4 });

    for (const key of ['distance', 'time', 'elevation', 'sessions', 'pace']) {
      expect(result[key]).toEqual({ text: 'Same as before', tone: 'flat' });
    }
  });

  it('has no pace words when there is no pace to compare', () => {
    expect(words({ distanceKm: 4, distancePercent: null, movingSeconds: 0, elevationMeters: 0, sessions: 1, paceSeconds: null }).pace).toBeNull();
    expect(words({ distanceKm: 4, distancePercent: null, movingSeconds: 0, elevationMeters: 0, sessions: 1, paceSeconds: null }).distance.text).toBe('4.0 km more');
  });

  it('writes distance in miles for a runner who counts in miles', () => {
    const result = describeProgressionDeltas({ distanceKm: 16.09344, distancePercent: 20, movingSeconds: 0, elevationMeters: 0, sessions: 0, paceSeconds: null }, { t, lang: 'en', unit: 'mile' });

    expect(result.distance.text).toBe('10.0 mi more (+20%)');
  });
});
