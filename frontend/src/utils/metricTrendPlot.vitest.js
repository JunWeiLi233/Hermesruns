import { describe, expect, it } from 'vitest';
import { buildMetricTrend } from './metricTrend';
import { buildTrendPlot, niceTicks } from './metricTrendPlot';

const TODAY = '2026-10-15';

function run(id, day, km, seconds, extra = {}) {
  return { id, name: `Run ${id}`, startTime: `${day}T07:00:00`, distanceKm: km, movingTimeSeconds: seconds, ...extra };
}

/** Eight runs a fortnight apart, each 10 seconds a kilometre quicker than the one before, from 6:00 a kilometre. */
function quickening(extra = () => ({})) {
  return Array.from({ length: 8 }, (_, index) => {
    const day = new Date(Date.UTC(2026, 6, 1 + index * 14)).toISOString().slice(0, 10);
    return run(index + 1, day, 5 + index * 0.5, (5 + index * 0.5) * (360 - index * 10), extra(index));
  });
}

describe('round numbers for an axis', () => {
  it('steps by 1, 2, 2.5 or 5 of a power of ten, from below the lowest to above the highest', () => {
    expect(niceTicks(5, 7.3)).toEqual([5, 5.5, 6, 6.5, 7, 7.5]);
    expect(niceTicks(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
    // 24 beats across, five or fewer steps wanted: 5 is the first of 1, 2, 2.5 and 5 that is wide enough.
    expect(niceTicks(138, 162)).toEqual([135, 140, 145, 150, 155, 160, 165]);
    // Metres for a heartbeat sit between 1 and 1.5: steps of a tenth, with no 1.2000000000000002 among them.
    expect(niceTicks(0.9, 1.35)).toEqual([0.9, 1, 1.1, 1.2, 1.3, 1.4]);
    expect(niceTicks(0, 3.3)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(4.2, 11.6)).toEqual([4, 6, 8, 10, 12]);
  });

  it('keeps a value that is a number of seconds on whole minutes and quarters of a minute', () => {
    expect(niceTicks(290, 330, { seconds: true })).toEqual([290, 300, 310, 320, 330]);
    expect(niceTicks(280, 400, { seconds: true })).toEqual([270, 300, 330, 360, 390, 420]);
    expect(niceTicks(900, 5400, { seconds: true })).toEqual([900, 1800, 2700, 3600, 4500, 5400]);
  });

  it('gives a span of nothing (one value, or all the same) a width of a tenth of the value, or 1 if that is less, centred on it', () => {
    // 5 is a tenth of 0.5 wide, which is under 1: so 4.5 to 5.5, and steps of 0.2 take that from 4.4 to 5.6.
    expect(niceTicks(5, 5)).toEqual([4.4, 4.6, 4.8, 5, 5.2, 5.4, 5.6]);
    expect(niceTicks(0, 0)).toEqual([-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]);
    // A heart rate of 150 gets 15 beats, 142.5 to 157.5, and steps of 5.
    expect(niceTicks(150, 150)).toEqual([140, 145, 150, 155, 160]);
    // 300 seconds gets 30, 285 to 315, and steps of 10 seconds.
    expect(niceTicks(300, 300, { seconds: true })).toEqual([280, 290, 300, 310, 320]);
  });
});

describe('the picture of a trend', () => {
  const model = () => buildMetricTrend(quickening(), { metric: 'pace', range: '6m', today: TODAY });

  it('has nothing to draw with no run', () => {
    expect(buildTrendPlot(buildMetricTrend([], { today: TODAY }))).toBeNull();
    expect(buildTrendPlot(null)).toBeNull();
  });

  it('turns the pace axis over so that a quicker run is higher up, and leaves every other value as it is', () => {
    const pace = buildTrendPlot(model());
    expect(pace.invert).toBe(true);
    const first = pace.dots[0];
    const last = pace.dots[pace.dots.length - 1];
    expect(last.point.value).toBeLessThan(first.point.value);
    expect(last.y).toBeLessThan(first.y);

    const distance = buildTrendPlot(buildMetricTrend(quickening(), { metric: 'distance', range: '6m', today: TODAY }));
    expect(distance.invert).toBe(false);
    expect(distance.dots[distance.dots.length - 1].y).toBeLessThan(distance.dots[0].y);
  });

  it('has a dot for each run, inside the plot, the later the further right, with the axis from the first day of the period to the end of today', () => {
    const plot = buildTrendPlot(model(), { width: 640, height: 270 });
    expect(plot.dots).toHaveLength(8);
    for (const dot of plot.dots) {
      expect(dot.x).toBeGreaterThanOrEqual(plot.padL);
      expect(dot.x).toBeLessThanOrEqual(plot.width - plot.padR);
      expect(dot.y).toBeGreaterThanOrEqual(plot.padT);
      expect(dot.y).toBeLessThanOrEqual(plot.baseline);
    }
    expect(plot.dots.map((dot) => dot.x)).toEqual([...plot.dots.map((dot) => dot.x)].sort((a, b) => a - b));
    expect(plot.xTicks[0].x).toBe(plot.padL);
    expect(plot.xTicks[plot.xTicks.length - 1].x).toBeCloseTo(plot.width - plot.padR, 8);
    expect(plot.xTicks).toHaveLength(4);
    expect(buildTrendPlot(model(), { width: 300, height: 230 }).xTicks).toHaveLength(3);
  });

  it('puts the middle inside the band, the band inside the axis, and the ticks round the lot', () => {
    const plot = buildTrendPlot(model());
    expect(plot.band.top).toBeLessThanOrEqual(plot.medianY);
    expect(plot.band.bottom).toBeGreaterThanOrEqual(plot.medianY);
    for (const dot of plot.dots) {
      expect(dot.y).toBeGreaterThanOrEqual(plot.padT);
      expect(dot.y).toBeLessThanOrEqual(plot.baseline);
    }
    const values = plot.yTicks.map((tick) => tick.value);
    expect(values[0]).toBeLessThanOrEqual(Math.min(...plot.dots.map((dot) => dot.point.value)));
    expect(values[values.length - 1]).toBeGreaterThanOrEqual(Math.max(...plot.dots.map((dot) => dot.point.value)));
    expect(values.every((value) => value % 5 === 0)).toBe(true);
  });

  it('draws the straight line from the first run to the last, and nothing for a line that needs more runs', () => {
    const plot = buildTrendPlot(model());
    expect(plot.straight).not.toBeNull();
    expect(plot.averagePath).toBeNull();
    expect(plot.straight.x1).toBeCloseTo(plot.dots[0].x, 8);
    expect(plot.straight.x2).toBeCloseTo(plot.dots[plot.dots.length - 1].x, 8);
    expect(plot.straight.y2).toBeLessThan(plot.straight.y1);
    const few = buildTrendPlot(buildMetricTrend(quickening().slice(0, 3), { metric: 'pace', range: '6m', today: TODAY }));
    expect(few.straight).toBeNull();
    expect(few.averagePath).toBeNull();
  });

  it('draws the moving average as a path through the runs from the fifth on', () => {
    const plot = buildTrendPlot(buildMetricTrend(quickening(), { metric: 'pace', line: 'average', range: '6m', today: TODAY }));
    expect(plot.straight).toBeNull();
    expect(plot.averagePath.startsWith('M')).toBe(true);
    expect((plot.averagePath.match(/L/g) || []).length).toBe(3);
  });

  it('does not run an axis below nothing for a value that cannot be negative, however near nothing the shortest run is', () => {
    const runs = [run(1, '2026-10-10', 0.05, 30), run(2, '2026-10-11', 5, 1500), run(3, '2026-10-12', 3, 900)];
    const plot = buildTrendPlot(buildMetricTrend(runs, { metric: 'distance', range: '3m', today: TODAY }));
    expect(plot.yTicks[0].value).toBe(0);
    expect(plot.yTicks.every((tick) => tick.value >= 0)).toBe(true);
  });

  it('copes with a single run: one dot, and a number for every place it is drawn', () => {
    const plot = buildTrendPlot(buildMetricTrend([run(1, '2026-10-10', 5, 1500)], { metric: 'distance', range: '3m', today: TODAY }));
    expect(plot.dots).toHaveLength(1);
    expect(plot.straight).toBeNull();
    for (const number of [plot.dots[0].x, plot.dots[0].y, plot.medianY, plot.band.top, plot.band.bottom]) expect(Number.isFinite(number)).toBe(true);
    expect(plot.yTicks.map((tick) => tick.value)).toContain(5);
  });

  it('is in miles when the runner counts in them: a pace in seconds a mile and a distance in miles, with ticks that are round in those', () => {
    const km = buildTrendPlot(model(), { unit: 'km' });
    const mile = buildTrendPlot(model(), { unit: 'mile' });
    // The runs run from 360 to 290 seconds a kilometre: 579 to 467 a mile. The axis is in seconds a mile, on round numbers, and covers all of them.
    expect(km.yTicks.map((tick) => tick.value).every((value) => value % 5 === 0)).toBe(true);
    const ticks = mile.yTicks.map((tick) => tick.value);
    expect(ticks.every((value) => value % 10 === 0)).toBe(true);
    expect(Math.min(...ticks)).toBeLessThanOrEqual(290 * 1.609344);
    expect(Math.max(...ticks)).toBeGreaterThanOrEqual(360 * 1.609344);
    expect(Math.max(...ticks)).toBeLessThan(700);
    // The quickest run is the highest dot in either unit, and every dot is inside the plot.
    for (const plot of [km, mile]) {
      const ys = plot.dots.map((dot) => dot.y);
      expect(ys.indexOf(Math.min(...ys))).toBe(ys.length - 1);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(plot.padT);
      expect(Math.max(...ys)).toBeLessThanOrEqual(plot.baseline);
    }

    const distanceKm = buildTrendPlot(buildMetricTrend(quickening(), { metric: 'distance', range: '6m', today: TODAY }), { unit: 'km' });
    const distanceMi = buildTrendPlot(buildMetricTrend(quickening(), { metric: 'distance', range: '6m', today: TODAY }), { unit: 'mile' });
    expect(Math.max(...distanceMi.yTicks.map((tick) => tick.value))).toBeLessThan(Math.max(...distanceKm.yTicks.map((tick) => tick.value)));
    expect(distanceMi.dots[0].point.value).toBe(5);
  });

  it('does not change a value that has no unit of distance when the unit does', () => {
    const heart = (unit) => buildTrendPlot(buildMetricTrend(quickening((index) => ({ averageHeartRate: 150 + index })), { metric: 'heartRate', range: '6m', today: TODAY }), { unit });
    expect(heart('mile').yTicks).toEqual(heart('km').yTicks);
  });

  it('gives each metric steps that mean something: whole beats and steps, never 2.5, and hundredths of a metre for a heartbeat', () => {
    const wobble = (index) => ({ averageHeartRate: 138 + index * 1.7, averageCadence: 160 + index * 1.3 });
    const heart = buildTrendPlot(buildMetricTrend(quickening(wobble), { metric: 'heartRate', range: '6m', today: TODAY }));
    expect(heart.yTicks.map((tick) => tick.value).every(Number.isInteger)).toBe(true);
    const cadence = buildTrendPlot(buildMetricTrend(quickening(wobble), { metric: 'cadence', range: '6m', today: TODAY }));
    expect(cadence.yTicks.map((tick) => tick.value).every(Number.isInteger)).toBe(true);
    const efficiency = buildTrendPlot(buildMetricTrend(quickening(wobble), { metric: 'efficiency', range: '6m', today: TODAY }));
    expect(efficiency.yTicks.map((tick) => tick.value).every((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9)).toBe(true);
    expect(efficiency.yTicks.length).toBeGreaterThan(2);
  });

  it('leaves a line above the first tick for the unit of the axis', () => {
    const plot = buildTrendPlot(model());
    expect(plot.padT).toBeGreaterThanOrEqual(24);
    expect(plot.yTicks[0].y).toBeGreaterThanOrEqual(plot.padT);
  });

  it('keeps a heart rate off zero when every run is far above it', () => {
    const plot = buildTrendPlot(buildMetricTrend(quickening((index) => ({ averageHeartRate: 150 + index })), { metric: 'heartRate', range: '6m', today: TODAY }));
    expect(plot.yTicks[0].value).toBeGreaterThan(100);
  });
});
