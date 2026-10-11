import { describe, expect, it } from 'vitest';
import { WEEK_STATUS_TONE, buildWeeklyChart, weeklyTooltipPosition } from './weeklyEffortChart';

function week(index, total, { range = null, status = 'within', complete = true, runs = 3 } = {}) {
  const start = new Date(2026, 7, 3 + 7 * index, 12);
  const pad = (value) => String(value).padStart(2, '0');
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: '',
    total,
    runs,
    complete,
    range,
    status,
  };
}

describe('buildWeeklyChart', () => {
  it('has nothing to draw without weeks, and skips a week with no usable total', () => {
    expect(buildWeeklyChart([])).toBeNull();
    expect(buildWeeklyChart(null)).toBeNull();
    expect(buildWeeklyChart([null, { total: Number.NaN }])).toBeNull();
    expect(buildWeeklyChart([week(0, 100), { total: Number.NaN }, week(1, 150)]).bars).toHaveLength(2);
  });

  it('gives every week a slot of equal width, oldest on the left, with its bar in the middle of it', () => {
    const chart = buildWeeklyChart([week(0, 100), week(1, 200), week(2, 150), week(3, 50)], { width: 640, height: 220 });

    expect(chart.bars).toHaveLength(4);
    expect(chart.slot).toBeCloseTo((640 - chart.padL - chart.padR) / 4, 6);
    chart.bars.forEach((bar, index) => {
      expect(bar.index).toBe(index);
      expect(bar.slotX).toBeCloseTo(chart.padL + chart.slot * index, 6);
      expect(bar.centre).toBeCloseTo(bar.slotX + chart.slot / 2, 6);
      expect(bar.x + bar.width / 2).toBeCloseTo(bar.centre, 6);
      expect(bar.width).toBeLessThanOrEqual(44);
    });
  });

  it('makes a taller week a taller bar that stands on the baseline', () => {
    const chart = buildWeeklyChart([week(0, 100), week(1, 200), week(2, 0)]);
    const [small, big, none] = chart.bars;

    expect(big.height).toBeGreaterThan(small.height);
    expect(big.height / small.height).toBeCloseTo(2, 1);
    expect(small.y + small.height).toBeCloseTo(chart.baseline, 6);
    expect(big.y + big.height).toBeCloseTo(chart.baseline, 6);
    expect(none.height).toBe(0);
    expect(chart.yMax).toBeGreaterThan(200);
  });

  it('keeps a week of a little effort visible', () => {
    const chart = buildWeeklyChart([week(0, 400), week(1, 1)]);
    expect(chart.bars[1].height).toBeGreaterThanOrEqual(2);
  });

  it('draws the range of a week behind its bar, from its high edge down to its low edge', () => {
    const range = { low: 160, high: 240, average: 200 };
    const chart = buildWeeklyChart([week(0, 100, { range }), week(1, 100)]);
    const [withRange, without] = chart.bars;

    expect(without.range).toBeNull();
    expect(withRange.range.y).toBeLessThan(withRange.range.y + withRange.range.height);
    // The block spans 80 effort points, the same as 80 points of bar.
    const eightyPoints = ((chart.baseline - chart.padT) / chart.yMax) * 80;
    expect(withRange.range.height).toBeCloseTo(eightyPoints, 4);
    expect(withRange.range.y + withRange.range.height).toBeCloseTo(chart.baseline - ((chart.baseline - chart.padT) / chart.yMax) * 160, 4);
  });

  it('makes room for a range that is taller than every bar', () => {
    const chart = buildWeeklyChart([week(0, 10, { range: { low: 400, high: 600, average: 500 } })]);
    expect(chart.yMax).toBeGreaterThanOrEqual(600);
    expect(chart.bars[0].range.y).toBeGreaterThanOrEqual(chart.padT - 1e-9);
  });

  it('labels every other week back from this one on a wide chart and every fourth on a narrow one, always naming this week', () => {
    const weeks = Array.from({ length: 12 }, (_, i) => week(i, 100 + i));
    const narrow = buildWeeklyChart(weeks, { width: 320 });
    const wide = buildWeeklyChart(weeks, { width: 900 });
    const middle = buildWeeklyChart(weeks, { width: 600 });

    expect(wide.xTicks.map((bar) => bar.index)).toEqual([1, 3, 5, 7, 9, 11]);
    expect(middle.xTicks.map((bar) => bar.index)).toEqual([2, 5, 8, 11]);
    expect(narrow.xTicks.map((bar) => bar.index)).toEqual([3, 7, 11]);
    expect(narrow.xTicks[narrow.xTicks.length - 1]).toBe(narrow.bars[11]);
    expect(buildWeeklyChart([week(0, 100)]).xTicks.map((bar) => bar.index)).toEqual([0]);
  });

  it('ticks the axis from zero up to the top', () => {
    const chart = buildWeeklyChart([week(0, 300)]);
    expect(chart.yTicks).toHaveLength(5);
    expect(chart.yTicks[0]).toMatchObject({ value: 0, y: chart.baseline });
    expect(chart.yTicks[4].value).toBe(chart.yMax);
  });

  it('says in which tone each status is shown', () => {
    expect(WEEK_STATUS_TONE).toEqual({ within: 'good', above: 'high', below: 'low', building: 'neutral', none: 'neutral' });
  });
});

describe('weeklyTooltipPosition', () => {
  const chart = buildWeeklyChart(Array.from({ length: 12 }, (_, i) => week(i, 100 + 10 * i)), { width: 640, height: 230 });

  it('goes to the right of an early week and to the left of a late one, inside the chart', () => {
    const early = weeklyTooltipPosition(chart.bars[0], chart);
    const late = weeklyTooltipPosition(chart.bars[11], chart);

    expect(early.left).toBeGreaterThan(chart.bars[0].centre);
    expect(late.left + late.width).toBeLessThan(chart.bars[11].centre);
    for (const box of [early, late]) {
      expect(box.left).toBeGreaterThanOrEqual(8);
      expect(box.left + box.width).toBeLessThanOrEqual(chart.width - 8);
      expect(box.top).toBeGreaterThanOrEqual(8);
    }
  });
});
