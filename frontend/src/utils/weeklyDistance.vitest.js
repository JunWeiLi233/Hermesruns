import { describe, expect, it } from 'vitest';
import { addDaysToKey, localDayKey } from './calendarDays';
import {
  AVERAGE_WEEKS,
  DEFAULT_DISTANCE_RANGE,
  DISTANCE_READOUT_HEIGHT,
  DISTANCE_READOUT_WIDTH,
  DISTANCE_RANGES,
  buildDistanceChart,
  buildWeeklyDistance,
  distanceRangeWeeks,
  distanceReadings,
  distanceTooltipPosition,
  mondayOf,
  toUnit,
} from './weeklyDistance';

// 2026-10-14 is a Wednesday: its week began on Monday 2026-10-12.
const TODAY = '2026-10-14';
const run = (day, km, extra = {}) => ({ id: `${day}-${km}`, startTime: `${day}T07:30:00`, distanceKm: km, movingTimeSeconds: km * 330, ...extra });
/** One run of `km` in each of `count` weeks, the first on `from`. */
const weekly = (count, from, km) => Array.from({ length: count }, (_, index) => run(addDaysToKey(from, 7 * index), km));
/** Weeks 2026-09-14, 09-21, 09-28 and 10-05 with 10, 20, 30 and 40 km, and the week going, 10-12, with 12. */
const FIVE = () => [run('2026-09-15', 10), run('2026-09-22', 20), run('2026-10-01', 30), run('2026-10-06', 40), run('2026-10-13', 12)];

describe('mondayOf', () => {
  it('is the Monday of the week, for a Monday, a Sunday and a day between', () => {
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
  });

  it('crosses a month, a year and a leap day', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
    expect(mondayOf('2026-01-01')).toBe('2025-12-29');
    expect(mondayOf('2024-03-01')).toBe('2024-02-26');
    expect(mondayOf('2024-02-29')).toBe('2024-02-26');
  });
});

describe('the ranges', () => {
  it('are 12 weeks, 26 and a year, and 26 is the one to begin with; an unknown one is that', () => {
    expect(DISTANCE_RANGES.map((range) => range.weeks)).toEqual([12, 26, 52]);
    expect(DEFAULT_DISTANCE_RANGE).toBe('26w');
    expect(distanceRangeWeeks('12w')).toBe(12);
    expect(distanceRangeWeeks('52w')).toBe(52);
    expect(distanceRangeWeeks('whatever')).toBe(26);
    expect(distanceRangeWeeks(undefined)).toBe(26);
  });
});

describe('buildWeeklyDistance', () => {
  it('has nothing without runs, or with none that has a distance and a date', () => {
    expect(buildWeeklyDistance([], { today: TODAY })).toBeNull();
    expect(buildWeeklyDistance(null, { today: TODAY })).toBeNull();
    expect(buildWeeklyDistance([run('2026-10-01', 0), run('2026-10-02', -4), { id: 1, distanceKm: 5 }, { id: 2, startTime: 'soon', distanceKm: 5 }], { today: TODAY })).toBeNull();
  });

  it('has a week for every week from the first run to this one, a week with no run too, oldest first', () => {
    const result = buildWeeklyDistance([run('2026-09-16', 8), run('2026-10-12', 5)], { today: TODAY });

    expect(result.weeks.map((week) => week.start)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12']);
    expect(result.weeks.map((week) => [week.km, week.runs])).toEqual([[8, 1], [0, 0], [0, 0], [0, 0], [5, 1]]);
    expect(result.today).toBe(TODAY);
  });

  it('adds the runs of a week, and a run belongs to the week of its date: Sunday night and Monday morning are two weeks', () => {
    const result = buildWeeklyDistance([
      { id: 1, startTime: '2026-10-04T23:59:00', distanceKm: 10 },
      { id: 2, startTime: '2026-10-05T00:01:00', distanceKm: 6 },
      run('2026-10-07', 4.5),
      run('2026-10-09', 8),
    ], { today: TODAY });

    expect(result.weeks.map((week) => [week.start, week.km, week.runs])).toEqual([['2026-09-28', 10, 1], ['2026-10-05', 18.5, 3], ['2026-10-12', 0, 0]]);
  });

  it('marks the week still going, and only that one', () => {
    const result = buildWeeklyDistance([run('2026-09-01', 5), run('2026-10-13', 7)], { today: TODAY });

    expect(result.weeks.filter((week) => week.open).map((week) => week.start)).toEqual(['2026-10-12']);
    expect(result.weeks[result.weeks.length - 1].km).toBe(7);
  });

  it('leaves out a run dated after the runner\'s today', () => {
    const result = buildWeeklyDistance([run('2026-10-05', 5), run('2026-10-30', 50)], { today: TODAY });

    expect(result.weeks.map((week) => week.km)).toEqual([5, 0]);
  });

  it('follows the runner\'s own today when none is given: a run dated tomorrow (the zone in Settings is east of the device) is in the week going', () => {
    const tomorrow = addDaysToKey(localDayKey(new Date()), 1);
    const result = buildWeeklyDistance([run(addDaysToKey(tomorrow, -20), 4), run(tomorrow, 5)]);
    const last = result.weeks[result.weeks.length - 1];

    expect(last.start).toBe(mondayOf(tomorrow));
    expect(last.open).toBe(true);
    expect(last.km).toBeGreaterThanOrEqual(5);
  });

  it('is the mean of four weeks for a week that is over: the week and the three before it, from the fourth week of the history on', () => {
    const result = buildWeeklyDistance(FIVE(), { today: TODAY });

    expect(AVERAGE_WEEKS).toBe(4);
    expect(result.weeks.map((week) => week.km)).toEqual([10, 20, 30, 40, 12]);
    expect(result.weeks.map((week) => week.average)).toEqual([null, null, null, 25, null]);
  });

  it('counts a week with no run as a week of zero in the average, and moves one week at a time', () => {
    const result = buildWeeklyDistance([
      run('2026-09-01', 20), run('2026-09-15', 20), run('2026-09-22', 20), run('2026-09-29', 20), run('2026-10-06', 20), run('2026-10-13', 5),
    ], { today: TODAY });

    // Weeks from 2026-08-31: 20, 0, 20, 20, 20, 20, and the week going.
    expect(result.weeks.map((week) => week.km)).toEqual([20, 0, 20, 20, 20, 20, 5]);
    expect(result.weeks.map((week) => week.average)).toEqual([null, null, null, 15, 15, 20, null]);
  });

  it('does not take the weeks before the first run as weeks of zero: a new runner\'s average begins on their fourth week', () => {
    const result = buildWeeklyDistance([run('2026-10-13', 5)], { today: TODAY });

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0].average).toBeNull();
  });

  it('is the same for any order of the runs, and does not change what it is given', () => {
    const runs = FIVE();
    const copy = JSON.parse(JSON.stringify(runs));
    const forward = buildWeeklyDistance(runs, { today: TODAY });
    const backward = buildWeeklyDistance([...runs].reverse(), { today: TODAY });

    expect(backward).toEqual(forward);
    expect(runs).toEqual(copy);
  });

  it('is quick for a long history: fifteen years of weeks and five thousand runs', () => {
    const runs = Array.from({ length: 5000 }, (_, index) => {
      const date = new Date(Date.UTC(2012, 0, 2) + index * 1.1 * 86_400_000);
      return run(date.toISOString().slice(0, 10), 5 + (index % 9));
    });
    const began = Date.now();
    const result = buildWeeklyDistance(runs, { today: TODAY });

    expect(result.weeks.length).toBeGreaterThan(700);
    expect(Date.now() - began).toBeLessThan(1000);
    expect(result.weeks[result.weeks.length - 1].open).toBe(true);
  });
});

describe('distanceReadings', () => {
  it('gives the week still going, the average of the last four weeks that are over, and the highest week that is over', () => {
    const readings = distanceReadings(buildWeeklyDistance(FIVE(), { today: TODAY }).weeks);

    expect(readings.thisWeek.km).toBe(12);
    expect(readings.average).toEqual({ km: 25, to: '2026-10-05' });
    expect(readings.highest).toEqual({ km: 40, start: '2026-10-05' });
  });

  it('has no average before four weeks of history, and the later of two equal highest weeks', () => {
    const young = buildWeeklyDistance([run('2026-09-29', 10), run('2026-10-06', 10), run('2026-10-13', 3)], { today: TODAY });
    const readings = distanceReadings(young.weeks);

    expect(readings.average).toBeNull();
    expect(readings.highest).toEqual({ km: 10, start: '2026-10-05' });
  });

  it('has no highest week when every week that is over was a rest, and nothing at all without weeks', () => {
    const resting = buildWeeklyDistance([run('2026-09-01', 5), run('2026-10-13', 4)], { today: TODAY });

    expect(distanceReadings(resting.weeks.slice(1)).highest).toBeNull();
    expect(distanceReadings([])).toEqual({ thisWeek: null, average: null, highest: null });
    expect(distanceReadings(undefined)).toEqual({ thisWeek: null, average: null, highest: null });
  });
});

describe('buildDistanceChart', () => {
  const sample = () => buildWeeklyDistance(FIVE(), { today: TODAY }).weeks;

  it('has nothing to draw with no weeks', () => {
    expect(buildDistanceChart([])).toBeNull();
    expect(buildDistanceChart(undefined)).toBeNull();
  });

  it('draws a bar for each week inside the plot, the taller the longer, and no height for a week of zero', () => {
    const chart = buildDistanceChart([...sample(), { start: '2026-10-19', km: 0, runs: 0, open: false, average: null }], { width: 640, height: 230 });

    expect(chart.bars).toHaveLength(6);
    for (const bar of chart.bars) {
      expect(bar.x).toBeGreaterThanOrEqual(chart.padL);
      expect(bar.x + bar.width).toBeLessThanOrEqual(chart.width - chart.padR + 0.01);
      expect(bar.y + bar.height).toBeLessThanOrEqual(chart.baseline + 0.01);
    }
    expect(chart.bars[3].height).toBeGreaterThan(chart.bars[2].height);
    expect(chart.bars[2].height).toBeGreaterThan(chart.bars[1].height);
    expect(chart.bars[5].height).toBe(0);
  });

  it('has a scale that starts at zero in round steps and ends above the tallest week, with a bar you can see for a short week', () => {
    const chart = buildDistanceChart(sample());

    expect(chart.yTicks.map((tick) => tick.value)).toEqual([0, 12, 24, 36, 48]);
    expect(chart.yMax).toBeGreaterThanOrEqual(40);
    expect(chart.yTicks[0].y).toBeCloseTo(chart.baseline, 5);
    const small = buildDistanceChart([{ start: '2026-10-12', km: 0.3, runs: 1, open: true, average: null }]);
    expect(small.step).toBeGreaterThanOrEqual(1);
    expect(small.bars[0].height).toBeGreaterThanOrEqual(2);
  });

  it('draws the line through the weeks that have an average, and only those', () => {
    const chart = buildDistanceChart(sample());

    expect(chart.withAverage).toHaveLength(1);
    expect(chart.path).toMatch(/^M[\d.]+,[\d.]+$/);
    expect(chart.bars[3].averageY).not.toBeNull();
    expect(chart.bars[4].averageY).toBeNull();

    // Eight weeks of 10 km, the last going: the weeks 4 to 7 have an average.
    const eight = buildWeeklyDistance(weekly(8, '2026-08-24', 10), { today: TODAY }).weeks;
    const long = buildDistanceChart(eight);
    expect(eight.filter((week) => week.average != null)).toHaveLength(4);
    expect(long.withAverage).toHaveLength(4);
    expect(long.path.split('L')).toHaveLength(4);
    expect(long.withAverage.every((bar) => bar.week.average === 10)).toBe(true);
  });

  it('is in miles when the runner counts in miles: the same bars to a scale of miles', () => {
    const km = buildDistanceChart(sample(), { unit: 'km' });
    const miles = buildDistanceChart(sample(), { unit: 'mile' });

    expect(miles.bars[3].week.value).toBeCloseTo(toUnit(40, 'mile'), 6);
    expect(miles.bars[3].week.value).toBeCloseTo(24.855, 2);
    expect(miles.yTicks.map((tick) => tick.value)).toEqual([0, 8, 16, 24, 32]);
    // Distance is distance whatever it is counted in: the bars keep their proportions.
    expect(miles.bars[3].height / miles.bars[2].height).toBeCloseTo(km.bars[3].height / km.bars[2].height, 6);
  });

  it('names the newest week under the chart, and a few weeks besides, whatever the width', () => {
    const year = buildWeeklyDistance(weekly(80, '2025-04-07', 10), { today: '2026-10-14' }).weeks.slice(-52);
    for (const width of [320, 600, 900]) {
      const chart = buildDistanceChart(year, { width });
      expect(chart.xTicks[chart.xTicks.length - 1].index).toBe(year.length - 1);
      expect(chart.xTicks.length).toBeLessThanOrEqual(width < 480 ? 4 : width < 720 ? 6 : 8);
    }
  });
});

describe('distanceTooltipPosition', () => {
  it('is placed by the size the readout has: the text made larger makes it wider and taller, and it still fits inside the chart', () => {
    const wide = buildDistanceChart(Array.from({ length: 12 }, (_, index) => ({ start: addDaysToKey('2026-08-03', 7 * index), km: 10 + index * 3, runs: 3, open: false, average: null })), { width: 900, height: 230 });
    for (const bar of wide.bars) {
      const place = distanceTooltipPosition(bar, wide, { width: 376, height: 168 });
      expect(place.left).toBeGreaterThanOrEqual(8);
      expect(place.left + 376).toBeLessThanOrEqual(wide.width - 8);
      expect(place.top + 168).toBeLessThanOrEqual(wide.height - 4);
    }
  });

  const weeks = Array.from({ length: 12 }, (_, index) => ({ start: addDaysToKey('2026-08-03', 7 * index), km: 10 + index * 3, runs: 3, open: false, average: null }));
  const chart = buildDistanceChart(weeks, { width: 640, height: 230 });

  it('puts the readout beside the bar, to the right when there is room and to the left when there is not', () => {
    const first = distanceTooltipPosition(chart.bars[1], chart);
    expect(first.left).toBeGreaterThan(chart.bars[1].centre);
    const last = distanceTooltipPosition(chart.bars[11], chart);
    expect(last.left + DISTANCE_READOUT_WIDTH).toBeLessThan(chart.bars[11].centre);
  });

  it('stays inside the chart', () => {
    for (const bar of chart.bars) {
      const place = distanceTooltipPosition(bar, chart);
      expect(place.left).toBeGreaterThanOrEqual(8);
      expect(place.left + DISTANCE_READOUT_WIDTH).toBeLessThanOrEqual(chart.width - 8);
      expect(place.top).toBeGreaterThanOrEqual(4);
      expect(place.top + DISTANCE_READOUT_HEIGHT).toBeLessThanOrEqual(chart.height - 4);
    }
  });

  it('goes above the bar on a chart too narrow for it to go beside, and is never over the bar unless the bar fills the chart', () => {
    const narrow = buildDistanceChart(weeks, { width: 300, height: 230 });
    for (const bar of narrow.bars) {
      const place = distanceTooltipPosition(bar, narrow);
      expect(place.left).toBeGreaterThanOrEqual(8);
      expect(place.left + DISTANCE_READOUT_WIDTH).toBeLessThanOrEqual(narrow.width - 8);
      const above = place.top + DISTANCE_READOUT_HEIGHT <= bar.y;
      const aside = place.left + DISTANCE_READOUT_WIDTH <= bar.x || place.left >= bar.x + bar.width;
      expect(above || aside || bar.y < DISTANCE_READOUT_HEIGHT + 12, `bar ${bar.index}`).toBe(true);
      expect(place.top + DISTANCE_READOUT_HEIGHT, `bar ${bar.index} is inside at the foot`).toBeLessThanOrEqual(narrow.height - 4);
    }
  });
});
