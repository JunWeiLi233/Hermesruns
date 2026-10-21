import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FITNESS_RANGE,
  FITNESS_RANGES,
  FLAT_SHARE,
  TREND_ARROW,
  buildFitnessChart,
  describeForm,
  fitnessTooltipPosition,
  formatChange,
  formatShortDate,
  isoDay,
  movementOver,
  niceCeiling,
  rangeStart,
  restDaysToZeroForm,
  trendDirection,
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

  it('flags the days of races on the days they fall on, and no others', () => {
    const points = days(10);
    const chart = buildFitnessChart({ points, projection: days(3), raceDays: [points[2].date, points[7].date, '2026-01-01'] });

    expect(chart.raceMarks.map((mark) => mark.date)).toEqual([points[2].date, points[7].date]);
    expect(chart.raceMarks.map((mark) => mark.x)).toEqual([chart.entries[2].x, chart.entries[7].x]);
    expect(chart.raceMarks.map((mark) => mark.index)).toEqual([2, 7]);
    expect(chart.entries.map((entry) => entry.race)).toEqual([...points.map((_, i) => i === 2 || i === 7), false, false, false]);
  });

  it('never flags a day of the projection, even if the server names it', () => {
    const points = days(5);
    const projection = days(3).map((day, i) => ({ ...day, date: isoDay(new Date(2026, 8, 6 + i, 12)) }));
    const chart = buildFitnessChart({ points, projection, raceDays: [projection[1].date] });

    expect(chart.raceMarks).toEqual([]);
    expect(chart.entries.some((entry) => entry.race)).toBe(false);
  });

  it('has no flags without race days, whether the answer lacks them or they are not a list', () => {
    expect(buildFitnessChart({ points: days(5), projection: [] }).raceMarks).toEqual([]);
    expect(buildFitnessChart({ points: days(5), projection: [], raceDays: [] }).raceMarks).toEqual([]);
    expect(buildFitnessChart({ points: days(5), projection: [], raceDays: 'yesterday' }).raceMarks).toEqual([]);
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

describe('the strip of daily effort', () => {
  const loads = [0, 60, 120, 0, 240, 90, 30, 0, 150, 60];
  const series = { points: days(10, { load: (i) => loads[i] }), projection: days(4, { load: () => 999 }).map((day, i) => ({ ...day, date: isoDay(new Date(2026, 8, 20 + i, 12)) })) };

  it('is not there unless asked for, and then the chart is the height it was given', () => {
    const plain = buildFitnessChart(series, { width: 640, height: 300 });

    expect(plain.withEffort).toBe(false);
    expect(plain.height).toBe(300);
    expect(plain.effortPath).toBe('');
    expect(plain.effortTicks).toEqual([]);
    expect(plain.entries.every((entry) => entry.barH === 0)).toBe(true);
    expect(plain.bottom).toBe(plain.formBottom);
    expect(buildFitnessChart(series, { height: 300, withForm: false }).bottom).toBe(300 - 26);
  });

  it('adds a strip below the form panel and makes the chart taller by it, leaving the other panels where they were', () => {
    const plain = buildFitnessChart(series, { width: 640, height: 300 });
    const chart = buildFitnessChart(series, { width: 640, height: 300, withEffort: true });

    expect(chart.withEffort).toBe(true);
    expect(chart.mainTop).toBe(plain.mainTop);
    expect(chart.mainBottom).toBe(plain.mainBottom);
    expect(chart.formTop).toBe(plain.formTop);
    expect(chart.formBottom).toBe(plain.formBottom);
    expect(chart.effortTop).toBe(chart.formBottom + 24);
    expect(chart.effortBottom - chart.effortTop).toBe(58);
    expect(chart.height).toBe(300 + 24 + 58);
    expect(chart.height - chart.effortBottom).toBe(26);
    expect(chart.bottom).toBe(chart.effortBottom);
  });

  it('makes the strip smaller on a short chart, and puts it under the lines when there is no form panel', () => {
    expect(buildFitnessChart(series, { height: 250, withEffort: true }).height).toBe(250 + 24 + 46);

    const noForm = buildFitnessChart(series, { height: 300, withForm: false, withEffort: true });
    expect(noForm.effortTop).toBe(noForm.mainBottom + 24);
    expect(noForm.bottom).toBe(noForm.effortBottom);
  });

  it('draws a bar for each day with effort, as tall as its share of the scale, standing on the baseline', () => {
    const chart = buildFitnessChart(series, { width: 640, height: 300, withEffort: true });
    const stripH = chart.effortBottom - chart.effortTop;

    expect(chart.effortMax).toBe(250);                         // 240 rounded up to a number a person would pick
    chart.entries.slice(0, 10).forEach((entry, i) => {
      if (loads[i] === 0) {
        expect(entry.barH).toBe(0);
        return;
      }
      expect(entry.barH).toBeCloseTo((loads[i] / 250) * stripH, 9);
      expect(entry.barY + entry.barH).toBeCloseTo(chart.effortBottom, 9);
      expect(entry.barX + chart.barWidth / 2).toBeCloseTo(entry.x, 9);
    });
    expect(chart.effortPath.split('M')).toHaveLength(1 + loads.filter((load) => load > 0).length);
    expect(chart.effortTicks).toEqual([
      { value: 0, y: chart.effortBottom },
      { value: 250, y: chart.effortTop },
    ]);
  });

  it('draws no bar for a day of the projection, whatever the server sends for it', () => {
    const chart = buildFitnessChart(series, { width: 640, height: 300, withEffort: true });

    expect(chart.entries.slice(10).every((entry) => entry.projected && entry.barH === 0)).toBe(true);
    expect(chart.effortMax).toBe(250);
  });

  it('keeps the bars apart and inside the chart, however many days there are', () => {
    for (const count of [3, 40, 365]) {
      const chart = buildFitnessChart({ points: days(count), projection: [] }, { width: 800, height: 300, withEffort: true });
      const pitch = (800 - chart.padL - chart.padR) / (count - 1);

      expect(chart.barWidth).toBeGreaterThanOrEqual(1);
      expect(chart.barWidth).toBeLessThanOrEqual(12);
      if (pitch > 1.4) expect(chart.barWidth).toBeLessThan(pitch);
      expect(chart.entries[0].barX).toBeGreaterThanOrEqual(chart.padL - 6.01);
      expect(chart.entries[count - 1].barX + chart.barWidth).toBeLessThanOrEqual(800 - chart.padR + 6.01);
    }
  });

  it('never lets the scale read under 10, so a quiet window is not blown up, and gives a bar at least a pixel', () => {
    const quiet = buildFitnessChart({ points: days(5, { load: (i) => (i === 2 ? 0.1 : 0) }), projection: [] }, { height: 300, withEffort: true });
    expect(quiet.effortMax).toBe(10);
    expect(quiet.entries[2].barH).toBe(1);

    const none = buildFitnessChart({ points: days(5, { load: () => 0 }), projection: [] }, { height: 300, withEffort: true });
    expect(none.effortMax).toBe(10);
    expect(none.effortPath).toBe('');
  });

  it('treats an effort that is not a number, or is negative, as no effort', () => {
    const chart = buildFitnessChart({ points: days(4, { load: (i) => [null, -20, 'many', 50][i] }), projection: [] }, { height: 300, withEffort: true });

    expect(chart.entries.map((entry) => entry.barH > 0)).toEqual([false, false, false, true]);
    expect(chart.effortMax).toBe(50);
  });

  it('is a pure function of its input', () => {
    expect(buildFitnessChart(series, { width: 500, withEffort: true })).toEqual(buildFitnessChart(series, { width: 500, withEffort: true }));
  });
});

describe('trendDirection', () => {
  it('is up for a rise and down for a fall of more than a thirtieth of where it started', () => {
    expect(FLAT_SHARE).toBe(0.03);
    expect(trendDirection(4.2, 50)).toBe('up');
    expect(trendDirection(-4.2, 50)).toBe('down');
    expect(trendDirection(1.5, 50)).toBe('up');         // exactly 3%: not under it
    expect(trendDirection(-1.5, 50)).toBe('down');
  });

  it('is flat for a change under three percent of where it started', () => {
    expect(trendDirection(1.4, 50)).toBe('flat');
    expect(trendDirection(-1.4, 50)).toBe('flat');
    expect(trendDirection(2.9, 100)).toBe('flat');
  });

  it('is flat for a change that prints as 0.0, however small the number it started from', () => {
    expect(trendDirection(0, 50)).toBe('flat');
    expect(trendDirection(0.04, 0.5)).toBe('flat');
    expect(trendDirection(-0.04, 0.5)).toBe('flat');
    expect(trendDirection(0.06, 0.5)).toBe('up');
  });

  it('goes by the sign alone when there is nothing to take a share of', () => {
    expect(trendDirection(3, 0)).toBe('up');
    expect(trendDirection(-3, undefined)).toBe('down');
    expect(trendDirection(-3, Number.NaN)).toBe('down');
  });

  it('is flat for a change that is not a number', () => {
    expect(trendDirection(Number.NaN, 50)).toBe('flat');
    expect(trendDirection(undefined, 50)).toBe('flat');
  });

  it('has an arrow for each way', () => {
    expect(TREND_ARROW).toEqual({ up: '↑', down: '↓', flat: '→' });
  });
});

describe('movementOver', () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ date: `d${i}`, fitness: 40 + i, fatigue: 90 - 2 * i, form: -50 + 3 * i }));

  it('is the difference of the last day and the day that many days before it, as a runner could read it off the chart', () => {
    const fitness = movementOver(points, 'fitness', 14);

    expect(fitness).toMatchObject({ days: 14, change: 14, before: 45 });
    expect(fitness.ratio).toBeCloseTo(14 / 45, 12);
    expect(fitness.direction).toBe('up');
    expect(movementOver(points, 'fatigue', 7)).toMatchObject({ change: -14, before: 66, direction: 'down' });
    expect(movementOver(points, 'form', 14)).toMatchObject({ change: 42, direction: 'up' });
  });

  it('needs a day that many days back: fifteen days for fourteen', () => {
    expect(movementOver(points.slice(0, 15), 'fitness', 14)).not.toBeNull();
    expect(movementOver(points.slice(0, 14), 'fitness', 14)).toBeNull();
    expect(movementOver([], 'fitness', 14)).toBeNull();
    expect(movementOver(null, 'fitness', 14)).toBeNull();
    expect(movementOver(points, 'fitness', 0)).toBeNull();
  });

  it('has no share when it started at nothing or below', () => {
    const fromZero = movementOver([{ fitness: 0 }, { fitness: 5 }, { fitness: 9 }], 'fitness', 2);
    const fromBelow = movementOver([{ form: -8 }, { form: -2 }, { form: 6 }], 'form', 2);

    expect(fromZero).toMatchObject({ change: 9, ratio: null, direction: 'up' });
    expect(fromBelow).toMatchObject({ change: 14, ratio: null, direction: 'up' });
  });

  it('judges a change of form against the larger of where it started and where it ended, since form can cross zero', () => {
    // From -0.4 to +0.3: a swing of 0.7 across zero is not a thirtieth of 0.4, but it prints as 0.7, so it is a move.
    expect(movementOver([{ form: -0.4 }, { form: 0 }, { form: 0.3 }], 'form', 2).direction).toBe('up');
    // From 100 to 101: a thirtieth of 101 is 3.4, so a step of 1 is level.
    expect(movementOver([{ form: 100 }, { form: 100.5 }, { form: 101 }], 'form', 2).direction).toBe('flat');
  });

  it('has nothing for numbers that are not numbers', () => {
    expect(movementOver([{ fitness: 1 }, { fitness: Number.NaN }, { fitness: 3 }], 'fitness', 2)).not.toBeNull();
    expect(movementOver([{ fitness: 1 }, { fitness: 2 }, { fitness: Number.NaN }], 'fitness', 2)).toBeNull();
    expect(movementOver([{ fitness: 1 }, { fitness: 2 }, { fitness: 3 }], 'form', 2)).toBeNull();
  });
});

describe('restDaysToZeroForm', () => {
  /** The dotted stretch the server sends for a runner at (fitness, fatigue) today who does not run: the same recursion. */
  function rested(fitness, fatigue, count = 14) {
    return Array.from({ length: count }, (_, k) => {
      const f = fitness * Math.exp(-(k + 1) / 42);
      const g = fatigue * Math.exp(-(k + 1) / 7);
      return { date: isoDay(new Date(2026, 9, 11 + k, 12)), fitness: f, fatigue: g, form: f - g };
    });
  }
  const today = (fitness, fatigue) => ({ date: '2026-10-10', fitness, fatigue, form: fitness - fatigue });

  it('counts the days of rest until form reaches zero, with tomorrow as 1', () => {
    // Form is zero at k = 8.4 x ln(fatigue / fitness) days: 3.4 for 60 and 90, so the 4th day is the first that is above it.
    const result = restDaysToZeroForm({ current: today(60, 90), projection: rested(60, 90) });

    expect(result).toEqual({ state: 'days', days: 4, date: '2026-10-14' });
  });

  it('says tomorrow when the very next day gets there', () => {
    const result = restDaysToZeroForm({ current: today(60, 61), projection: rested(60, 61) });

    expect(result).toEqual({ state: 'days', days: 1, date: '2026-10-11' });
  });

  it('has nothing to say when form is zero or above already', () => {
    expect(restDaysToZeroForm({ current: today(90, 60), projection: rested(90, 60) })).toEqual({ state: 'none' });
    expect(restDaysToZeroForm({ current: today(60, 60), projection: rested(60, 60) })).toEqual({ state: 'none' });
  });

  it('reads form the way the card prints it: a form that prints as 0.0 is zero', () => {
    expect(restDaysToZeroForm({ current: today(60, 60.04), projection: rested(60, 60.04) })).toEqual({ state: 'none' });
    const projection = [
      { date: '2026-10-11', form: -3 },
      { date: '2026-10-12', form: -0.04 },
      { date: '2026-10-13', form: 1 },
    ];
    expect(restDaysToZeroForm({ current: { form: -6 }, projection })).toEqual({ state: 'days', days: 2, date: '2026-10-12' });
  });

  it('says it is later than the stretch when none of its days gets there', () => {
    // 400 effort in one day from nothing: fatigue is 5.7 times fitness, and zero is 14.6 days away.
    const result = restDaysToZeroForm({ current: today(9.4, 53.2), projection: rested(9.4, 53.2) });

    expect(result).toEqual({ state: 'later', days: 14 });
  });

  it('has nothing to read without a stretch after today, without today, or with numbers that are not numbers', () => {
    expect(restDaysToZeroForm({ current: today(60, 90), projection: [] })).toEqual({ state: 'none' });
    expect(restDaysToZeroForm({ current: today(60, 90) })).toEqual({ state: 'none' });
    expect(restDaysToZeroForm({ projection: rested(60, 90) })).toEqual({ state: 'none' });
    expect(restDaysToZeroForm(null)).toEqual({ state: 'none' });
    expect(restDaysToZeroForm(undefined)).toEqual({ state: 'none' });
    expect(restDaysToZeroForm({ current: { form: Number.NaN }, projection: rested(60, 90) })).toEqual({ state: 'none' });
    expect(restDaysToZeroForm({ current: today(60, 90), projection: [{ date: '2026-10-11', form: Number.NaN }, null] })).toEqual({ state: 'later', days: 2 });
  });

  it('agrees with the closed form for a range of runners', () => {
    for (const [fitness, fatigue] of [[40, 55], [80, 140], [120, 150], [30, 100], [55, 56]]) {
      const result = restDaysToZeroForm({ current: today(fitness, fatigue), projection: rested(fitness, fatigue, 30) });
      expect(result.days).toBe(Math.ceil(8.4 * Math.log(fatigue / fitness)));
    }
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
