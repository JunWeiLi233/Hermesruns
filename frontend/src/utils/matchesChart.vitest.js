import { describe, expect, it } from 'vitest';
import { buildMatchScatter, dayNumber, formatPaceDelta } from './matchesChart';

const run = (date, paceSecPerKm, extra = {}) => ({ activityId: Number(date.replaceAll('-', '')), date, paceSecPerKm, ...extra });

describe('dayNumber', () => {
  it('counts calendar days, so two days apart is two', () => {
    expect(dayNumber('2026-10-03') - dayNumber('2026-10-01')).toBe(2);
    expect(dayNumber('2026-03-30') - dayNumber('2026-03-28')).toBe(2); // across a clock change
    expect(dayNumber('2027-01-01') - dayNumber('2026-01-01')).toBe(365);
  });

  it('is NaN for anything that is not a day', () => {
    for (const value of [null, undefined, '', 'soon', 20261003]) expect(dayNumber(value)).toBeNaN();
  });
});

describe('buildMatchScatter', () => {
  it('is nothing when no run can be drawn', () => {
    expect(buildMatchScatter([])).toBeNull();
    expect(buildMatchScatter(null)).toBeNull();
    expect(buildMatchScatter([run('2026-10-01', 0), run('nope', 300), run('2026-10-02', Number.NaN)])).toBeNull();
  });

  it('leaves out a run that has no usable pace or day and draws the rest', () => {
    const chart = buildMatchScatter([run('2026-10-01', 300), run('nope', 300), run('2026-10-05', 0), run('2026-10-09', 290)]);
    expect(chart.points.map((point) => point.run.date)).toEqual(['2026-10-01', '2026-10-09']);
  });

  it('puts the earliest run at the left edge, the latest at the right and the others in proportion to the days between', () => {
    const chart = buildMatchScatter([run('2026-10-01', 300), run('2026-10-11', 295), run('2026-10-21', 290)]);
    const [first, middle, last] = chart.points;
    expect(first.x).toBe(chart.left);
    expect(last.x).toBe(chart.width - chart.right);
    expect(middle.x).toBeCloseTo((first.x + last.x) / 2, 6);

    const uneven = buildMatchScatter([run('2026-10-01', 300), run('2026-10-03', 295), run('2026-10-21', 290)]);
    expect(uneven.points[1].x).toBeCloseTo(uneven.left + ((uneven.width - uneven.left - uneven.right) * 2) / 20, 6);
  });

  it('puts a faster pace nearer the top and keeps every dot inside the plot', () => {
    const chart = buildMatchScatter([run('2026-10-01', 330), run('2026-10-08', 290), run('2026-10-15', 310)]);
    const [slow, fast, middle] = chart.points;
    expect(fast.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(slow.y);
    for (const point of chart.points) {
      expect(point.y).toBeGreaterThanOrEqual(chart.top);
      expect(point.y).toBeLessThanOrEqual(chart.height - chart.bottom);
    }
  });

  it('labels the fastest, the middle and the slowest pace', () => {
    const chart = buildMatchScatter([run('2026-10-01', 330), run('2026-10-08', 290)]);
    expect(chart.ticks.map((tick) => tick.pace)).toEqual([290, 310, 330]);
    expect(chart.ticks[0].y).toBeLessThan(chart.ticks[2].y);
  });

  it('draws one dot in the middle, one tick, and no trend, for a single run', () => {
    const chart = buildMatchScatter([run('2026-10-01', 300)]);
    expect(chart.points).toHaveLength(1);
    expect(chart.points[0].x).toBeCloseTo((chart.left + chart.width - chart.right) / 2, 6);
    expect(chart.ticks).toHaveLength(1);
    expect(chart.trend).toBeNull();
    expect(Number.isFinite(chart.points[0].y)).toBe(true);
  });

  it('puts runs on the same day on the same x and survives them all having one pace', () => {
    const chart = buildMatchScatter([run('2026-10-01', 300, { activityId: 1 }), run('2026-10-01', 300, { activityId: 2 })]);
    expect(chart.points[0].x).toBe(chart.points[1].x);
    expect(chart.trend).toBeNull();
    expect(chart.ticks).toHaveLength(1);
  });

  describe('the trend line', () => {
    it('needs three runs and more than one day', () => {
      expect(buildMatchScatter([run('2026-10-01', 300), run('2026-10-08', 290)]).trend).toBeNull();
      expect(buildMatchScatter([run('2026-10-01', 300, { activityId: 1 }), run('2026-10-01', 290, { activityId: 2 }), run('2026-10-01', 280, { activityId: 3 })]).trend).toBeNull();
    });

    it('rises towards the top when the runner is getting faster, and sinks when slower', () => {
      const faster = buildMatchScatter([run('2026-10-01', 320), run('2026-10-11', 305), run('2026-10-21', 290)]).trend;
      expect(faster.slopeSecPerKmPerDay).toBeCloseTo(-1.5, 6);
      expect(faster.y2).toBeLessThan(faster.y1);

      const slower = buildMatchScatter([run('2026-10-01', 290), run('2026-10-11', 305), run('2026-10-21', 320)]).trend;
      expect(slower.slopeSecPerKmPerDay).toBeCloseTo(1.5, 6);
      expect(slower.y2).toBeGreaterThan(slower.y1);
    });

    it('is level for a runner whose pace does not change, and spans the plot from edge to edge', () => {
      const chart = buildMatchScatter([run('2026-10-01', 300), run('2026-10-11', 300), run('2026-10-21', 300)]);
      expect(chart.trend.y1).toBeCloseTo(chart.trend.y2, 6);
      expect(chart.trend.x1).toBe(chart.left);
      expect(chart.trend.x2).toBe(chart.width - chart.right);
    });

    it('stays inside the plot even when the fit runs off it', () => {
      // One slow run a week after four quick ones pulls the fitted line to 246 s per km at the left edge, past the 252
      // that the plot goes up to, so the line has to be held at the edge.
      const chart = buildMatchScatter([
        run('2026-01-01', 305), run('2026-01-02', 300), run('2026-01-03', 310), run('2026-01-04', 300), run('2026-01-11', 700),
      ]);
      expect(chart.trend.slopeSecPerKmPerDay).toBeGreaterThan(40);
      expect(chart.trend.y1).toBe(chart.top);
      expect(chart.trend.y2).toBeLessThanOrEqual(chart.height - chart.bottom);
      for (const y of [chart.trend.y1, chart.trend.y2]) {
        expect(y).toBeGreaterThanOrEqual(chart.top);
        expect(y).toBeLessThanOrEqual(chart.height - chart.bottom);
      }
    });
  });

  it('reports the first and the last day it draws, for the axis', () => {
    const chart = buildMatchScatter([run('2026-10-11', 300), run('2026-10-01', 290), run('2026-10-21', 295)]);
    expect(chart.firstDate).toBe('2026-10-01');
    expect(chart.lastDate).toBe('2026-10-21');
  });
});

describe('formatPaceDelta', () => {
  it('signs a slower pace with a plus and a faster one with a minus', () => {
    expect(formatPaceDelta(5)).toBe('+0:05');
    expect(formatPaceDelta(-12)).toBe('−0:12');
    expect(formatPaceDelta(75)).toBe('+1:15');
    expect(formatPaceDelta(-600)).toBe('−10:00');
  });

  it('writes no sign for the same second, and rounds to the nearest', () => {
    expect(formatPaceDelta(0)).toBe('0:00');
    expect(formatPaceDelta(0.4)).toBe('0:00');
    expect(formatPaceDelta(-0.4)).toBe('0:00');
    expect(formatPaceDelta(0.6)).toBe('+0:01');
  });

  it('is a dash when there is no number', () => {
    expect(formatPaceDelta(Number.NaN)).toBe('–');
    expect(formatPaceDelta(undefined)).toBe('–');
  });
});
