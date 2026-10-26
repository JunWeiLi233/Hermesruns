import { describe, expect, it } from 'vitest';
import { STRAIN_DAYS, trainingStrain, weekStrain } from './trainingStrain';

// The worked example of the methods doc ("Monotony and training strain"): two hard days, a middle one, three rest days.
const EXAMPLE = [0, 100, 50, 0, 150, 75, 0];

describe('weekStrain', () => {
  it('is the load of the week times its monotony, with the monotony the mean day over the spread of the days', () => {
    const week = weekStrain(EXAMPLE);

    expect(STRAIN_DAYS).toBe(7);
    expect(week.load).toBe(375);
    expect(week.mean).toBeCloseTo(53.5714, 4);
    expect(week.spread).toBeCloseTo(54.1634, 4);
    expect(week.monotony).toBeCloseTo(0.98907, 5);
    expect(week.strain).toBeCloseTo(370.9015, 4);
    // Strain written the long way round (seven times the mean squared, over the spread) is the same number.
    expect(week.strain).toBeCloseTo((7 * week.mean ** 2) / week.spread, 9);
  });

  it('takes the spread over seven days and not six, the way the Monotony card always has', () => {
    const loads = [10, 20, 30, 40, 50, 60, 70];
    const mean = 40;
    const populationSpread = Math.sqrt(((30 ** 2) * 2 + (20 ** 2) * 2 + (10 ** 2) * 2) / 7);

    expect(weekStrain(loads).spread).toBeCloseTo(populationSpread, 12);
    expect(weekStrain(loads).monotony).toBeCloseTo(mean / populationSpread, 12);
  });

  it('is a higher strain for the same total load when it is spread evenly: a monotonous week costs more', () => {
    const even = weekStrain([60, 50, 60, 50, 60, 50, 60]);
    const lumpy = weekStrain([0, 0, 0, 390, 0, 0, 0]);

    expect(even.load).toBe(lumpy.load);
    expect(even.monotony).toBeGreaterThan(lumpy.monotony);
    expect(even.strain).toBeGreaterThan(lumpy.strain);
  });

  it('has no monotony and no strain for a week with no load at all', () => {
    expect(weekStrain(Array(7).fill(0))).toEqual({ load: 0, mean: 0, spread: 0, monotony: null, strain: null });
  });

  it('has an endless monotony and strain when every day is the same', () => {
    const week = weekStrain(Array(7).fill(10));

    expect(week.monotony).toBe(Infinity);
    expect(week.strain).toBe(Infinity);
    expect(week.load).toBe(70);
  });

  it('counts seven equal days as equal even when the last bits of the arithmetic differ', () => {
    // 12.3 added seven times and divided by seven is not 12.3, so the spread comes out as 2e-15 and not as zero.
    const week = weekStrain(Array(7).fill(12.3));

    expect(week.monotony).toBe(Infinity);
    expect(week.strain).toBe(Infinity);
  });

  it('does not call a week with a real, small difference flat', () => {
    const week = weekStrain([50, 50, 50, 50, 50, 50, 50.5]);

    expect(Number.isFinite(week.monotony)).toBe(true);
    expect(week.monotony).toBeGreaterThan(100);
  });

  it('is nothing unless it is given exactly seven numbers', () => {
    expect(weekStrain([1, 2, 3, 4, 5, 6])).toBeNull();
    expect(weekStrain([1, 2, 3, 4, 5, 6, 7, 8])).toBeNull();
    expect(weekStrain([1, 2, 3, 4, 5, 6, Number.NaN])).toBeNull();
    expect(weekStrain([1, 2, 3, 4, 5, 6, undefined])).toBeNull();
    expect(weekStrain([1, 2, 3, 4, 5, 6, '7'])).toBeNull();
    expect(weekStrain(null)).toBeNull();
    expect(weekStrain(undefined)).toBeNull();
    expect(weekStrain('0000000')).toBeNull();
  });
});

describe('trainingStrain', () => {
  const OLDER = [30, 0, 80, 0, 80, 40, 0];

  it('reads the last seven days of a longer history, and the seven before them for the comparison', () => {
    const history = [999, 999, 999, ...OLDER, ...EXAMPLE];
    const result = trainingStrain(history);

    expect(result.week.strain).toBeCloseTo(weekStrain(EXAMPLE).strain, 9);
    expect(result.previous.strain).toBeCloseTo(weekStrain(OLDER).strain, 9);
    expect(result.change).toBe(Math.round((weekStrain(EXAMPLE).strain / weekStrain(OLDER).strain - 1) * 100));
  });

  it('gives the change as a whole percent, positive when this week asks more', () => {
    const harder = trainingStrain([...OLDER, ...EXAMPLE]);
    const easier = trainingStrain([...EXAMPLE, ...OLDER]);

    expect(Number.isInteger(harder.change)).toBe(true);
    expect(Math.sign(harder.change)).toBe(-Math.sign(easier.change));
    expect(harder.change).toBeGreaterThan(0);
  });

  it('has a week but nothing to compare with in the first two weeks', () => {
    const seven = trainingStrain(EXAMPLE);
    const thirteen = trainingStrain([...OLDER, ...EXAMPLE].slice(1));
    const fourteen = trainingStrain([...OLDER, ...EXAMPLE]);

    expect(seven.week).not.toBeNull();
    expect(seven.previous).toBeNull();
    expect(seven.change).toBeNull();
    expect(thirteen.week).not.toBeNull();
    expect(thirteen.previous).toBeNull();
    expect(fourteen.previous).not.toBeNull();
  });

  it('has nothing at all before there are seven days', () => {
    expect(trainingStrain([1, 2, 3]).week).toBeNull();
    expect(trainingStrain([]).week).toBeNull();
    expect(trainingStrain(null)).toEqual({ week: null, previous: null, change: null });
    expect(trainingStrain(undefined)).toEqual({ week: null, previous: null, change: null });
  });

  it('leaves the change out when either week has no strain to compare: a rest week, or an endless one', () => {
    const rest = Array(7).fill(0);
    const flat = Array(7).fill(25);

    expect(trainingStrain([...rest, ...EXAMPLE]).change).toBeNull();
    expect(trainingStrain([...EXAMPLE, ...rest]).change).toBeNull();
    expect(trainingStrain([...flat, ...EXAMPLE]).change).toBeNull();
    expect(trainingStrain([...EXAMPLE, ...flat]).change).toBeNull();
    // The two weeks themselves are still reported.
    expect(trainingStrain([...rest, ...EXAMPLE]).previous.strain).toBeNull();
    expect(trainingStrain([...EXAMPLE, ...flat]).week.strain).toBe(Infinity);
    expect(trainingStrain([...EXAMPLE, ...flat]).previous.strain).toBeCloseTo(weekStrain(EXAMPLE).strain, 9);
  });

  it('is zero percent for two weeks that are the same', () => {
    expect(trainingStrain([...EXAMPLE, ...EXAMPLE]).change).toBe(0);
  });
});
