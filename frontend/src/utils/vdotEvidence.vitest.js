import { describe, expect, it } from 'vitest';
import { NOW, manyRuns, mixedRuns, oldRuns, shortRuns } from '../pages/analysis/__tests__/vdotEvidenceFixtures';
import { estimateCurrentVdot, representativeVdotFromEntries } from './vdot';
import { POOL_MIN_KM, SLOW_RUN_FACTOR, WINDOW_DAYS, buildEstimatePlot, buildVdotEvidence } from './vdotEvidence';

const evidence = buildVdotEvidence(mixedRuns(), { now: NOW });
const byName = Object.fromEntries(evidence.rows.map((row) => [row.name, row]));

describe('the rule the page shows', () => {
  it('is the rule vdot.js applies: ninety days, runs of 3 km, a 1.18 slow-run cut-off', () => {
    expect(WINDOW_DAYS).toBe(90);
    expect(POOL_MIN_KM).toBe(3);
    expect(SLOW_RUN_FACTOR).toBe(1.18);
  });

  it('is told by the estimate itself which runs it used and which pool they came from', () => {
    const estimate = estimateCurrentVdot(mixedRuns(), NOW);

    expect(estimate.usedEntries.map((entry) => entry.run.name)).toEqual(['Hill repeats', 'Tempo on the canal', 'Park 5K']);
    expect(estimate.pool).toBe('strict');
    expect(estimate.poolCount).toBe(5);
    expect(representativeVdotFromEntries([]).used).toEqual([]);
    expect(representativeVdotFromEntries([]).pool).toBeNull();
  });
});

describe('buildVdotEvidence', () => {
  it('lists every run of the window that gives an estimate, highest first, and leaves out the old one and the slow one', () => {
    expect(evidence.rows.map((row) => row.name)).toEqual([
      'Hill repeats', 'Tempo on the canal', 'Strides', 'Park 5K', 'Easy six', 'Long steady run',
    ]);
    expect(byName['Old tempo']).toBeUndefined();
    expect(byName['Recovery jog']).toBeUndefined();
    expect(evidence.windowDays).toBe(90);
  });

  it('gives each run the estimate the rule gives it, by heart rate where it has one', () => {
    expect(byName['Tempo on the canal'].vdot).toBeCloseTo(45.6147, 3);
    expect(byName['Tempo on the canal'].method).toBe('hr');
    expect(byName['Tempo on the canal'].averageHeartRate).toBe(150);
    expect(byName['Tempo on the canal'].heartRateShare).toBeCloseTo(150 / 190, 6);
    expect(byName['Park 5K'].vdot).toBeCloseTo(44.5428, 3);
    expect(byName['Park 5K'].method).toBe('race');
    expect(byName['Park 5K'].averageHeartRate).toBeNull();
    expect(byName['Park 5K'].heartRateShare).toBeNull();
    expect(byName['Park 5K'].paceSecondsPerKm).toBeCloseTo(264, 6);
    expect(evidence.methodCounts).toEqual({ hr: 5, race: 1 });
  });

  it('marks the three the number is the mean of, and the run that is outside the pool', () => {
    expect(evidence.rows.filter((row) => row.counted).map((row) => row.name)).toEqual(['Hill repeats', 'Tempo on the canal', 'Park 5K']);
    expect(evidence.usedCount).toBe(3);
    expect(evidence.pool).toBe('strict');
    expect(evidence.poolCount).toBe(5);
    // 45.58 is higher than the third best, but a 2 km run is not in the pool while a longer run exists.
    expect(byName.Strides.counted).toBe(false);
    expect(byName.Strides.eligible).toBe(false);
    expect(evidence.rows.filter((row) => !row.eligible).map((row) => row.name)).toEqual(['Strides']);
  });

  it('shows the sum behind the number, so it can be checked by hand', () => {
    expect(evidence.value).toBe(45.5);
    expect(evidence.arithmetic.terms).toHaveLength(3);
    expect(evidence.arithmetic.terms[0]).toBeCloseTo(46.2311, 3);
    expect(evidence.arithmetic.mean).toBeCloseTo(45.4629, 3);
    expect(evidence.arithmetic.shown).toBe(45.5);
    expect(Math.round(evidence.arithmetic.mean * 10) / 10).toBe(evidence.arithmetic.shown);
  });

  it('says what the number would be without the best run, when there is a fourth run to take its place', () => {
    expect(evidence.withoutBest.value).toBe(44.7);
    expect(evidence.withoutBest.drop).toBe(0.7);

    const three = buildVdotEvidence(mixedRuns().filter((run) => ![5, 4].includes(run.id)), { now: NOW });
    expect(three.rows.filter((row) => row.eligible)).toHaveLength(3);
    expect(three.withoutBest).toBeNull();
  });

  it('reads the inputs of the rule from the whole run list: the highest heart rate and the median pace', () => {
    expect(evidence.hrMax).toBe(190);
    expect(evidence.medianPaceSecondsPerKm).toBe(300);
    expect(evidence.slowCutoffSecondsPerKm).toBeCloseTo(354, 6);
  });

  it('counts the runs the rule looked at and gave no estimate: slow, with no heart rate', () => {
    expect(evidence.leftOut).toBe(1);

    // The same jog with a heart rate gets an estimate from it, so nothing is left out.
    const withHeartRate = mixedRuns().map((run) => (run.id === 8 ? { ...run, averageHeartRate: 120 } : run));
    const second = buildVdotEvidence(withHeartRate, { now: NOW });
    expect(second.leftOut).toBe(0);
    expect(second.rows.map((row) => row.name)).toContain('Recovery jog');
  });

  it('takes every run when none is 3 km long, and keeps all of them in the pool', () => {
    const short = buildVdotEvidence(shortRuns(), { now: NOW });

    expect(short.pool).toBe('all');
    expect(short.poolCount).toBe(2);
    expect(short.rows.every((row) => row.eligible)).toBe(true);
    expect(short.rows.filter((row) => row.counted)).toHaveLength(2);
    expect(short.usedCount).toBe(2);
    expect(short.withoutBest).toBeNull();
    expect(short.arithmetic.terms).toHaveLength(2);
  });

  it('has nothing to show when no run of the window gives an estimate', () => {
    const none = buildVdotEvidence(oldRuns(), { now: NOW });

    expect(none.rows).toEqual([]);
    expect(none.value).toBe(0);
    expect(none.arithmetic).toBeNull();
    expect(none.withoutBest).toBeNull();
    expect(none.pool).toBeNull();
    expect(none.leftOut).toBe(0);
    expect(buildVdotEvidence([], { now: NOW }).rows).toEqual([]);
    expect(buildVdotEvidence(null, { now: NOW }).rows).toEqual([]);
    expect(buildVdotEvidence([null, undefined, 3], { now: NOW }).rows).toEqual([]);
  });

  it('gives a heart-rate run no share when the runner has no highest heart rate on record', () => {
    const noMax = mixedRuns().map((run) => ({ ...run, maxHeartRate: null }));
    const result = buildVdotEvidence(noMax, { now: NOW });

    expect(result.hrMax).toBeNull();
    expect(result.rows.every((row) => row.method === 'race')).toBe(true);
    expect(result.rows.every((row) => row.heartRateShare === null)).toBe(true);
    // A run keeps the heart rate it was recorded with, whether or not the estimate used it.
    expect(result.rows.find((row) => row.name === 'Tempo on the canal').averageHeartRate).toBe(150);
  });

  it('keeps a run that is equal to another in the number first', () => {
    const twin = mixedRuns().map((run) => (run.id === 4 ? { ...run, distanceKm: 5, movingTimeSeconds: 1320, averageHeartRate: null } : run));
    const result = buildVdotEvidence([...twin, { ...twin[1], id: 99, name: 'Park 5K again', startTime: new Date(NOW - 30 * 86400000).toISOString() }], { now: NOW });
    const equal = result.rows.filter((row) => Math.abs(row.vdot - 44.5428) < 1e-3);

    expect(equal.length).toBeGreaterThanOrEqual(2);
    equal.slice(1).forEach((row, index) => expect(Number(equal[index].counted)).toBeGreaterThanOrEqual(Number(row.counted)));
  });

  it('gives the weather-adjusted estimate of a run next to the raw one', () => {
    const result = buildVdotEvidence(manyRuns(), { now: NOW });
    const adjusted = result.rows.filter((row) => row.adjustedVdot - row.vdot > 0.05);

    expect(adjusted.length).toBeGreaterThan(0);
    result.rows.forEach((row) => expect(row.adjustedVdot).toBeGreaterThanOrEqual(row.vdot - 1e-9));
  });
});

describe('buildEstimatePlot', () => {
  const plot = buildEstimatePlot({ rows: evidence.rows, value: evidence.value, now: NOW, width: 640, height: 260 });

  it('has nothing to draw without estimates', () => {
    expect(buildEstimatePlot({ rows: [], value: 0, now: NOW })).toBeNull();
    expect(buildEstimatePlot({ rows: undefined, value: 0, now: NOW })).toBeNull();
    expect(buildEstimatePlot({ rows: [{ vdot: Number.NaN, date: new Date(NOW) }], value: 0, now: NOW })).toBeNull();
    expect(buildEstimatePlot({ rows: [{ vdot: 40, date: new Date('nope') }], value: 0, now: NOW })).toBeNull();
  });

  it('puts a later run to the right and a higher estimate higher up, inside the plot', () => {
    const dots = Object.fromEntries(plot.dots.map((dot) => [dot.row.name, dot]));

    expect(dots['Tempo on the canal'].x).toBeGreaterThan(dots['Park 5K'].x);
    expect(dots['Park 5K'].x).toBeGreaterThan(dots['Long steady run'].x);
    expect(dots['Hill repeats'].y).toBeLessThan(dots['Long steady run'].y);
    plot.dots.forEach((dot) => {
      expect(dot.x).toBeGreaterThanOrEqual(plot.padL);
      expect(dot.x).toBeLessThanOrEqual(plot.width - plot.padR);
      expect(dot.y).toBeGreaterThanOrEqual(plot.padT);
      expect(dot.y).toBeLessThanOrEqual(plot.baseline);
    });
  });

  it('tells a counted run, an unused one and one outside the pool apart', () => {
    const roles = Object.fromEntries(plot.dots.map((dot) => [dot.row.name, dot.role]));

    expect(roles).toEqual({
      'Hill repeats': 'counted',
      'Tempo on the canal': 'counted',
      'Park 5K': 'counted',
      'Easy six': 'other',
      'Long steady run': 'other',
      Strides: 'short',
    });
  });

  it('draws the number as a line at its own height, between the lowest and the highest dot', () => {
    const ys = plot.dots.map((dot) => dot.y);

    expect(plot.mean.value).toBe(45.5);
    expect(plot.mean.y).toBeGreaterThan(Math.min(...ys));
    expect(plot.mean.y).toBeLessThan(Math.max(...ys));
    expect(buildEstimatePlot({ rows: evidence.rows, value: 0, now: NOW }).mean).toBeNull();
  });

  it('puts the label of the line at the end with fewer dots on the line, the left end when it is a tie', () => {
    const dot = (daysAgo) => ({ vdot: 45.5, date: new Date(NOW - daysAgo * 86400000), counted: true, eligible: true });
    const recent = buildEstimatePlot({ rows: [dot(1), dot(2), dot(3)], value: 45.5, now: NOW });
    const old = buildEstimatePlot({ rows: [dot(85), dot(88), dot(89)], value: 45.5, now: NOW });
    const away = buildEstimatePlot({ rows: [{ ...dot(1), vdot: 49 }, { ...dot(2), vdot: 41 }], value: 45.5, now: NOW });

    expect(recent.mean.side).toBe('left');
    expect(old.mean.side).toBe('right');
    expect(away.mean.side).toBe('left');
    expect(plot.mean.side).toBe('left');
  });

  it('runs the day axis across the window, ending today, and keeps a run of the same day at the same place', () => {
    expect(plot.xTicks[0].x).toBeCloseTo(plot.padL, 9);
    expect(plot.xTicks[plot.xTicks.length - 1].x).toBeCloseTo(plot.width - plot.padR, 9);
    expect(plot.xTicks[plot.xTicks.length - 1].time).toBe(NOW);
    expect(NOW - plot.xTicks[0].time).toBe(90 * 24 * 60 * 60 * 1000);
    plot.xTicks.slice(1).forEach((tick, index) => expect(tick.time).toBeGreaterThan(plot.xTicks[index].time));
  });

  it('has fewer date labels on a narrow chart', () => {
    const narrow = buildEstimatePlot({ rows: evidence.rows, value: evidence.value, now: NOW, width: 300, height: 240 });

    expect(plot.xTicks).toHaveLength(4);
    expect(narrow.xTicks).toHaveLength(3);
  });

  it('labels the estimate axis with round numbers that reach past every dot and the line', () => {
    const values = plot.dots.map((dot) => dot.row.vdot).concat(plot.mean.value);

    expect(plot.yTicks[0].value).toBeLessThanOrEqual(Math.min(...values));
    expect(plot.yTicks[plot.yTicks.length - 1].value).toBeGreaterThanOrEqual(Math.max(...values) - 1);
    plot.yTicks.forEach((tick, index) => {
      expect(Number.isInteger(tick.value)).toBe(true);
      if (index > 0) expect(tick.y).toBeLessThan(plot.yTicks[index - 1].y);
    });
    expect(plot.yTicks.length).toBeLessThanOrEqual(9);
  });

  it('copes with a single run, and with a run dated outside the window', () => {
    const single = buildEstimatePlot({ rows: [evidence.rows[0]], value: evidence.rows[0].vdot, now: NOW });
    expect(single.dots).toHaveLength(1);
    expect(Number.isFinite(single.dots[0].x)).toBe(true);
    expect(Number.isFinite(single.dots[0].y)).toBe(true);
    expect(single.yTicks.length).toBeGreaterThanOrEqual(3);

    const future = { ...evidence.rows[0], date: new Date(NOW + 5 * 86400000) };
    const old = { ...evidence.rows[1], date: new Date(NOW - 400 * 86400000) };
    const clamped = buildEstimatePlot({ rows: [future, old], value: 0, now: NOW });
    expect(clamped.dots[0].x).toBeCloseTo(clamped.width - clamped.padR, 9);
    expect(clamped.dots[1].x).toBeCloseTo(clamped.padL, 9);
  });

  it('widens the estimate axis when the estimates are almost equal', () => {
    const flat = buildEstimatePlot({
      rows: [
        { vdot: 45.2, date: new Date(NOW - 86400000), counted: true, eligible: true },
        { vdot: 45.3, date: new Date(NOW - 2 * 86400000), counted: true, eligible: true },
      ],
      value: 45.3,
      now: NOW,
    });
    const first = flat.yTicks[0].value;
    const last = flat.yTicks[flat.yTicks.length - 1].value;

    expect(last - first).toBeGreaterThanOrEqual(4);
  });
});
