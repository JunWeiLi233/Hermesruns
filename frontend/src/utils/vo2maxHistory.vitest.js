import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HISTORY_RANGE,
  FIRM_POINT_RUNS,
  HISTORY_RANGES,
  averageOfPoints,
  buildHistoryPlot,
  buildVo2maxHistory,
  historyRangeStart,
  historyTooltipPosition,
} from './vo2maxHistory';

// The estimates the history works out are counted, so a case can say how much work a long history is without timing it.
const counted = vi.hoisted(() => ({ estimates: 0 }));
vi.mock('./vdot', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, buildVdotEntry: (...args) => { counted.estimates += 1; return actual.buildVdotEntry(...args); } };
});

const DAY = 24 * 60 * 60 * 1000;
/** A day in the middle of October 2026, noon UTC. */
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);

const run = (id, daysAgo, km, minutes, extra = {}) => ({
  id, name: `Run ${id}`, startTime: new Date(NOW - daysAgo * DAY).toISOString(), distanceKm: km, movingTimeSeconds: Math.round(minutes * 60), ...extra,
});

// Daniels and Gilbert's equations, written out again here so the module is checked against the formula and not against itself.
const cost = (velocity) => -4.6 + 0.182258 * velocity + 0.000104 * velocity * velocity;
const fraction = (minutes) => 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
const vdotOf = (meters, minutes) => cost(meters / minutes) / fraction(minutes);
const round1 = (value) => Math.round(value * 10) / 10;

describe('the rule', () => {
  it('has a line over six months, a year or all of it, and a point is firm from the mean of three runs', () => {
    expect(HISTORY_RANGES.map((range) => range.key)).toEqual(['6m', '1y', 'all']);
    expect(DEFAULT_HISTORY_RANGE).toBe('1y');
    expect(FIRM_POINT_RUNS).toBe(3);
  });

  it('starts a range that many days back, and all of it at the beginning of the runs', () => {
    expect(historyRangeStart('6m', NOW)).toBe(NOW - 182 * DAY);
    expect(historyRangeStart('1y', NOW)).toBe(NOW - 365 * DAY);
    expect(historyRangeStart('all', NOW)).toBeNull();
    expect(historyRangeStart('nonsense', NOW)).toBe(historyRangeStart(DEFAULT_HISTORY_RANGE, NOW));
  });
});

describe('buildVo2maxHistory', () => {
  it('has nothing without runs, or with none that gives an estimate', () => {
    for (const runs of [null, undefined, [], [run(1, 5, 0.9, 5)], [run(1, 5, 5, 0)], [run(1, 5, 5, 25, { startTime: 'never' })]]) {
      const history = buildVo2maxHistory(runs, { now: NOW });
      expect(history.points).toEqual([]);
      expect(history.now).toBeNull();
    }
  });

  it('is the number as it stood after each run: one run a point of one run, then of two, then of three', () => {
    const runs = [run(1, 12, 5, 25), run(2, 8, 5, 24), run(3, 4, 5, 23)];
    const { points } = buildVo2maxHistory(runs, { now: NOW });
    const [a, b, c] = [vdotOf(5000, 25), vdotOf(5000, 24), vdotOf(5000, 23)];

    expect(points.slice(0, 3).map((point) => point.id)).toEqual([1, 2, 3]);
    expect(points[0].value).toBe(round1(a));
    expect(points[1].value).toBe(round1((a + b) / 2));
    expect(points[2].value).toBe(round1((a + b + c) / 3));
    expect(points.slice(0, 3).map((point) => point.usedCount)).toEqual([1, 2, 3]);
    expect(points.slice(0, 3).map((point) => point.firm)).toEqual([false, false, true]);
  });

  it('ends at the number of today, which is a point of its own at the moment now', () => {
    const runs = [run(1, 12, 5, 25), run(2, 8, 5, 24), run(3, 4, 5, 23)];
    const history = buildVo2maxHistory(runs, { now: NOW });
    const last = history.points[history.points.length - 1];

    expect(history.points).toHaveLength(4);
    expect(last).toMatchObject({ now: true, time: NOW, firm: true, id: null });
    expect(last.value).toBe(history.now);
    expect(history.now).toBe(round1((vdotOf(5000, 25) + vdotOf(5000, 24) + vdotOf(5000, 23)) / 3));
  });

  it('lets the quick run of a long time ago drop out of the number, and has no number today when every run has aged out', () => {
    const runs = [run(1, 200, 5, 22), run(2, 80, 5, 25), run(3, 78, 5, 25), run(4, 76, 5, 25)];
    const history = buildVo2maxHistory(runs, { now: NOW });

    expect(history.points[0].value).toBe(round1(vdotOf(5000, 22)));
    // The quick run is 120 days older than the next: it is not in the window of the points after it, nor of today's.
    expect(history.points[1].value).toBe(round1(vdotOf(5000, 25)));
    expect(history.points[3].value).toBe(round1(vdotOf(5000, 25)));
    expect(history.now).toBe(round1(vdotOf(5000, 25)));

    // Twenty days on, the three runs of 76 to 80 days ago are 96 to 100 days old: nothing is left to make a number of.
    const later = buildVo2maxHistory(runs, { now: NOW + 20 * DAY });
    expect(later.now).toBeNull();
    expect(later.points).toHaveLength(4);
    expect(later.points.every((point) => !point.now)).toBe(true);
    expect(later.years[0].end).toBe(round1(vdotOf(5000, 25)));
  });

  it('works each point out from what there was by then: the highest heart rate and the median pace of that day, not of today', () => {
    const early = run(1, 10, 10, 50, { averageHeartRate: 150, maxHeartRate: 180 });
    const late = run(2, 5, 8, 40, { averageHeartRate: 148, maxHeartRate: 190 });
    const { points } = buildVo2maxHistory([early, late], { now: NOW });
    const earlyEstimate = (peak) => cost(10000 / 50) / (150 / peak);
    const lateEstimate = cost(8000 / 40) / (148 / 190);

    // After the first run the highest heart rate on record is 180; after the second it is 190, and the first run's estimate moves with it.
    expect(points[0].value).toBe(round1(earlyEstimate(180)));
    expect(points[1].value).toBe(round1((earlyEstimate(190) + lateEstimate) / 2));
    expect(earlyEstimate(190)).not.toBeCloseTo(earlyEstimate(180), 0);
  });

  it('keeps a run to its own day in the order it was run, whatever order it was given in', () => {
    const runs = [run(3, 4, 5, 23), run(1, 12, 5, 25), run(2, 8, 5, 24)];
    expect(buildVo2maxHistory(runs, { now: NOW }).points.slice(0, 3).map((point) => point.id)).toEqual([1, 2, 3]);
  });

  it('counts the runs and the distance of each year, newest year first, and marks the year it is now', () => {
    const june2025 = Date.UTC(2025, 5, 15, 12);
    const may2026 = Date.UTC(2026, 4, 15, 12);
    const at = (id, time, km, minutes) => ({ id, name: `Run ${id}`, startTime: new Date(time).toISOString(), distanceKm: km, movingTimeSeconds: Math.round(minutes * 60) });
    const runs = [at(1, june2025, 5, 25), at(2, june2025 + DAY, 8, 40), at(3, june2025 + 2 * DAY, 10, 50), at(4, may2026, 6, 30), at(5, may2026 + DAY, 6, 30), at(6, NOW - 2 * DAY, 12, 60)];
    const { years } = buildVo2maxHistory(runs, { now: NOW });

    expect(years.map((row) => row.year)).toEqual([2026, 2025]);
    expect(years.map((row) => row.runs)).toEqual([3, 3]);
    expect(years[0].km).toBe(24);
    expect(years[1].km).toBe(23);
    expect(years.map((row) => row.current)).toEqual([true, false]);
  });

  it('uses account calendar years and year-end boundaries while preserving instant-based estimates and geometry', () => {
    const starts = ['2025-12-29T10:50:00Z', '2025-12-30T10:50:00Z', '2025-12-31T10:50:00Z', '2025-12-31T11:10:00Z'];
    const days = ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01'];
    const runs = starts.map((startTime, index) => ({
      id: index + 1, startTime, activityInstant: startTime, accountLocalDate: days[index],
      accountLocalTime: index === 3 ? '00:10:00' : '23:50:00', accountTimeZone: 'Pacific/Auckland',
      distanceKm: 5, movingTimeSeconds: (25 - index) * 60,
    }));
    const now = Date.parse('2025-12-31T11:20:00Z');
    const history = buildVo2maxHistory(runs, { now });
    expect(history.years.map(row => [row.year, row.runs, row.km, row.current])).toEqual([[2026, 1, 5, true], [2025, 3, 15, false]]);
    expect(history.years[1].average.days).toBeCloseTo(10 / 1440, 8);
    expect(history.years[0].average.days).toBeCloseTo(10 / 1440, 8);
    expect(history.years[0].high.date.getFullYear()).toBe(2026);
    expect(history.points.slice(0, 4).map(point => point.time)).toEqual(starts.map(Date.parse));
    const withoutCalendar = buildVo2maxHistory(runs.map(({ id, startTime, distanceKm, movingTimeSeconds }) => ({ id, startTime, distanceKm, movingTimeSeconds })), { now });
    expect(history.points.map(point => [point.time, point.value])).toEqual(withoutCalendar.points.map(point => [point.time, point.value]));
  });

  it('takes the highest, the lowest and the end of a year from its points, and only a firm point can be the highest or the lowest', () => {
    const june = Date.UTC(2025, 5, 15, 12);
    const at = (id, days, minutes) => ({ id, name: `Run ${id}`, startTime: new Date(june + days * DAY).toISOString(), distanceKm: 5, movingTimeSeconds: Math.round(minutes * 60) });
    // Estimates fall and then rise: 5 km in 26, 25, 24 (the third is the first firm point), then 22, 21, 20 minutes.
    const runs = [at(1, 0, 26), at(2, 3, 25), at(3, 6, 24), at(4, 9, 22), at(5, 12, 21), at(6, 15, 20)];
    const { points, years } = buildVo2maxHistory(runs, { now: Date.UTC(2025, 5, 30, 12) });
    const [row] = years;

    expect(points.slice(0, 6).map((point) => point.firm)).toEqual([false, false, true, true, true, true]);
    const firm = points.filter((point) => point.firm);
    expect(row.high.value).toBe(Math.max(...firm.map((point) => point.value)));
    expect(row.low.value).toBe(Math.min(...firm.map((point) => point.value)));
    // The first point is lower than every firm one but is a single run's number and is not the lowest.
    expect(points[0].value).toBeLessThan(row.low.value);
    expect(row.end).toBe(points[points.length - 1].value);
  });

  it('gives each year the average of its own points, each for the days it stood, to the end of the year or to today', () => {
    const june = Date.UTC(2025, 5, 15, 12);
    const at = (id, days, minutes) => ({ id, name: `Run ${id}`, startTime: new Date(june + days * DAY).toISOString(), distanceKm: 5, movingTimeSeconds: Math.round(minutes * 60) });
    // The first firm point is the third run's; today is the 15th of July, 30 days after the first run and 15 after the last.
    const runs = [at(1, 0, 26), at(2, 3, 25), at(3, 6, 24), at(4, 9, 22), at(5, 12, 21), at(6, 15, 20)];
    const { points, years } = buildVo2maxHistory(runs, { now: june + 30 * DAY });
    const [, , third, fourth, fifth, sixth] = points;

    // 24 days of firm numbers: three for three days each and the last run's for the 15 days to today (the point of today itself stands no time).
    expect(years[0].average.days).toBeCloseTo(24, 6);
    expect(years[0].average.value).toBeCloseTo((third.value * 3 + fourth.value * 3 + fifth.value * 3 + sixth.value * 15) / 24, 9);
  });

  it('stops the average of a past year at its end, and lets a number stand 90 days at most', () => {
    const june2025 = Date.UTC(2025, 5, 15, 12);
    const at = (id, time, minutes) => ({ id, name: `Run ${id}`, startTime: new Date(time).toISOString(), distanceKm: 5, movingTimeSeconds: Math.round(minutes * 60) });
    // Three runs in June 2025, then nothing until May 2026: the last of 2025 stands for 90 days, not for the seven months of silence.
    const runs = [at(1, june2025, 25), at(2, june2025 + DAY, 24), at(3, june2025 + 2 * DAY, 23), at(4, Date.UTC(2026, 4, 15, 12), 22), at(5, Date.UTC(2026, 4, 16, 12), 22), at(6, Date.UTC(2026, 4, 17, 12), 22)];
    const { points, years } = buildVo2maxHistory(runs, { now: Date.UTC(2026, 5, 1, 12) });
    const last2025 = points[2];

    expect(years.map((row) => row.year)).toEqual([2026, 2025]);
    expect(years[1].average.days).toBeCloseTo(90, 6);
    expect(years[1].average.value).toBeCloseTo(last2025.value, 9);
    // In 2026 the three of May stand: the first two are thin; the third stands from the 17th of May to the 1st of June, 15 days.
    expect(years[0].average.days).toBeCloseTo(15, 6);
    expect(years[0].average.value).toBeCloseTo(points[5].value, 9);
  });

  it('has no average for a year with no firm point that stood any time', () => {
    const june = Date.UTC(2025, 5, 15, 12);
    const at = (id, days, minutes) => ({ id, name: `Run ${id}`, startTime: new Date(june + days * DAY).toISOString(), distanceKm: 5, movingTimeSeconds: Math.round(minutes * 60) });
    const { years } = buildVo2maxHistory([at(1, 0, 26), at(2, 3, 25)], { now: Date.UTC(2025, 5, 30, 12) });

    expect(years[0].average).toBeNull();
    expect(years[0].high).toBeNull();
  });

  it('is a pure function of its input', () => {
    const runs = [run(1, 12, 5, 25), run(2, 8, 5, 24), run(3, 4, 5, 23)];
    expect(buildVo2maxHistory(runs, { now: NOW })).toEqual(buildVo2maxHistory(runs, { now: NOW }));
  });

  it('looks back 90 days from each run and no further: the work grows with the number of runs, not with its square', () => {
    // A run a day for three thousand days: 91 runs fall in the 90 days up to and including each, so about 91 estimates a point, and one more for each run
    // for the number today. Looking at every earlier run would be four and a half million.
    const daily = Array.from({ length: 3000 }, (_, index) => run(index + 1, 3000 - index, 5, 25 + (index % 5)));
    counted.estimates = 0;
    const history = buildVo2maxHistory(daily, { now: NOW });

    expect(history.points.length).toBeGreaterThan(2900);
    expect(counted.estimates).toBeLessThan(3000 * 95);
    expect(counted.estimates).toBeGreaterThan(3000 * 85);
  });

  it('is quick for a long history: five thousand runs', () => {
    const many = Array.from({ length: 5000 }, (_, index) => run(index + 1, 1700 - index * 0.33, 5 + (index % 7), 25 + (index % 11), { averageHeartRate: 140 + (index % 9), maxHeartRate: 185 }));
    const started = Date.now();
    const history = buildVo2maxHistory(many, { now: NOW });

    expect(history.points.length).toBeGreaterThan(4000);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});

describe('buildHistoryPlot', () => {
  const runs = [run(1, 200, 5, 26), run(2, 150, 5, 25), run(3, 100, 5, 24), run(4, 60, 5, 23), run(5, 30, 5, 22), run(6, 5, 5, 21)];
  const { points } = buildVo2maxHistory(runs, { now: NOW });

  it('has nothing to draw with no point in the range', () => {
    expect(buildHistoryPlot({ points: [], now: NOW })).toBeNull();
    expect(buildHistoryPlot({ points, start: NOW + DAY, now: NOW })).toBeNull();
    expect(buildHistoryPlot({ points: null, now: NOW })).toBeNull();
  });

  it('puts the days from left to right and a higher number higher up, inside the plot', () => {
    const plot = buildHistoryPlot({ points, now: NOW, width: 640, height: 260 });

    expect(plot.dots).toHaveLength(points.length);
    for (let index = 1; index < plot.dots.length; index += 1) expect(plot.dots[index].x).toBeGreaterThan(plot.dots[index - 1].x);
    const top = plot.dots.reduce((best, dot) => (dot.point.value > best.point.value ? dot : best));
    const bottom = plot.dots.reduce((best, dot) => (dot.point.value < best.point.value ? dot : best));
    expect(top.y).toBeLessThan(bottom.y);
    for (const dot of plot.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(plot.padL);
      expect(dot.x).toBeLessThanOrEqual(plot.width - plot.padR + 1e-6);
      expect(dot.y).toBeGreaterThanOrEqual(plot.padT - 1e-6);
      expect(dot.y).toBeLessThanOrEqual(plot.baseline + 1e-6);
    }
    expect(plot.path.startsWith('M')).toBe(true);
    expect(plot.path.split('L')).toHaveLength(points.length);
    expect(plot.to).toBe(NOW);
  });

  it('draws only the points of the range, from where it starts', () => {
    const all = buildHistoryPlot({ points, now: NOW });
    const year = buildHistoryPlot({ points, start: NOW - 90 * DAY, now: NOW });

    expect(year.dots.length).toBeLessThan(all.dots.length);
    expect(year.dots.every((dot) => dot.point.time >= NOW - 90 * DAY)).toBe(true);
    expect(year.from).toBe(NOW - 90 * DAY);
    expect(all.from).toBe(points[0].time);
  });

  it('marks the highest and the lowest firm point of the range, and none that is not firm', () => {
    const plot = buildHistoryPlot({ points, now: NOW });
    const firm = points.filter((point) => point.firm);

    expect(plot.highest.point.value).toBe(Math.max(...firm.map((point) => point.value)));
    expect(plot.lowest.point.value).toBe(Math.min(...firm.map((point) => point.value)));
    expect(plot.highest.point.firm && plot.lowest.point.firm).toBe(true);
    // A range with only thin points has neither.
    const thin = buildHistoryPlot({ points: points.slice(0, 2), now: NOW });
    expect(thin.highest).toBeNull();
    expect(thin.lowest).toBeNull();
  });

  it('gives the average of the points it draws: the same numbers the dots show, each for the days it stood', () => {
    const plot = buildHistoryPlot({ points, now: NOW });
    const expected = averageOfPoints(points, { to: NOW });
    const firm = points.filter((point) => point.firm);

    expect(plot.average).toEqual(expected);
    expect(plot.average.value).toBeGreaterThanOrEqual(Math.min(...firm.map((point) => point.value)));
    expect(plot.average.value).toBeLessThanOrEqual(Math.max(...firm.map((point) => point.value)));
    // Only the points of the range count, and the first of them starts the stretch.
    const year = buildHistoryPlot({ points, start: NOW - 40 * DAY, now: NOW });
    expect(year.average).toEqual(averageOfPoints(points.filter((point) => point.time >= NOW - 40 * DAY), { to: NOW }));
    expect(year.average.days).toBeLessThan(plot.average.days);
    // A range with only thin points has none.
    expect(buildHistoryPlot({ points: points.slice(0, 2), now: NOW }).average).toBeNull();
  });

  it('gives the axis whole-number steps with room above and below, and at least four points of height', () => {
    const flat = buildHistoryPlot({ points: [{ time: NOW - DAY, value: 45, firm: true }, { time: NOW, value: 45.2, firm: true }], now: NOW });

    expect(flat.yTicks.length).toBeGreaterThanOrEqual(3);
    expect(flat.yTicks.every((tick) => Number.isInteger(tick.value))).toBe(true);
    expect(flat.yTicks[flat.yTicks.length - 1].value - flat.yTicks[0].value).toBeGreaterThanOrEqual(3);
    expect(flat.xTicks).toHaveLength(4);
    expect(buildHistoryPlot({ points: [{ time: NOW, value: 45, firm: true }], now: NOW, width: 300 }).xTicks).toHaveLength(3);
  });
});

describe('historyTooltipPosition', () => {
  const plot = { width: 640, height: 270 };
  const box = { width: 208, height: 100 };

  it('centres the readout on the point and puts it above, when there is room', () => {
    const place = historyTooltipPosition({ x: 300, y: 200 }, plot, box);
    expect(place).toEqual({ left: 196, top: 86 });
  });

  it('puts it below the point when there is no room above it', () => {
    const place = historyTooltipPosition({ x: 300, y: 60 }, plot, box);
    expect(place.top).toBe(74);
  });

  it('keeps it inside the plot sideways, at the left and at the right edge', () => {
    expect(historyTooltipPosition({ x: 20, y: 200 }, plot, box).left).toBe(8);
    const right = historyTooltipPosition({ x: 630, y: 200 }, plot, box);
    expect(right.left + box.width).toBe(plot.width - 8);
  });

  it('stays inside the plot sideways, wherever the point is, for a readout as wide as the plot allows', () => {
    const narrow = { width: 200, height: 230 };
    for (const x of [8, 100, 190]) {
      const place = historyTooltipPosition({ x, y: 100 }, narrow, { width: 184, height: 100 });
      expect(place.left).toBeGreaterThanOrEqual(8);
      expect(place.left + 184).toBeLessThanOrEqual(narrow.width - 8);
    }
  });

  it('is placed by the size the readout has: taller (the text made larger) it goes higher, wider it moves further from the edge', () => {
    const usual = historyTooltipPosition({ x: 600, y: 200 }, plot, { width: 208, height: 84 });
    const larger = historyTooltipPosition({ x: 600, y: 200 }, plot, { width: 416, height: 168 });
    expect(larger.top).toBeLessThan(usual.top);
    expect(usual.top + 84).toBeLessThanOrEqual(200 - 9);
    expect(larger.top + 168).toBeLessThanOrEqual(200 - 9);
    expect(larger.left + 416).toBeLessThanOrEqual(plot.width - 8);
    expect(historyTooltipPosition({ x: 100, y: 100 }, { width: 200, height: 230 }, { width: 300, height: 100 }).left).toBe(8);
  });

  it('is never over the point, at any height of it, on a wide plot or a narrow one: the ring round a point is 9 units', () => {
    for (const shape of [{ width: 640, height: 270 }, { width: 300, height: 230 }]) {
      for (let y = 10; y <= shape.height - 30; y += 5) {
        for (const x of [20, shape.width / 2, shape.width - 20]) {
          const place = historyTooltipPosition({ x, y }, shape, { width: 208, height: 100 });
          const clear = place.top + 100 <= y - 9 || place.top >= y + 9;
          expect(clear, `a point at ${x}, ${y} on a plot ${shape.width} wide: the readout is at ${place.top}`).toBe(true);
          expect(place.top).toBeGreaterThanOrEqual(4);
          expect(place.top + 100).toBeLessThanOrEqual(shape.height - 4);
        }
      }
    }
  });
});

describe('averageOfPoints', () => {
  const at = (daysAgo, value, firm = true) => ({ time: NOW - daysAgo * DAY, value, firm });

  it('gives each firm point the days it stood, from its run to the next point, and the last one to today', () => {
    const result = averageOfPoints([at(30, 40), at(20, 42), at(10, 41)], { to: NOW });

    expect(result.days).toBeCloseTo(30, 9);
    expect(result.value).toBeCloseTo((40 * 10 + 42 * 10 + 41 * 10) / 30, 9);
  });

  it('is not the mean of the points: a number that stood longer counts for more', () => {
    const result = averageOfPoints([at(40, 40), at(10, 44), at(9, 44), at(8, 44)], { to: NOW });

    // 40 stood 30 days, and the three 44s 1, 1 and 8 days.
    expect(result.value).toBeCloseTo((40 * 30 + 44 * 10) / 40, 9);
    expect(result.value).not.toBeCloseTo((40 + 44 + 44 + 44) / 4, 1);
  });

  it('lets a number stand 90 days at most, because with no run for 90 days there is no number left', () => {
    const result = averageOfPoints([at(200, 40), at(10, 44)], { to: NOW });

    expect(result.days).toBeCloseTo(100, 9);
    expect(result.value).toBeCloseTo((40 * 90 + 44 * 10) / 100, 9);
    // The last point holds to today only for 90 days too.
    expect(averageOfPoints([at(150, 40)], { to: NOW }).days).toBeCloseTo(90, 9);
  });

  it('leaves out thin points, which still end the stand of the point before them', () => {
    const result = averageOfPoints([at(30, 40), at(20, 30, false), at(10, 42)], { to: NOW });

    // 40 stood from day 30 to day 20 (the thin point), 42 from day 10 to today; the thin 30 counts for nothing.
    expect(result.days).toBeCloseTo(20, 9);
    expect(result.value).toBeCloseTo((40 * 10 + 42 * 10) / 20, 9);
  });

  it('is nothing when no firm point stood any time', () => {
    expect(averageOfPoints([], { to: NOW })).toBeNull();
    expect(averageOfPoints([at(5, 40, false), at(2, 41, false)], { to: NOW })).toBeNull();
    expect(averageOfPoints([{ time: NOW, value: 40, firm: true }], { to: NOW })).toBeNull();
    expect(averageOfPoints([{ time: NOW + DAY, value: 40, firm: true }], { to: NOW })).toBeNull();
  });

  it('agrees with counting the days one hour at a time', () => {
    // The number at each hour is the last point at or before it, while it is less than 90 days old and firm.
    let seed = 11;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const points = [];
    let time = NOW - 400 * DAY;
    for (let index = 0; index < 40; index += 1) {
      time += (1 + random() * 25) * DAY;
      points.push({ time, value: Math.round((35 + random() * 12) * 10) / 10, firm: random() > 0.25 });
    }
    const to = NOW;
    let sum = 0;
    let hours = 0;
    for (let moment = points[0].time; moment < to; moment += DAY / 24) {
      const current = [...points].reverse().find((point) => point.time <= moment);
      if (current && current.firm && moment - current.time < 90 * DAY) {
        sum += current.value;
        hours += 1;
      }
    }
    const result = averageOfPoints(points.filter((point) => point.time < to), { to });

    expect(result.days).toBeCloseTo(hours / 24, 0);
    expect(result.value).toBeCloseTo(sum / hours, 1);
  });

  it('lies between the lowest and the highest firm point whatever the points are', () => {
    const points = [at(300, 38), at(250, 44.5), at(180, 36.2, false), at(120, 41), at(60, 39.9), at(20, 43.1)];
    const { value } = averageOfPoints(points, { to: NOW });
    const firm = points.filter((point) => point.firm).map((point) => point.value);

    expect(value).toBeGreaterThanOrEqual(Math.min(...firm));
    expect(value).toBeLessThanOrEqual(Math.max(...firm));
  });
});
