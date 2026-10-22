import { describe, expect, it } from 'vitest';
import { DEFAULT_LOW_ZONES, ZONE_NUMBERS, bandOfZone, buildIntensityChart, percentOf, weekBands } from './intensityChart';

function week(index, minutes, { complete = true, runs = 3, runsWithHeartRate = 3 } = {}) {
  const start = new Date(2026, 7, 3 + 7 * index, 12);
  const pad = (value) => String(value).padStart(2, '0');
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: '',
    complete,
    runs,
    runsWithHeartRate,
    zoneSeconds: minutes.map((value) => value * 60),
    coveredSeconds: minutes.reduce((sum, value) => sum + value * 60, 0),
  };
}

describe('bandOfZone', () => {
  it('puts zones 1 to 3 in the low band, zone 4 in the moderate band and zone 5 in the high band', () => {
    expect(ZONE_NUMBERS.map((zone) => bandOfZone(zone))).toEqual(['low', 'low', 'low', 'moderate', 'high']);
    expect(DEFAULT_LOW_ZONES).toBe(3);
  });

  it('follows a server that cuts the low band elsewhere', () => {
    expect(ZONE_NUMBERS.map((zone) => bandOfZone(zone, 2))).toEqual(['low', 'low', 'moderate', 'high', 'high']);
  });
});

describe('buildIntensityChart', () => {
  it('has nothing to draw without weeks, and skips a week that does not carry five zones', () => {
    expect(buildIntensityChart([])).toBeNull();
    expect(buildIntensityChart(null)).toBeNull();
    expect(buildIntensityChart([null, { zoneSeconds: [1, 2, 3] }, { start: '2026-08-03' }])).toBeNull();
    expect(buildIntensityChart([week(0, [60, 0, 0, 0, 0]), { zoneSeconds: [1] }, week(1, [30, 0, 0, 0, 0])]).bars).toHaveLength(2);
  });

  it('gives every week a slot of equal width, oldest on the left, with its bar in the middle of it', () => {
    const chart = buildIntensityChart([week(0, [60, 30, 10, 5, 5]), week(1, [90, 20, 10, 0, 0]), week(2, [30, 0, 0, 0, 0])], { width: 640, height: 220 });

    expect(chart.bars).toHaveLength(3);
    expect(chart.slot).toBeCloseTo((640 - chart.padL - chart.padR) / 3, 6);
    chart.bars.forEach((bar, index) => {
      expect(bar.index).toBe(index);
      expect(bar.centre).toBeCloseTo(chart.padL + chart.slot * (index + 0.5), 6);
      expect(bar.x + bar.width / 2).toBeCloseTo(bar.centre, 6);
      expect(bar.width).toBeLessThanOrEqual(44);
    });
  });

  it('stacks the five zones from the baseline up, each as tall as its time, and the stack is as tall as the bar', () => {
    const chart = buildIntensityChart([week(0, [60, 30, 15, 10, 5])], { width: 400, height: 220 });
    const bar = chart.bars[0];

    expect(bar.segments.map((segment) => segment.zone)).toEqual([1, 2, 3, 4, 5]);
    expect(bar.segments[0].y + bar.segments[0].height).toBeCloseTo(chart.baseline, 6);
    for (let index = 1; index < 5; index += 1) {
      expect(bar.segments[index].y + bar.segments[index].height).toBeCloseTo(bar.segments[index - 1].y, 6);
    }
    expect(bar.segments[4].y).toBeCloseTo(bar.y, 6);
    expect(bar.height).toBeCloseTo(chart.baseline - bar.y, 6);
    expect(bar.segments[0].height / bar.segments[1].height).toBeCloseTo(2, 5);
    expect(bar.segments[0].seconds).toBe(3600);
  });

  it('makes a week with more time a taller bar, and a week with no time no bar at all', () => {
    const chart = buildIntensityChart([week(0, [30, 0, 0, 0, 0]), week(1, [60, 0, 0, 0, 0]), week(2, [0, 0, 0, 0, 0])]);

    expect(chart.bars[1].height / chart.bars[0].height).toBeCloseTo(2, 5);
    expect(chart.bars[2].height).toBe(0);
    chart.bars[2].segments.forEach((segment) => expect(segment.height).toBe(0));
  });

  it('counts the axis in minutes for a light block and in hours for a heavy one', () => {
    const light = buildIntensityChart([week(0, [60, 20, 0, 0, 0])]);
    const heavy = buildIntensityChart([week(0, [300, 60, 30, 20, 10])]);

    expect(light.unit).toBe('min');
    expect(heavy.unit).toBe('h');
    // The axis ends above the tallest bar, on a tick.
    expect(light.yMax).toBeGreaterThanOrEqual(80);
    expect(heavy.yMax).toBeGreaterThanOrEqual(7);
    expect(light.yTicks).toHaveLength(5);
    expect(light.yTicks[0]).toEqual({ value: 0, y: light.baseline });
    expect(light.yTicks[4].value).toBe(light.yMax);
  });

  it('does not divide by nothing when every week is empty', () => {
    const chart = buildIntensityChart([week(0, [0, 0, 0, 0, 0]), week(1, [0, 0, 0, 0, 0])]);

    expect(chart.yMax).toBe(4);
    expect(Number.isFinite(chart.bars[0].y)).toBe(true);
  });

  it('treats a missing or negative time as none', () => {
    const odd = { start: '2026-08-03', zoneSeconds: [600, null, -5, Number.NaN, 60] };
    const chart = buildIntensityChart([odd]);

    expect(chart.bars[0].segments.map((segment) => segment.seconds)).toEqual([600, 0, 0, 0, 60]);
    expect(chart.bars[0].total).toBe(660);
  });

  it('labels the newest week and every n-th one before it', () => {
    const weeks = Array.from({ length: 12 }, (_, index) => week(index, [60, 0, 0, 0, 0]));
    const chart = buildIntensityChart(weeks, { width: 640 });

    expect(chart.xTicks[chart.xTicks.length - 1].index).toBe(11);
    const gaps = chart.xTicks.slice(1).map((bar, index) => bar.index - chart.xTicks[index].index);
    expect(new Set(gaps).size).toBe(1);
  });
});

describe('weekBands', () => {
  it('shares a week into the three bands', () => {
    expect(weekBands(week(0, [60, 60, 40, 10, 30]))).toEqual({ low: 0.8, moderate: 0.05, high: 0.15 });
  });

  it('has nothing to say about a week with no time', () => {
    expect(weekBands(week(0, [0, 0, 0, 0, 0]))).toBeNull();
    expect(weekBands({ zoneSeconds: [1, 2] })).toBeNull();
    expect(weekBands(null)).toBeNull();
  });
});

describe('percentOf', () => {
  it('rounds a share to a whole percent but never says none for something or all for less than all', () => {
    expect(percentOf(0.8)).toBe(80);
    expect(percentOf(0.004)).toBe(1);
    expect(percentOf(0.998)).toBe(99);
    expect(percentOf(1)).toBe(100);
    expect(percentOf(0)).toBe(0);
    expect(percentOf(Number.NaN)).toBe(0);
  });
});
