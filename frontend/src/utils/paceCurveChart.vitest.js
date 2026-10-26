import { describe, expect, it } from 'vitest';
import { noPoints, paceCurve, twoPoints } from '../pages/analysis/__tests__/paceCurveFixtures';
import { DEFAULT_WINDOW, KM_PER_MILE, WINDOWS, buildPaceCurve, modelPace, paceForUnit, windowOf } from './paceCurveChart';

const answer = paceCurve();

describe('the pace of the line', () => {
  it('is a time over what the line says that time covers, in seconds a kilometre', () => {
    // 1200 s on d = 200 + 4 t is 5000 m: 240 s a kilometre. As the effort gets longer the pace tends to 1000 / CS = 250.
    expect(modelPace(1200, 4, 200)).toBeCloseTo(240, 9);
    expect(modelPace(1e9, 4, 200)).toBeCloseTo(250, 3);
    expect(modelPace(60, 4, 200)).toBeLessThan(modelPace(600, 4, 200));
  });

  it('is in miles when the runner reads miles', () => {
    expect(paceForUnit(240, 'km')).toBe(240);
    expect(paceForUnit(240, 'mile')).toBeCloseTo(240 * KM_PER_MILE, 9);
  });
});

describe('the windows', () => {
  it('offers three months, six, twelve and all time, with six as the default', () => {
    expect(WINDOWS.map((option) => option.key)).toEqual(['90', '180', '365', 'all']);
    expect(WINDOWS.map((option) => option.days)).toEqual([90, 180, 365, null]);
    expect(DEFAULT_WINDOW).toBe('180');
  });

  it('takes anything else for the default', () => {
    expect(windowOf('365').days).toBe(365);
    expect(windowOf('all').days).toBeNull();
    expect(windowOf('7').key).toBe('180');
    expect(windowOf(undefined).key).toBe('180');
    expect(windowOf(null).key).toBe('180');
  });
});

describe('buildPaceCurve', () => {
  it('has nothing to draw without efforts, and skips one that is not a time and a pace', () => {
    expect(buildPaceCurve({ points: [], model: answer.model })).toBeNull();
    expect(buildPaceCurve({})).toBeNull();
    expect(buildPaceCurve({ points: [null, { seconds: 0, paceSecondsPerKm: 200 }, { seconds: 300, paceSecondsPerKm: Number.NaN }] })).toBeNull();
    expect(buildPaceCurve({ points: noPoints().points })).toBeNull();
  });

  it('puts a longer effort to the right of a shorter one and a faster pace above a slower one', () => {
    const chart = buildPaceCurve({ points: answer.points, model: answer.model });
    const byKey = Object.fromEntries(chart.dots.map((dot) => [dot.point.key, dot]));

    expect(chart.dots).toHaveLength(6);
    expect(byKey.half_mile.x).toBeLessThan(byKey['1km'].x);
    expect(byKey['1km'].x).toBeLessThan(byKey['1mile'].x);
    expect(byKey['3km'].x).toBeLessThan(byKey['5km'].x);
    expect(byKey['5km'].x).toBeLessThan(byKey['10km'].x);
    // The half mile is the fastest pace, the 10 km the slowest: the fast one is higher (smaller y).
    expect(byKey.half_mile.y).toBeLessThan(byKey['10km'].y);
    chart.dots.forEach((dot) => {
      expect(dot.x).toBeGreaterThanOrEqual(chart.padL);
      expect(dot.x).toBeLessThanOrEqual(chart.width - chart.padR);
      expect(dot.y).toBeGreaterThanOrEqual(chart.padT);
      expect(dot.y).toBeLessThanOrEqual(chart.baseline);
    });
  });

  it('spaces the time axis by the logarithm, so doubling an effort moves it by the same distance anywhere', () => {
    const chart = buildPaceCurve({
      points: [
        { key: 'a', seconds: 150, paceSecondsPerKm: 200, inModel: false },
        { key: 'b', seconds: 300, paceSecondsPerKm: 210, inModel: false },
        { key: 'c', seconds: 600, paceSecondsPerKm: 220, inModel: false },
        { key: 'd', seconds: 1200, paceSecondsPerKm: 230, inModel: false },
      ],
    });
    const gaps = chart.dots.slice(1).map((dot, index) => dot.x - chart.dots[index].x);

    expect(gaps[1]).toBeCloseTo(gaps[0], 6);
    expect(gaps[2]).toBeCloseTo(gaps[0], 6);
  });

  it('counts miles when asked: the same dots, each pace a mile and a bit longer', () => {
    const km = buildPaceCurve({ points: answer.points, model: answer.model, unit: 'km' });
    const mile = buildPaceCurve({ points: answer.points, model: answer.model, unit: 'mile' });

    expect(mile.unit).toBe('mile');
    mile.dots.forEach((dot, index) => expect(dot.pace).toBeCloseTo(km.dots[index].pace * KM_PER_MILE, 9));
    expect(mile.critical.pace).toBeCloseTo(250 * KM_PER_MILE, 6);
  });

  it('draws the line only when the fit has numbers, solid where it was fitted and dashed all the way along the axis', () => {
    const chart = buildPaceCurve({ points: answer.points, model: answer.model });

    expect(chart.curve.dashed.startsWith('M')).toBe(true);
    expect(chart.curve.solid.startsWith('M')).toBe(true);
    const firstX = (path) => Number(path.slice(1).split(',')[0]);
    const lastX = (path) => Number(path.split(' ').pop().split(',')[0].replace('L', ''));
    const byKey = Object.fromEntries(chart.dots.map((dot) => [dot.point.key, dot]));
    // The solid stretch runs from the shortest effort in the fit (1 km) to the longest (5 km), the dashed one past both.
    expect(firstX(chart.curve.solid)).toBeCloseTo(byKey['1km'].x, 1);
    expect(lastX(chart.curve.solid)).toBeCloseTo(byKey['5km'].x, 1);
    expect(firstX(chart.curve.dashed)).toBeLessThan(firstX(chart.curve.solid));
    expect(lastX(chart.curve.dashed)).toBeGreaterThan(lastX(chart.curve.solid));

    const none = buildPaceCurve({ points: twoPoints().points, model: twoPoints().model });
    expect(none.curve).toBeNull();
    expect(none.critical).toBeNull();
  });

  it('puts the critical pace line at the pace of the critical speed, below every dot on the line', () => {
    const chart = buildPaceCurve({ points: answer.points, model: answer.model });

    expect(chart.critical.pace).toBeCloseTo(250, 9);
    chart.dots.forEach((dot) => expect(chart.critical.y).toBeGreaterThan(dot.y));
  });

  it('puts the dots on the line it fitted them to', () => {
    const chart = buildPaceCurve({ points: answer.points, model: answer.model });
    const onLine = chart.dots.filter((dot) => dot.point.inModel);

    onLine.forEach((dot) => {
      const expected = modelPace(dot.point.seconds, answer.model.criticalSpeedMps, answer.model.dPrimeMeters);
      expect(dot.pace).toBeCloseTo(expected, 0);
    });
  });

  it('keeps every tick inside the plot and labels the axes with round numbers that reach past the data', () => {
    const chart = buildPaceCurve({ points: answer.points, model: answer.model, width: 720, height: 340 });

    expect(chart.xTicks.length).toBeGreaterThanOrEqual(3);
    chart.xTicks.forEach((tick, index) => {
      expect(tick.x).toBeGreaterThanOrEqual(chart.padL - 1e-6);
      expect(tick.x).toBeLessThanOrEqual(chart.width - chart.padR + 1e-6);
      if (index > 0) expect(tick.seconds).toBeGreaterThan(chart.xTicks[index - 1].seconds);
    });
    const paces = chart.dots.map((dot) => dot.pace);
    expect(chart.yTicks[0].pace).toBeLessThanOrEqual(Math.min(...paces));
    expect(chart.yTicks[chart.yTicks.length - 1].pace).toBeGreaterThanOrEqual(Math.max(250, ...paces));
    chart.yTicks.forEach((tick, index) => {
      expect(tick.pace % 5).toBe(0);
      if (index > 0) expect(tick.y).toBeGreaterThan(chart.yTicks[index - 1].y);
    });
    expect(chart.yTicks.length).toBeLessThanOrEqual(9);
  });

  it('has fewer time labels on a narrow chart, never two closer than the label is wide', () => {
    const wide = buildPaceCurve({ points: answer.points, model: answer.model, width: 1000 });
    const narrow = buildPaceCurve({ points: answer.points, model: answer.model, width: 330 });

    expect(narrow.xTicks.length).toBeLessThan(wide.xTicks.length);
    narrow.xTicks.slice(1).forEach((tick, index) => expect(tick.x - narrow.xTicks[index].x).toBeGreaterThanOrEqual(58));
    wide.xTicks.slice(1).forEach((tick, index) => expect(tick.x - wide.xTicks[index].x).toBeGreaterThanOrEqual(58));
  });

  it('copes with a single effort', () => {
    const chart = buildPaceCurve({ points: [answer.points[1]], model: null });

    expect(chart.dots).toHaveLength(1);
    expect(Number.isFinite(chart.dots[0].x)).toBe(true);
    expect(Number.isFinite(chart.dots[0].y)).toBe(true);
    expect(chart.xTicks.length).toBeGreaterThanOrEqual(1);
  });
});
