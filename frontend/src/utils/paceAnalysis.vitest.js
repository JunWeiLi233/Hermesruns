import { describe, expect, it } from 'vitest';
import { vdotToPaceSecondsPerKm } from './vdot';
import {
  PACE_ZONE_KEYS,
  areaPath,
  distanceTicks,
  linePath,
  nearestIndex,
  paceDomain,
  paceTicks,
  paceZoneBands,
  timeInPaceZones,
  zoneIndexForPace,
} from './paceAnalysis';

describe('paceZoneBands', () => {
  it('makes six bands from slowest to fastest, each starting where the last ends', () => {
    const bands = paceZoneBands(50);

    expect(bands.map((band) => band.key)).toEqual(PACE_ZONE_KEYS);
    expect(bands[0].slowest).toBeNull();
    expect(bands.at(-1).fastest).toBeNull();
    for (let index = 1; index < bands.length; index += 1) {
      expect(bands[index].slowest).toBe(bands[index - 1].fastest);
      expect(bands[index].fastest === null || bands[index].fastest < bands[index].slowest).toBe(true);
    }
  });

  it('puts the edges where the Daniels paces for that VDOT are', () => {
    const bands = paceZoneBands(50);

    expect(bands[1].slowest).toBeCloseTo(vdotToPaceSecondsPerKm(50, 0.59), 6);
    expect(bands[2].slowest).toBeCloseTo(vdotToPaceSecondsPerKm(50, 0.75), 6);
    expect(bands[3].slowest).toBeCloseTo(vdotToPaceSecondsPerKm(50, 0.83), 6);
    expect(bands[4].slowest).toBeCloseTo(vdotToPaceSecondsPerKm(50, 0.92), 6);
    expect(bands[5].slowest).toBeCloseTo(vdotToPaceSecondsPerKm(50, 1.05), 6);
  });

  it('is faster for a fitter runner', () => {
    expect(paceZoneBands(60)[3].slowest).toBeLessThan(paceZoneBands(45)[3].slowest);
  });

  it('has no bands without a usable VDOT', () => {
    expect(paceZoneBands(null)).toEqual([]);
    expect(paceZoneBands(0)).toEqual([]);
    expect(paceZoneBands(Number.NaN)).toEqual([]);
    expect(paceZoneBands(-5)).toEqual([]);
  });
});

describe('zoneIndexForPace', () => {
  const bands = paceZoneBands(50);

  it('finds the band a pace falls in', () => {
    expect(zoneIndexForPace(600, bands)).toBe(0);
    expect(zoneIndexForPace(bands[1].slowest - 1, bands)).toBe(1);
    expect(zoneIndexForPace(bands[2].slowest - 1, bands)).toBe(2);
    expect(zoneIndexForPace(bands[3].slowest - 1, bands)).toBe(3);
    expect(zoneIndexForPace(bands[4].slowest - 1, bands)).toBe(4);
    expect(zoneIndexForPace(bands[5].slowest - 1, bands)).toBe(5);
    expect(zoneIndexForPace(100, bands)).toBe(5);
  });

  it('gives a pace exactly on an edge to the band that starts at it, the faster one', () => {
    expect(zoneIndexForPace(bands[1].slowest, bands)).toBe(1);
    expect(zoneIndexForPace(bands[3].slowest, bands)).toBe(3);
  });
});

describe('timeInPaceZones', () => {
  const bands = paceZoneBands(50);
  const easy = (bands[1].slowest + bands[1].fastest) / 2;
  const threshold = (bands[3].slowest + bands[3].fastest) / 2;

  it('counts each sample as one step in its band and keeps standing still apart', () => {
    const series = { stepSeconds: 10, paceSecPerKm: [easy, easy, easy, null, null, threshold], gapSecPerKm: [] };

    const result = timeInPaceZones(series, bands, 'pace');

    expect(result.seconds).toEqual([0, 30, 0, 10, 0, 0]);
    expect(result.moving).toBe(40);
    expect(result.stopped).toBe(20);
  });

  it('can count on the grade-adjusted pace instead', () => {
    const series = { stepSeconds: 5, paceSecPerKm: [easy, easy], gapSecPerKm: [threshold, null] };

    expect(timeInPaceZones(series, bands, 'gap').seconds).toEqual([0, 0, 0, 5, 0, 0]);
    expect(timeInPaceZones(series, bands, 'gap').stopped).toBe(5);
    expect(timeInPaceZones(series, bands, 'pace').seconds).toEqual([0, 10, 0, 0, 0, 0]);
  });

  it('is all zeros without a series or bands', () => {
    expect(timeInPaceZones(null, bands).seconds).toEqual([0, 0, 0, 0, 0, 0]);
    expect(timeInPaceZones({ stepSeconds: 5, paceSecPerKm: [300] }, []).seconds).toEqual([]);
  });
});

describe('paceDomain', () => {
  it('pads the range and rounds it to whole tens', () => {
    expect(paceDomain([300, 310, 330])).toEqual({ min: 280, max: 340 });
  });

  it('is never narrower than a minute', () => {
    const domain = paceDomain([300, 301]);
    expect(domain.max - domain.min).toBeGreaterThanOrEqual(60);
    expect(domain.min).toBeLessThanOrEqual(300);
    expect(domain.max).toBeGreaterThanOrEqual(301);
  });

  it('ignores missing values and says nothing without any', () => {
    expect(paceDomain([null, undefined, Number.NaN])).toBeNull();
    expect(paceDomain([])).toBeNull();
    expect(paceDomain([null, 300, 360, null])).toEqual({ min: 290, max: 370 });
  });

  it('does not let one GPS spike flatten a long series', () => {
    const values = Array.from({ length: 200 }, (_, index) => 300 + (index % 7));
    values[50] = 40;
    const domain = paceDomain(values);

    expect(domain.min).toBeGreaterThan(250);
    expect(domain.max).toBeLessThan(340);
  });

  it('never goes below zero', () => {
    expect(paceDomain([20, 30]).min).toBe(0);
  });
});

describe('paceTicks', () => {
  it('uses a step that leaves six labels at most, on whole numbers', () => {
    for (const domain of [{ min: 290, max: 350 }, { min: 240, max: 480 }, { min: 0, max: 900 }, { min: 150, max: 200 }]) {
      const ticks = paceTicks(domain);
      expect(ticks.length).toBeGreaterThan(1);
      expect(ticks.length).toBeLessThanOrEqual(6);
      expect(ticks.every((tick) => tick >= domain.min && tick <= domain.max && Number.isInteger(tick))).toBe(true);
    }
    expect(paceTicks({ min: 290, max: 350 })).toEqual([300, 315, 330, 345]);
    expect(paceTicks({ min: 240, max: 480 })).toEqual([240, 300, 360, 420, 480]);
    expect(paceTicks({ min: 150, max: 200 })).toEqual([150, 160, 170, 180, 190, 200]);
  });

  it('is empty without a domain', () => {
    expect(paceTicks(null)).toEqual([]);
  });
});

describe('distanceTicks', () => {
  it('marks every kilometre of a short run and spreads out for a long one', () => {
    expect(distanceTicks(5.4)).toEqual([1, 2, 3, 4, 5]);
    expect(distanceTicks(0.8)).toEqual([0.5]);
    expect(distanceTicks(21.1)).toEqual([5, 10, 15, 20]);
    expect(distanceTicks(100).length).toBeLessThanOrEqual(8);
    expect(distanceTicks(0)).toEqual([]);
    expect(distanceTicks(Number.NaN)).toEqual([]);
  });
});

describe('nearestIndex', () => {
  const values = [0, 1, 2, 4, 8];

  it('finds the closest value, with a tie going to the earlier one', () => {
    expect(nearestIndex(values, -3)).toBe(0);
    expect(nearestIndex(values, 0.4)).toBe(0);
    expect(nearestIndex(values, 0.6)).toBe(1);
    expect(nearestIndex(values, 3)).toBe(2);
    expect(nearestIndex(values, 3.1)).toBe(3);
    expect(nearestIndex(values, 100)).toBe(4);
  });

  it('is -1 for nothing', () => {
    expect(nearestIndex([], 3)).toBe(-1);
    expect(nearestIndex(null, 3)).toBe(-1);
  });
});

describe('linePath', () => {
  const x = (value) => value * 10;
  const y = (value) => 100 - value;

  it('joins the points and lifts the pen at a missing value', () => {
    expect(linePath([0, 1, 2, 3, 4], [10, 20, null, 30, 40], x, y)).toBe('M0.0 90.0L10.0 80.0M30.0 70.0L40.0 60.0');
  });

  it('draws nothing for a run of one point or none', () => {
    expect(linePath([0, 1, 2], [10, null, 20], x, y)).toBe('');
    expect(linePath([], [], x, y)).toBe('');
    expect(linePath([0, 1], [null, null], x, y)).toBe('');
  });

  it('keeps a lone point out of a line that otherwise continues', () => {
    expect(linePath([0, 1, 2, 3, 4], [10, null, 20, 30, 40], x, y)).toBe('M20.0 80.0L30.0 70.0L40.0 60.0');
  });
});

describe('areaPath', () => {
  it('closes the shape down to the baseline', () => {
    expect(areaPath([0, 1, 2], [1, 3, 2], (v) => v * 10, (v) => 50 - v * 10, 60)).toBe('M0.0 40.0L10.0 20.0L20.0 30.0L20.0 60.0L0.0 60.0Z');
  });

  it('skips missing values and is empty with fewer than two points', () => {
    expect(areaPath([0, 1, 2], [1, null, 2], (v) => v, (v) => v, 9)).toBe('M0.0 1.0L2.0 2.0L2.0 9.0L0.0 9.0Z');
    expect(areaPath([0], [1], (v) => v, (v) => v, 9)).toBe('');
    expect(areaPath([0, 1], [null, null], (v) => v, (v) => v, 9)).toBe('');
  });
});
