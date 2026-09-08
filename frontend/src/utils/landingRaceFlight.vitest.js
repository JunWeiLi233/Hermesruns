import { describe, expect, it } from 'vitest';
import { buildRaceFlight, getRaceFlightFrame, RACE_FLIGHT_STEP_MS, RACE_FLIGHT_DWELL_MS } from './landingRaceFlight.js';

// Deliberately unequal legs: a long flight must not shift caption timing.
const points = [{ x: 51.55, y: 8.55 }, { x: 85.25, y: 35.55 },
  { x: 27.45, y: 12.15 }, { x: 29.60, y: 12.15 }, { x: 83.65, y: 13.65 }];
const flight = buildRaceFlight(points);

describe('landing race pointer timeline', () => {
  it('dwells exactly at the destination advertised by its active index over repeated cycles', () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      points.forEach((point, index) => {
        const frame = getRaceFlightFrame(flight.legs, (cycle * points.length + index) * RACE_FLIGHT_STEP_MS + 600);
        expect(frame.activeIndex).toBe(index);
        expect(frame.x).toBeCloseTo(point.x, 10);
        expect(frame.y).toBeCloseTo(point.y, 10);
        expect(frame.travelling).toBe(false);
      });
    }
  });
  it('shows the arrival city while moving and follows that exact curved leg', () => {
    flight.legs.forEach((leg, index) => {
      const frame = getRaceFlightFrame(flight.legs, index * RACE_FLIGHT_STEP_MS + 2400);
      expect(frame.activeIndex).toBe((index + 1) % points.length);
      expect(frame.legIndex).toBe(index);
      expect(frame.x).toBeCloseTo((leg.start.x + 2 * leg.control.x + leg.end.x) / 4, 10);
      expect(frame.y).toBeCloseTo((leg.start.y + 2 * leg.control.y + leg.end.y) / 4, 10);
      expect(Number.isFinite(frame.angle)).toBe(true);
    });
  });
  it('has no position jump when departure, arrival, or the closed loop crosses a boundary', () => {
    for (let index = 0; index <= points.length; index++) {
      for (const offset of [0, RACE_FLIGHT_DWELL_MS]) {
        const time = index * RACE_FLIGHT_STEP_MS + offset;
        const before = getRaceFlightFrame(flight.legs, Math.max(0, time - 0.01));
        const after = getRaceFlightFrame(flight.legs, time + 0.01);
        expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.001);
      }
    }
  });
  it('supports zero or one destination without invalid geometry or endless travel', () => {
    expect(getRaceFlightFrame(buildRaceFlight([]).legs, 1000)).toBeNull();
    const only = getRaceFlightFrame(buildRaceFlight([points[0]]).legs, 99999);
    expect(only).toMatchObject({ x: points[0].x, y: points[0].y, activeIndex: 0, travelling: false });
  });
});
