import { describe, expect, it } from 'vitest';
import { clampMapCamera, layoutRaceMarkers, focusRaceCamera, raceScreenPoint, zoomMapCamera } from './landingRaceMap';

const races = [
  { id: 'berlin', pin: { x: 51.55, y: 8.55 } },
  { id: 'paris', pin: { x: 49.45, y: 10.05 } },
  { id: 'london', pin: { x: 47.35, y: 8.95 } },
  { id: 'tokyo', pin: { x: 83.65, y: 13.65 } },
  { id: 'sydney', pin: { x: 85.25, y: 35.55 } },
  { id: 'nyc', pin: { x: 29.6, y: 12.15 } },
  { id: 'boston', pin: { x: 29.85, y: 11.6 } },
  { id: 'chicago', pin: { x: 27.45, y: 12.15 } },
  { id: 'valencia', pin: { x: 47.1, y: 12.4 } },
  { id: 'comrades', pin: { x: 55.5, y: 34.4 } },
];

describe('landing map camera and touch targets', () => {
  it('projects pins into the same centered SVG coordinates on desktop and mobile', () => {
    const pin = races[3].pin;
    const desktop = raceScreenPoint(pin, { width: 800, height: 400 }, { zoom: 1, x: 0, y: 0 });
    expect(desktop.x).toBeCloseTo(pin.x * 8);
    expect(desktop.y).toBeCloseTo(pin.y * 8);
    const mobile = raceScreenPoint(pin, { width: 335, height: 260 }, { zoom: 1, x: 0, y: 0 });
    expect(mobile.x).toBeCloseTo(pin.x * 3.35);
    expect(mobile.y).toBeCloseTo(46.25 + pin.y * 3.35);
  });

  it('bounds zoom and dragging to the rendered map', () => {
    const size = { width: 335, height: 260 };
    const fit = clampMapCamera({ zoom: -2, x: 1000, y: 1000 }, size);
    expect(fit).toEqual({ zoom: 1, x: 0, y: 0 });
    const zoomed = clampMapCamera({ zoom: 20, x: 1000, y: 1000 }, size);
    expect(zoomed).toEqual({ zoom: 3, x: 335, y: 121.25 });
  });

  it('keeps a selected destination visible when focusing a zoomed map', () => {
    const size = { width: 335, height: 260 };
    for (const race of races) {
      const camera = focusRaceCamera(race.pin, size, 3);
      const point = raceScreenPoint(race.pin, size, camera);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(size.width);
      expect(point.y).toBeGreaterThan(0);
      expect(point.y).toBeLessThan(size.height);
    }
  });

  it('keeps the viewed location when zooming after a pan', () => {
    const camera = { zoom: 1.5, x: 30, y: 20 };
    const next = zoomMapCamera(camera, { width: 335, height: 260 }, 2);
    expect(next.x / next.zoom).toBeCloseTo(camera.x / camera.zoom);
    expect(next.y / next.zoom).toBeCloseTo(camera.y / camera.zoom);
  });

  it('keeps every visible race individually selectable with separate, contained touch targets', () => {
    for (const width of [240, 273, 305, 335, 600, 800, 1400]) {
      const size = { width, height: Math.max(320, width / 2) };
      for (const zoom of [1, 1.5, 2, 3]) {
        const camera = focusRaceCamera(races[0].pin, size, zoom);
        const labels = layoutRaceMarkers(races, size, camera);
        const visible = races.filter(race => {
          const point = raceScreenPoint(race.pin, size, camera);
          return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= size.height;
        });
        expect(labels.map(label => label.race.id).sort()).toEqual(visible.map(race => race.id).sort());
        labels.forEach((label, index) => {
          expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
          expect(label.x + label.width / 2).toBeLessThanOrEqual(width);
          expect(label.y - label.height / 2).toBeGreaterThanOrEqual(0);
          expect(label.y + label.height / 2).toBeLessThanOrEqual(size.height);
          expect(label.height).toBeGreaterThanOrEqual(44);
          expect({ x: label.anchorX, y: label.anchorY }).toEqual(raceScreenPoint(label.race.pin, size, camera));
          labels.slice(index + 1).forEach(other => {
            expect(Math.abs(label.x - other.x) >= (label.width + other.width) / 2
              || Math.abs(label.y - other.y) >= (label.height + other.height) / 2).toBe(true);
          });
        });
      }
    }
  });

  it('keeps true city dots uncovered by labels at supported mobile and desktop sizes', () => {
    for (const width of [273, 305, 335, 800]) {
      const labels = layoutRaceMarkers(races, { width, height: Math.max(320, width / 2) }, { zoom: 1, x: 0, y: 0 });
      labels.forEach(label => labels.forEach(dot => {
        expect(Math.abs(dot.anchorX - label.x) >= label.width / 2 + 7
          || Math.abs(dot.anchorY - label.y) >= label.height / 2 + 7).toBe(true);
      }));
    }
  });
});
