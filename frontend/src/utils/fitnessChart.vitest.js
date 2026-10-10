import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FITNESS_RANGE,
  FITNESS_RANGES,
  buildFitnessChart,
  describeForm,
  fitnessTooltipPosition,
  formatChange,
  formatShortDate,
  isoDay,
  niceCeiling,
  rangeStart,
} from './fitnessChart';

/** `count` days from 1 Sep 2026 with the numbers the server would send. */
function days(count, { fitness = (i) => 10 + i, fatigue = (i) => 20 + 2 * i, load = () => 60 } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, 8, 1 + i, 12);
    return {
      date: isoDay(date),
      load: load(i),
      fitness: fitness(i),
      fatigue: fatigue(i),
      form: fitness(i) - fatigue(i),
    };
  });
}

describe('ranges and dates', () => {
  it('offers six weeks to a year and starts with six months', () => {
    expect(FITNESS_RANGES.map((range) => range.key)).toEqual(['6w', '3m', '6m', '1y']);
    expect(DEFAULT_FITNESS_RANGE).toBe('6m');
  });

  it('starts a range so that today is its last day', () => {
    const today = new Date(2026, 9, 10, 15, 30);
    expect(rangeStart('6w', today)).toBe('2026-08-30');      // 42 days: 30 Aug to 10 Oct
    expect(rangeStart('1y', today)).toBe('2025-10-11');      // 365 days
    expect(rangeStart('nonsense', today)).toBe(rangeStart(DEFAULT_FITNESS_RANGE, today));
  });

  it('writes a day in the browser calendar, not in UTC', () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(isoDay(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
  });

  it('writes a short date and refuses what is not a day', () => {
    expect(formatShortDate('2026-10-07', 'en-US')).toBe('Oct 7');
    expect(formatShortDate('2026-10-07', 'zh-CN')).toBe('10月7日');
    expect(formatShortDate('2026-02-30', 'en-US')).toBe('--');
    expect(formatShortDate('yesterday', 'en-US')).toBe('--');
    expect(formatShortDate(null, 'en-US')).toBe('--');
  });

  it('writes a change with its sign and a real minus', () => {
    expect(formatChange(3.21)).toBe('+3.2');
    expect(formatChange(-1.44)).toBe('−1.4');
    expect(formatChange(0)).toBe('0.0');
    expect(formatChange(-0.04)).toBe('0.0');
    expect(formatChange(12.345, { digits: 0 })).toBe('+12');
    expect(formatChange(Number.NaN)).toBe('–');
  });
});

describe('describeForm', () => {
  it('is fresh above a tenth of fitness, tired below minus a tenth, even in between', () => {
    expect(describeForm(12, 100)).toBe('fresh');
    expect(describeForm(10.1, 100)).toBe('fresh');
    expect(describeForm(10, 100)).toBe('even');
    expect(describeForm(0, 100)).toBe('even');
    expect(describeForm(-10, 100)).toBe('even');
    expect(describeForm(-10.1, 100)).toBe('tired');
  });

  it('never reads a swing of under 3 points as anything but even, whatever the fitness', () => {
    expect(describeForm(2.9, 5)).toBe('even');
    expect(describeForm(-2.9, 5)).toBe('even');
    expect(describeForm(3.1, 5)).toBe('fresh');
    expect(describeForm(-3.1, 0)).toBe('tired');
    expect(describeForm(Number.NaN, 50)).toBe('even');
  });
});

describe('buildFitnessChart', () => {
  it('has nothing to draw without days', () => {
    expect(buildFitnessChart({ points: [], projection: [] })).toBeNull();
    expect(buildFitnessChart(null)).toBeNull();
    expect(buildFitnessChart({})).toBeNull();
  });

  it('puts every day in its place from left to right, and the projection after today', () => {
    const points = days(30);
    const projection = days(5, { fitness: (i) => 40 - i, fatigue: (i) => 60 - 5 * i }).map((day, i) => ({ ...day, date: isoDay(new Date(2026, 9, 1 + i, 12)) }));
    const chart = buildFitnessChart({ points, projection }, { width: 640, height: 300 });

    expect(chart.entries).toHaveLength(35);
    expect(chart.realCount).toBe(30);
    expect(chart.entries[0].x).toBe(chart.padL);
    expect(chart.entries[34].x).toBeCloseTo(640 - chart.padR, 6);
    for (let i = 1; i < chart.entries.length; i += 1) {
      expect(chart.entries[i].x).toBeGreaterThan(chart.entries[i - 1].x);
    }
    expect(chart.entries.slice(0, 30).every((entry) => !entry.projected)).toBe(true);
    expect(chart.entries.slice(30).every((entry) => entry.projected)).toBe(true);
    expect(chart.projectionStartX).toBeCloseTo(chart.entries[29].x, 6);
  });

  it('draws a higher number higher up, and zero on the baseline', () => {
    const chart = buildFitnessChart({ points: days(10, { fitness: () => 0, fatigue: (i) => (i === 9 ? 80 : 20) }), projection: [] });
    const [first, ...rest] = chart.entries;
    const last = rest[rest.length - 1];

    expect(first.fitnessY).toBe(chart.mainBottom);
    expect(last.fatigueY).toBeLessThan(first.fatigueY);
    expect(last.fatigueY).toBeGreaterThanOrEqual(chart.mainTop);
    expect(chart.yMax).toBeGreaterThanOrEqual(80);
    expect(chart.yTicks[0]).toMatchObject({ value: 0, y: chart.mainBottom });
    expect(chart.yTicks[4].value).toBe(chart.yMax);
  });

  it('gives the axis four equal steps of a round size, with room above the tallest line, and never less than 20', () => {
    const tall = buildFitnessChart({ points: days(5, { fitness: () => 137, fatigue: () => 90 }), projection: [] });
    expect(tall.yTicks.map((tick) => tick.value)).toEqual([0, 40, 80, 120, 160]);
    expect(tall.yMax).toBe(160);

    const sixty = buildFitnessChart({ points: days(5, { fitness: () => 100, fatigue: () => 215 }), projection: [] });
    expect(sixty.yTicks.map((tick) => tick.value)).toEqual([0, 60, 120, 180, 240]);

    const flat = buildFitnessChart({ points: days(5, { fitness: () => 0, fatigue: () => 0 }), projection: [] });
    expect(flat.yTicks.map((tick) => tick.value)).toEqual([0, 5, 10, 15, 20]);
  });

  it('rounds up to a number a person would pick', () => {
    expect(niceCeiling(121)).toBe(150);
    expect(niceCeiling(100)).toBe(100);
    expect(niceCeiling(100.5)).toBe(120);
    expect(niceCeiling(37.7)).toBe(40);
    expect(niceCeiling(7)).toBe(8);
    expect(niceCeiling(0.3)).toBe(0.3);
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(Number.NaN)).toBe(1);
  });

  it('sizes the axis to the lines that are showing', () => {
    const series = { points: days(5, { fitness: () => 40, fatigue: () => 200 }), projection: [] };
    const both = buildFitnessChart(series, { showFitness: true, showFatigue: true });
    const fitnessOnly = buildFitnessChart(series, { showFitness: true, showFatigue: false });
    const fatigueOnly = buildFitnessChart(series, { showFitness: false, showFatigue: true });
    const neither = buildFitnessChart(series, { showFitness: false, showFatigue: false });

    expect(both.yMax).toBeGreaterThanOrEqual(200);
    expect(fitnessOnly.yMax).toBeLessThan(both.yMax);
    expect(fitnessOnly.yMax).toBeGreaterThanOrEqual(40);
    expect(fatigueOnly.yMax).toBe(both.yMax);
    expect(neither.yMax).toBe(both.yMax);          // nothing showing is treated as everything showing: there is always an axis

    // And the other way round: with fitness the taller line and hidden, fatigue gets the height.
    const swapped = { points: days(5, { fitness: () => 200, fatigue: () => 40 }), projection: [] };
    expect(buildFitnessChart(swapped, { showFitness: false, showFatigue: true }).yMax).toBeLessThan(buildFitnessChart(swapped).yMax);
  });

  it('puts form on both sides of a zero line in a panel of its own below the lines', () => {
    const chart = buildFitnessChart({ points: days(6, { fitness: () => 50, fatigue: (i) => [30, 40, 50, 60, 70, 50][i] }), projection: [] });

    expect(chart.formTop).toBeGreaterThan(chart.mainBottom);
    expect(chart.zeroY).toBeCloseTo((chart.formTop + chart.formBottom) / 2, 6);
    const [fresh, , even, tired] = chart.entries;
    expect(fresh.form).toBeGreaterThan(0);
    expect(fresh.formY).toBeLessThan(chart.zeroY);
    expect(even.formY).toBeCloseTo(chart.zeroY, 6);
    expect(tired.formY).toBeGreaterThan(chart.zeroY);
    expect(chart.formTicks.map((tick) => tick.value)).toEqual([chart.formReach, 0, -chart.formReach]);
    expect(chart.formTicks[1].y).toBeCloseTo(chart.zeroY, 6);
    expect(chart.formReach).toBeGreaterThanOrEqual(5);
    expect(chart.formBottom).toBeLessThan(chart.height);
  });

  it('keeps form inside its panel however far it swings', () => {
    const chart = buildFitnessChart({ points: days(4, { fitness: () => 0, fatigue: (i) => [0, 500, 0, 500][i] }), projection: [] });
    for (const entry of chart.entries) {
      expect(entry.formY).toBeGreaterThanOrEqual(chart.formTop - 1e-9);
      expect(entry.formY).toBeLessThanOrEqual(chart.formBottom + 1e-9);
    }
  });

  it('gives the lines the whole height when the form panel is switched off', () => {
    const series = { points: days(10), projection: [] };
    const withForm = buildFitnessChart(series, { height: 300, withForm: true });
    const without = buildFitnessChart(series, { height: 300, withForm: false });

    expect(withForm.withForm).toBe(true);
    expect(without.withForm).toBe(false);
    expect(without.mainBottom).toBeGreaterThan(withForm.mainBottom);
    expect(without.mainBottom).toBe(300 - 26);
  });

  it('joins the dotted projection to the last solid day, and has none without a projection', () => {
    const points = days(10);
    const projection = days(3, { fitness: () => 5, fatigue: () => 5 });
    const chart = buildFitnessChart({ points, projection });

    expect(chart.projectedFitnessPath.startsWith(`M${chart.entries[9].x.toFixed(2)},${chart.entries[9].fitnessY.toFixed(2)}`)).toBe(true);
    expect(chart.projectedFitnessPath.split('L')).toHaveLength(4);
    expect(chart.fitnessPath.split('L')).toHaveLength(10);
    expect(chart.formArea.endsWith('Z')).toBe(true);

    const plain = buildFitnessChart({ points, projection: [] });
    expect(plain.projectedFitnessPath).toBe('');
    expect(plain.projectionStartX).toBeNull();
  });

  it('draws a single day in the middle', () => {
    const chart = buildFitnessChart({ points: days(1), projection: [] }, { width: 600 });

    expect(chart.entries).toHaveLength(1);
    expect(chart.entries[0].x).toBeCloseTo((chart.padL + (600 - chart.padR)) / 2, 6);
    expect(chart.xTicks).toHaveLength(1);
  });

  it('labels fewer days on a narrow chart than a wide one, always the first and the last', () => {
    const series = { points: days(60), projection: [] };
    const narrow = buildFitnessChart(series, { width: 320 });
    const wide = buildFitnessChart(series, { width: 900 });

    expect(narrow.xTicks.length).toBeLessThan(wide.xTicks.length);
    expect(narrow.xTicks[0]).toBe(narrow.entries[0]);
    expect(narrow.xTicks[narrow.xTicks.length - 1]).toBe(narrow.entries[59]);
    expect(wide.xTicks[wide.xTicks.length - 1]).toBe(wide.entries[59]);
  });

  it('is a pure function of its input', () => {
    const series = { points: days(20), projection: days(3) };
    expect(buildFitnessChart(series, { width: 500 })).toEqual(buildFitnessChart(series, { width: 500 }));
  });
});

describe('fitnessTooltipPosition', () => {
  const chart = buildFitnessChart({ points: days(30), projection: [] }, { width: 640, height: 300 });

  it('sits to the right of an early day and to the left of a late one, inside the chart either way', () => {
    const early = fitnessTooltipPosition(chart.entries[1], chart);
    const late = fitnessTooltipPosition(chart.entries[29], chart);

    expect(early.left).toBeGreaterThan(chart.entries[1].x);
    expect(late.left + late.width).toBeLessThan(chart.entries[29].x);
    for (const box of [early, late]) {
      expect(box.left).toBeGreaterThanOrEqual(8);
      expect(box.left + box.width).toBeLessThanOrEqual(chart.width - 8);
      expect(box.top).toBeGreaterThanOrEqual(8);
    }
  });

  it('shrinks to fit a very narrow chart', () => {
    const narrow = buildFitnessChart({ points: days(10), projection: [] }, { width: 200 });
    const box = fitnessTooltipPosition(narrow.entries[5], narrow);
    expect(box.width).toBeLessThanOrEqual(200 - 16);
    expect(box.left).toBeGreaterThanOrEqual(8);
  });
});
