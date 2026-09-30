import { describe, expect, it } from 'vitest';
import { LANDING_GLOBE_LAND_RUNS, LANDING_GLOBE_POINT_COUNT } from '../data/landingGlobeLand';
import {
  GLOBE_FLIGHT_MS, GLOBE_TOUR_DWELL_MS, GLOBE_TOUR_STEP_MS,
  GLOBE_FOLLOW_LEAD, angularDistance, arcPeakAltitude, decodeLandRuns, fibonacciPoint, flightPose, followView, getTourFrame, globeFrame,
  interpolateView, labelSize, landBandOrder, landVectors, layoutGlobeLabels, normalizeLng, projectGeo, projectVector, resampleLand, sampleArc, screenHeading, slerpGeo, toVector, viewForGeo, viewRotation,
} from './landingGlobe';

// Showcase races with their catalog coordinates (src/data/worldRaceCatalog.json).
const races = [
  { id: 'berlin', geo: { lat: 52.52, lng: 13.405 } },
  { id: 'london', geo: { lat: 51.5074, lng: -0.1278 } },
  { id: 'paris', geo: { lat: 48.8566, lng: 2.3522 } },
  { id: 'valencia', geo: { lat: 39.4699, lng: -0.3763 } },
  { id: 'nyc', geo: { lat: 40.7128, lng: -74.006 } },
  { id: 'boston', geo: { lat: 42.3601, lng: -71.0589 } },
  { id: 'chicago', geo: { lat: 41.8781, lng: -87.6298 } },
  { id: 'tokyo', geo: { lat: 35.685, lng: 139.76 } },
  { id: 'sydney', geo: { lat: -33.8688, lng: 151.2093 } },
  { id: 'comrades', geo: { lat: -29.8587, lng: 31.0218 } },
];
const degrees = radians => radians * 180 / Math.PI;

describe('landing globe land dots', () => {
  it('spreads Fibonacci points evenly from pole to pole', () => {
    const count = 2000;
    const points = Array.from({ length: count }, (_, index) => fibonacciPoint(index, count));
    expect(points[0].lat).toBeGreaterThan(87);
    expect(points.at(-1).lat).toBeLessThan(-87);
    points.forEach(point => {
      expect(point.lng).toBeGreaterThanOrEqual(-180);
      expect(point.lng).toBeLessThan(180);
    });
    const northern = points.filter(point => point.lat > 0).length;
    expect(northern).toBe(count / 2);
    const mean = points.map(toVector).reduce((sum, vector) => sum.map((value, axis) => value + vector[axis] / count), [0, 0, 0]);
    expect(Math.hypot(...mean)).toBeLessThan(0.01);
  });

  it('orders each latitude band west to east and decodes alternating water/land runs', () => {
    const count = 100;
    const order = landBandOrder(count);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, index) => index));
    const band = Math.round(Math.sqrt(count * Math.PI));
    for (let start = 0; start < count; start += band) {
      const lngs = [...order.slice(start, Math.min(count, start + band))].map(index => fibonacciPoint(index, count).lng);
      lngs.slice(1).forEach((lng, offset) => expect(lng).toBeGreaterThanOrEqual(lngs[offset] - 1e-9));
    }
    // Runs (LEB128): 3 water, 2 land, 130 water (a two-byte varint).
    const flags = decodeLandRuns(btoa(String.fromCharCode(3, 2, 0x82, 0x01)), count);
    expect([...flags].reduce((sum, flag) => sum + flag, 0)).toBe(2);
    expect(flags[order[3]]).toBe(1);
    expect(flags[order[4]]).toBe(1);
    expect(flags[order[2]]).toBe(0);
    const vectors = landVectors(flags);
    expect(vectors).toHaveLength(6);
    Array.from(vectors.slice(0, 3)).forEach((value, axis) => expect(value).toBeCloseTo(toVector(fibonacciPoint(Math.min(order[3], order[4]), count))[axis], 5));
  });

  const nearestLand = (land, geo) => {
    const [x, y, z] = toVector(geo);
    let best = -1;
    for (let index = 0; index < land.length; index += 3) best = Math.max(best, land[index] * x + land[index + 1] * y + land[index + 2] * z);
    return degrees(Math.acos(Math.min(1, best)));
  };
  const landGeos = [{ lat: 52.52, lng: 13.405 }, { lat: 23, lng: 12 }, { lat: -5, lng: -62 }, { lat: -25, lng: 134 }, { lat: -82, lng: 40 }];
  const waterGeos = [{ lat: 20, lng: -40 }, { lat: 0, lng: -150 }, { lat: -20, lng: 80 }];

  it('marks known continents as land and open oceans as water on the dense lattice and its coarse resample', () => {
    const flags = decodeLandRuns(LANDING_GLOBE_LAND_RUNS, LANDING_GLOBE_POINT_COUNT);
    expect(LANDING_GLOBE_POINT_COUNT).toBeGreaterThanOrEqual(40000);
    const coarse = resampleLand(flags, LANDING_GLOBE_POINT_COUNT, 20000);
    for (const [lattice, count, spacing] of [[flags, LANDING_GLOBE_POINT_COUNT, 0.9], [coarse, 20000, 1.5]]) {
      const land = landVectors(lattice, count);
      const share = land.length / 3 / count;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.33);
      landGeos.forEach(geo => expect(nearestLand(land, geo)).toBeLessThan(spacing));
      waterGeos.forEach(geo => expect(nearestLand(land, geo)).toBeGreaterThan(4));
    }
    // Resampling keeps the coastline: land within a coarse spacing of a dense land point.
    const dense = landVectors(flags);
    const coarseLand = landVectors(coarse, 20000);
    for (let index = 0; index < coarseLand.length; index += 3 * 97) {
      const geo = { lat: degrees(Math.asin(coarseLand[index + 1])), lng: degrees(Math.atan2(coarseLand[index], coarseLand[index + 2])) };
      expect(nearestLand(dense, geo)).toBeLessThan(1.2);
    }
  });
});

describe('landing globe projection', () => {
  const frame = { cx: 200, cy: 150, radius: 100 };

  it('projects precomputed unit vectors exactly like geographic points', () => {
    const view = { lat: 35, lng: -60 };
    const geo = { lat: 40.7, lng: -74 };
    expect(projectVector(toVector(geo), viewRotation(view), frame, 0.1)).toEqual(projectGeo(geo, view, frame, 0.1));
  });

  it('puts the view centre in the middle of the disc and hides the far side', () => {
    const view = { lat: 20, lng: 40 };
    const centre = projectGeo(view, view, frame);
    expect(centre.x).toBeCloseTo(200);
    expect(centre.y).toBeCloseTo(150);
    expect(centre.z).toBeCloseTo(1);
    expect(centre.visible).toBe(true);
    const antipode = projectGeo({ lat: -20, lng: -140 }, view, frame);
    expect(antipode.z).toBeCloseTo(-1);
    expect(antipode.visible).toBe(false);
  });

  it('keeps east to the right and north up', () => {
    const view = { lat: 0, lng: 0 };
    const east = projectGeo({ lat: 0, lng: 90 }, view, frame);
    expect(east.x).toBeCloseTo(300);
    expect(east.y).toBeCloseTo(150);
    expect(east.z).toBeCloseTo(0);
    const north = projectGeo({ lat: 90, lng: 0 }, view, frame);
    expect(north.x).toBeCloseTo(200);
    expect(north.y).toBeCloseTo(50);
    const tilted = projectGeo({ lat: 90, lng: 0 }, { lat: 30, lng: 0 }, frame);
    expect(tilted.y).toBeCloseTo(150 - 100 * Math.cos(Math.PI / 6));
    expect(tilted.z).toBeCloseTo(0.5);
  });

  it('shows raised points that clear the limb even when just behind it', () => {
    const view = { lat: 0, lng: 0 };
    const behind = { lat: 0, lng: 95 };
    expect(projectGeo(behind, view, frame).visible).toBe(false);
    const raised = projectGeo(behind, view, frame, 0.1);
    expect(raised.visible).toBe(true);
    expect(raised.x).toBeGreaterThan(300);
  });

  it('sizes the disc for the viewport and scales it with zoom', () => {
    expect(globeFrame({ width: 1342, height: 520 })).toEqual({ cx: 671, cy: 260, radius: 230 });
    expect(globeFrame({ width: 348, height: 360 }).radius).toBe(152);
    expect(globeFrame({ width: 348, height: 360 }, 2.5).radius).toBe(380);
  });
});

describe('landing globe flights', () => {
  const berlin = races[0].geo;
  const sydney = races[8].geo;

  it('slerps along the great circle', () => {
    const total = angularDistance(berlin, sydney);
    expect(slerpGeo(berlin, sydney, 0).lat).toBeCloseTo(berlin.lat);
    expect(slerpGeo(berlin, sydney, 1).lng).toBeCloseTo(sydney.lng);
    for (const t of [0.25, 0.5, 0.8]) {
      const point = slerpGeo(berlin, sydney, t);
      expect(angularDistance(berlin, point)).toBeCloseTo(total * t, 6);
      expect(angularDistance(point, sydney)).toBeCloseTo(total * (1 - t), 6);
    }
  });

  it('lifts arcs off the surface mid-flight, more for longer legs', () => {
    expect(sampleArc(berlin, sydney, 0).altitude).toBeCloseTo(0);
    expect(sampleArc(berlin, sydney, 1).altitude).toBeCloseTo(0);
    expect(sampleArc(berlin, sydney, 0.5).altitude).toBeCloseTo(arcPeakAltitude(berlin, sydney));
    const short = arcPeakAltitude(races[1].geo, races[2].geo);
    expect(short).toBeGreaterThan(0.03);
    expect(short).toBeLessThan(arcPeakAltitude(berlin, sydney));
    expect(arcPeakAltitude(berlin, { lat: -berlin.lat, lng: berlin.lng - 180 })).toBeLessThanOrEqual(0.14);
  });

  it('points the nose ahead along the arc, including after arrival', () => {
    const pose = flightPose(berlin, sydney, 0.4);
    expect(angularDistance(berlin, pose.ahead)).toBeGreaterThan(angularDistance(berlin, pose));
    const parked = flightPose(races[1].geo, races[2].geo, 1);
    expect(parked.lat).toBeCloseTo(races[2].geo.lat);
    expect(parked.altitude).toBeCloseTo(0);
    expect(degrees(angularDistance(parked, parked.ahead))).toBeGreaterThanOrEqual(0.99);
    expect(angularDistance(races[1].geo, parked.ahead)).toBeGreaterThan(angularDistance(races[1].geo, parked));
  });

  it('measures screen heading clockwise from the x axis', () => {
    expect(screenHeading({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
    expect(screenHeading({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
    expect(screenHeading({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180);
  });

  it('eases the camera the short way round and clamps its latitude', () => {
    expect(interpolateView({ lat: 0, lng: 170 }, { lat: 10, lng: -170 }, 0.5)).toEqual({ lat: 5, lng: -180 });
    const quarter = interpolateView({ lat: 0, lng: 0 }, { lat: 0, lng: 40 }, 0.25);
    expect(quarter.lng).toBeGreaterThan(0);
    expect(quarter.lng).toBeLessThan(10);
    expect(interpolateView({ lat: 0, lng: 0 }, { lat: 0, lng: 40 }, 1).lng).toBe(40);
    expect(viewForGeo({ lat: -82, lng: 190 })).toEqual({ lat: -60, lng: -170 });
    expect(normalizeLng(540)).toBe(-180);
  });

  it('runs one tour clock that dwells, then names the destination while flying', () => {
    expect(getTourFrame(0, 1000)).toBeNull();
    expect(getTourFrame(4, 100)).toMatchObject({ sourceIndex: 0, activeIndex: 0, travelling: false });
    const leaving = getTourFrame(4, GLOBE_TOUR_DWELL_MS + GLOBE_FLIGHT_MS / 2);
    expect(leaving).toMatchObject({ sourceIndex: 0, targetIndex: 1, activeIndex: 1, travelling: true });
    expect(leaving.progress).toBeCloseTo(0.5);
    expect(getTourFrame(4, 3 * GLOBE_TOUR_STEP_MS + GLOBE_TOUR_DWELL_MS + 1)).toMatchObject({ sourceIndex: 3, targetIndex: 0, activeIndex: 0 });
    expect(getTourFrame(4, 4 * GLOBE_TOUR_STEP_MS + 10)).toMatchObject({ activeIndex: 0, travelling: false });
    expect(getTourFrame(1, 99999)).toMatchObject({ activeIndex: 0, travelling: false });
  });
});

describe('landing globe labels', () => {
  const overlapping = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;

  it('keeps every front-side race individually selectable with contained, separate labels that leave pins uncovered', () => {
    for (const size of [{ width: 273, height: 360 }, { width: 286, height: 360 }, { width: 305, height: 360 }, { width: 335, height: 360 }, { width: 348, height: 360 }, { width: 720, height: 440 }, { width: 1342, height: 520 }]) {
      for (const zoom of [1, 1.5, 2.5]) {
        for (const centre of races) {
          const frame = globeFrame(size, zoom);
          const view = viewForGeo(centre.geo);
          const anchors = races.map(race => {
            const point = projectGeo(race.geo, view, frame);
            return { id: race.id, x: point.x, y: point.y, z: point.z, visible: point.z > 0.12, priority: race === centre ? 1 : 0 };
          });
          const labels = layoutGlobeLabels(anchors, size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius });
          const shown = labels.filter(label => !label.hidden);
          const inside = anchor => anchor.x >= 0 && anchor.x <= size.width && anchor.y >= 0 && anchor.y <= size.height;
          const onScreen = anchors.filter(anchor => anchor.visible && inside(anchor));
          // Every drawn pin, including those too near the limb to carry a label.
          const drawn = anchors.filter(anchor => anchor.z > 0 && inside(anchor));
          expect(shown.map(label => label.id).sort()).toEqual(onScreen.map(anchor => anchor.id).sort());
          expect(shown.map(label => label.id)).toContain(centre.id);
          shown.forEach((label, index) => {
            expect(label.height).toBeGreaterThanOrEqual(44);
            expect(label.width).toBe(labelSize(size.width).width);
            expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
            expect(label.x + label.width / 2).toBeLessThanOrEqual(size.width);
            expect(label.y - label.height / 2).toBeGreaterThanOrEqual(0);
            expect(label.y + label.height / 2).toBeLessThanOrEqual(size.height);
            shown.slice(index + 1).forEach(other => expect(overlapping(label, other), `${label.id}/${other.id} ${size.width} ${zoom} ${centre.id}`).toBe(false));
            drawn.forEach(pin => expect(Math.abs(pin.x - label.x) >= label.width / 2 + 7 || Math.abs(pin.y - label.y) >= label.height / 2 + 7,
              `${label.id} covers ${pin.id} (${size.width}, ${zoom}, ${centre.id})`).toBe(true));
          });
        }
      }
    }
  });

  it('keeps callouts off other pins and out from under other labels on desktop and tablet globes', () => {
    // Samples the visible part of a callout: from its pin to the edge of its own pill.
    const visibleCallout = label => Array.from({ length: 61 }, (_, step) => ({
      x: label.anchorX + (label.x - label.anchorX) * step / 60, y: label.anchorY + (label.y - label.anchorY) * step / 60,
    })).filter(point => Math.abs(point.x - label.x) >= label.width / 2 || Math.abs(point.y - label.y) >= 15);
    for (const size of [{ width: 720, height: 440 }, { width: 1342, height: 520 }]) {
      for (const zoom of [1, 1.5, 2.5]) {
        for (const centre of races) {
          const frame = globeFrame(size, zoom);
          const view = viewForGeo(centre.geo);
          const anchors = races.map(race => {
            const point = projectGeo(race.geo, view, frame);
            return { id: race.id, x: point.x, y: point.y, z: point.z, visible: point.z > 0.12, priority: race === centre ? 1 : 0 };
          });
          const shown = layoutGlobeLabels(anchors, size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius }).filter(label => !label.hidden);
          const pins = anchors.filter(anchor => anchor.z > 0);
          shown.forEach(label => {
            const line = visibleCallout(label);
            pins.filter(pin => pin.id !== label.id && Math.hypot(pin.x - label.anchorX, pin.y - label.anchorY) > 10).forEach(pin => {
              expect(Math.min(...line.map(point => Math.hypot(point.x - pin.x, point.y - pin.y))), `${label.id} grazes ${pin.id} (${size.width}, ${zoom}, ${centre.id})`).toBeGreaterThan(4);
            });
            shown.filter(other => other !== label).forEach(other => {
              expect(line.some(point => Math.abs(point.x - other.x) < other.width / 2 && Math.abs(point.y - other.y) < 15), `${label.id} runs under ${other.id} (${size.width}, ${zoom}, ${centre.id})`).toBe(false);
            });
          });
        }
      }
    }
  });

  it('keeps labels off a soft obstacle such as the parked airliner', () => {
    const size = { width: 1342, height: 520 };
    const frame = globeFrame(size);
    const view = viewForGeo(races[7].geo);
    const anchors = races.map(race => {
      const point = projectGeo(race.geo, view, frame);
      return { id: race.id, x: point.x, y: point.y, z: point.z, visible: point.z > 0.12, priority: race === races[7] ? 1 : 0 };
    });
    const free = layoutGlobeLabels(anchors, size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius });
    const tokyo = free.find(label => label.id === 'tokyo');
    // Park the obstacle exactly where Tokyo's label would go.
    const obstacle = { x: tokyo.x, y: tokyo.y, halfWidth: 16, halfHeight: 14 };
    const moved = layoutGlobeLabels(anchors, size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius, obstacles: [obstacle] })
      .find(label => label.id === 'tokyo');
    expect(Math.abs(moved.x - obstacle.x) >= moved.width / 2 - 2 + obstacle.halfWidth || Math.abs(moved.y - obstacle.y) >= moved.height / 2 - 8 + obstacle.halfHeight).toBe(true);
  });

  it('marks far-side races hidden and keeps anchors on the true pin', () => {
    const size = { width: 348, height: 360 };
    const frame = globeFrame(size);
    const view = viewForGeo(races[0].geo);
    const anchors = races.map(race => ({ id: race.id, ...projectGeo(race.geo, view, frame), visible: projectGeo(race.geo, view, frame).z > 0.12 }));
    const labels = layoutGlobeLabels(anchors, size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius });
    expect(labels.find(label => label.id === 'sydney').hidden).toBe(true);
    labels.forEach((label, index) => expect({ x: label.anchorX, y: label.anchorY }).toEqual({ x: anchors[index].x, y: anchors[index].y }));
  });

  it('keeps a label on the same side while its pin drifts', () => {
    const size = { width: 1342, height: 520 };
    const frame = globeFrame(size);
    const layout = view => layoutGlobeLabels(races.map(race => {
      const point = projectGeo(race.geo, view, frame);
      return { id: race.id, x: point.x, y: point.y, visible: point.z > 0.12 };
    }), size, { center: { x: frame.cx, y: frame.cy }, radius: frame.radius, previous });
    let previous = new Map();
    const first = layout({ lat: 45, lng: 10 });
    previous = new Map(first.map(label => [label.id, label.key]));
    const next = layout({ lat: 45, lng: 9.9 });
    expect(next.filter(label => !label.hidden).map(label => label.key)).toEqual(first.filter(label => !label.hidden).map(label => label.key));
  });
});

describe('flight camera', () => {
  const berlin = { lat: 52.52, lng: 13.405 };
  const sydney = { lat: -33.8688, lng: 151.2093 };

  it('aims ahead of the airliner on its great circle and lands on the destination', () => {
    const start = followView(berlin, sydney, 0);
    const aim = slerpGeo(berlin, sydney, GLOBE_FOLLOW_LEAD);
    expect(start.lat).toBeCloseTo(aim.lat, 6);
    expect(start.lng).toBeCloseTo(aim.lng, 6);
    const end = followView(berlin, sydney, 1);
    expect(end.lat).toBeCloseTo(viewForGeo(sydney).lat, 6);
    expect(end.lng).toBeCloseTo(viewForGeo(sydney).lng, 6);
    // Always at or ahead of the airliner, never behind it.
    for (let t = 0; t <= 1; t += 0.125) {
      const plane = slerpGeo(berlin, sydney, t);
      const target = followView(berlin, sydney, t);
      expect(angularDistance(berlin, target)).toBeGreaterThanOrEqual(angularDistance(berlin, plane) - 1e-9);
    }
  });

  it('keeps the airliner on the visible hemisphere for a long-haul flight', () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const view = followView(berlin, sydney, t);
      const point = projectGeo(slerpGeo(berlin, sydney, t), view, { cx: 0, cy: 0, radius: 1 });
      expect(point.z).toBeGreaterThan(0.4);
    }
  });
});
