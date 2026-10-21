import { describe, expect, it } from 'vitest';
import { LONG_RUN_SHARE, WINDOW_DAYS, WINDOW_WEEKS, buildEnduranceCheck } from './enduranceCheck';

const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const run = (id, km, daysAgo, extra = {}) => ({ id, name: `Run ${id}`, distanceKm: km, startTime: new Date(NOW - daysAgo * DAY).toISOString(), ...extra });

const MARATHON = 42195;
const HALF = 21097.5;
const TEN_K = 10000;

describe('the rule', () => {
  it('is the longest run of the last eight weeks reaching three quarters of the distance', () => {
    expect(WINDOW_WEEKS).toBe(8);
    expect(WINDOW_DAYS).toBe(56);
    expect(LONG_RUN_SHARE).toBe(0.75);
  });
});

describe('buildEnduranceCheck', () => {
  it('has nothing to check without a distance', () => {
    expect(buildEnduranceCheck([run(1, 10, 3)], 0, { now: NOW })).toBeNull();
    expect(buildEnduranceCheck([run(1, 10, 3)], undefined, { now: NOW })).toBeNull();
    expect(buildEnduranceCheck([run(1, 10, 3)], -5, { now: NOW })).toBeNull();
  });

  it('says there is no long run to check when no run is in the window, or none can be read', () => {
    const none = buildEnduranceCheck([run(1, 21, 90)], HALF, { now: NOW });

    expect(none.state).toBe('none');
    expect(none.longest).toBeNull();
    expect(none.runCount).toBe(0);
    expect(none.weeklyKm).toBe(0);
    expect(buildEnduranceCheck([], HALF, { now: NOW }).state).toBe('none');
    expect(buildEnduranceCheck(null, HALF, { now: NOW }).state).toBe('none');
    expect(buildEnduranceCheck([null, undefined, 4, { distanceKm: 0, startTime: new Date(NOW).toISOString() }, { distanceKm: 'far', startTime: new Date(NOW).toISOString() }, { distanceKm: 12, startTime: 'never' }], HALF, { now: NOW }).state).toBe('none');
  });

  it('finds the longest run of the window, the distance and the distance the rule asks for', () => {
    const check = buildEnduranceCheck([run(1, 8, 3), run(2, 14.2, 20), run(3, 10, 30)], MARATHON, { now: NOW });

    expect(check.longest).toMatchObject({ id: 2, name: 'Run 2', km: 14.2 });
    expect(check.longest.date.toISOString()).toBe(new Date(NOW - 20 * DAY).toISOString());
    expect(check.raceKm).toBeCloseTo(42.195, 9);
    expect(check.thresholdKm).toBeCloseTo(31.64625, 9);
    expect(check.runCount).toBe(3);
    expect(check.weeks).toBe(8);
  });

  it('is short while the longest run is under three quarters of the distance, and enough once it reaches it', () => {
    expect(buildEnduranceCheck([run(1, 31.0, 5)], MARATHON, { now: NOW }).state).toBe('short');
    expect(buildEnduranceCheck([run(1, 32.0, 5)], MARATHON, { now: NOW }).state).toBe('enough');
    expect(buildEnduranceCheck([run(1, 15.0, 5)], HALF, { now: NOW }).state).toBe('short');
    expect(buildEnduranceCheck([run(1, 16.0, 5)], HALF, { now: NOW }).state).toBe('enough');
    expect(buildEnduranceCheck([run(1, 7.4, 5)], TEN_K, { now: NOW }).state).toBe('short');
    expect(buildEnduranceCheck([run(1, 7.5, 5)], TEN_K, { now: NOW }).state).toBe('enough');
  });

  it('compares the distances as they are shown, to one decimal, so the text never contradicts the verdict', () => {
    // The threshold for a marathon is 31.646 km, shown as 31.6: a run shown as 31.6 reaches it, one shown as 31.5 does not.
    expect(buildEnduranceCheck([run(1, 31.6, 5)], MARATHON, { now: NOW }).state).toBe('enough');
    expect(buildEnduranceCheck([run(1, 31.54, 5)], MARATHON, { now: NOW }).state).toBe('short');
  });

  it('takes the verdict from the figures in the unit the runner reads', () => {
    const near = [run(1, 31.62, 5)];

    expect(buildEnduranceCheck(near, MARATHON, { now: NOW, unit: 'km' }).state).toBe('enough');
    // 31.62 km is 19.6 mi and the threshold is 19.7 mi.
    expect(buildEnduranceCheck(near, MARATHON, { now: NOW, unit: 'mile' }).state).toBe('short');
  });

  it('looks back eight weeks, to the day, and no further', () => {
    const inside = buildEnduranceCheck([run(1, 30, 56)], MARATHON, { now: NOW });
    const outside = buildEnduranceCheck([run(1, 30, 56.5)], MARATHON, { now: NOW });

    expect(inside.runCount).toBe(1);
    expect(outside.state).toBe('none');
  });

  it('gives the distance run in an average week of the window', () => {
    const check = buildEnduranceCheck([run(1, 10, 3), run(2, 22, 10), run(3, 32, 40)], MARATHON, { now: NOW });

    expect(check.weeklyKm).toBeCloseTo(64 / 8, 9);
    expect(check.runCount).toBe(3);
  });

  it('keeps the first of two equally long runs, and reads a run dated by startDate', () => {
    const check = buildEnduranceCheck([
      { id: 5, name: 'Dated otherwise', distanceKm: 20, startDate: new Date(NOW - 4 * DAY).toISOString() },
      run(6, 20, 2),
    ], HALF, { now: NOW });

    expect(check.longest.id).toBe(5);
    expect(check.runCount).toBe(2);
  });

  it('gives a run with no name an empty one and no id a null', () => {
    const check = buildEnduranceCheck([{ distanceKm: 12, startTime: new Date(NOW - DAY).toISOString() }], TEN_K, { now: NOW });

    expect(check.longest.id).toBeNull();
    expect(check.longest.name).toBe('');
    expect(check.state).toBe('enough');
  });
});
