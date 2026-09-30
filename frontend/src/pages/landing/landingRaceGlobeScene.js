// Imperative scene for LandingRaceMap: owns the globe camera, the airliner,
// the tour clock and the single requestAnimationFrame loop. React owns the
// markup and the UI state; this module paints the canvas and positions the
// label buttons, callouts and aircraft directly so a moving globe never
// re-renders the component tree.
import { LANDING_GLOBE_LAND_RUNS, LANDING_GLOBE_POINT_COUNT } from '../../data/landingGlobeLand';
import {
  GLOBE_FLIGHT_MS, GLOBE_SPIN_DEG_PER_SECOND, GLOBE_TOUR_STEP_MS,
  angularDistance, clamp, clampViewLat, decodeLandRuns, easeInOutCubic, flightPose, getTourFrame, globeFrame,
  followView, interpolateView, landVectors, layoutGlobeLabels, normalizeLng, projectGeo, projectVector, resampleLand, sampleArc, screenHeading, toVector, viewForGeo, viewRotation,
} from '../../utils/landingGlobe';

const DEG = 180 / Math.PI;
const LABEL_MIN_DEPTH = 0.12;
const LABEL_SWITCH_MS = 240;
// Labels are re-laid out only once pins have shifted this far relative to each other.
const LABEL_RELAYOUT_PX = 3;
const TOUR_CAMERA_BLEND_MS = 700;
const ZOOM_TIME_CONSTANT_MS = 90;
const MAX_FRAME_DELTA_MS = 1000;
// A press only becomes a globe drag once it travels this far; a touch swipe
// must also be mostly horizontal, so vertical swipes stay page scrolls.
const DRAG_THRESHOLD_PX = 6;
const PLANE_TURN_MS = 240;
const LAND_RGB = '118, 106, 96';
const LAND_ALPHA = [0.2, 0.34, 0.48, 0.6, 0.7];
const ROUTE_RGB = '160, 57, 42';

// Two levels of detail: the dense generated lattice when zoomed in, and a
// coarser lattice resampled from it for the whole-globe view.
const COARSE_LAND_COUNT = 20000;
const DENSE_LAND_ZOOM = 2;
const LAND_FADE_MS = 260;
const DOT_SCALE = { coarse: 0.0062, dense: 0.0062 * Math.sqrt(COARSE_LAND_COUNT / LANDING_GLOBE_POINT_COUNT) };
let land = null;
function getLand() {
  if (!land) {
    const flags = decodeLandRuns(LANDING_GLOBE_LAND_RUNS, LANDING_GLOBE_POINT_COUNT);
    land = { coarse: landVectors(resampleLand(flags, LANDING_GLOBE_POINT_COUNT, COARSE_LAND_COUNT)), dense: landVectors(flags) };
  }
  return land;
}
let graticule = null;
const getGraticule = () => (graticule ??= [
  ...Array.from({ length: 12 }, (_, meridian) => Array.from({ length: 46 }, (__, index) => toVector({ lat: -90 + index * 4, lng: -180 + meridian * 30 }))),
  ...[-60, -30, 0, 30, 60].map(lat => Array.from({ length: 91 }, (_, index) => toVector({ lat, lng: -180 + index * 4 }))),
]);

function getContext(canvas) {
  try {
    return canvas?.getContext?.('2d') ?? null;
  } catch {
    return null;
  }
}

function drawSphere(ctx, { cx, cy, radius }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.shadowColor = 'rgba(92, 70, 54, 0.13)';
  ctx.shadowBlur = Math.min(48, radius * 0.16);
  ctx.shadowOffsetY = Math.min(18, radius * 0.05);
  const light = ctx.createRadialGradient(cx - radius * 0.42, cy - radius * 0.46, radius * 0.04, cx - radius * 0.16, cy - radius * 0.2, radius * 1.22);
  light.addColorStop(0, '#fdfcfa');
  light.addColorStop(0.45, '#f8f5f1');
  light.addColorStop(1, '#ece5de');
  ctx.fillStyle = light;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.5, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150, 128, 112, 0.34)';
  ctx.stroke();
}

function traceVectors(ctx, vectors, rotation, frame, altitudeAt = () => 0, frontOnly = false) {
  let drawing = false;
  vectors.forEach((vector, index) => {
    const point = projectVector(vector, rotation, frame, altitudeAt(index));
    if (!point.visible || (frontOnly && point.z <= 0)) { drawing = false; return; }
    if (drawing) ctx.lineTo(point.x, point.y);
    else ctx.moveTo(point.x, point.y);
    drawing = true;
  });
}

function drawGraticule(ctx, rotation, frame) {
  ctx.beginPath();
  getGraticule().forEach(line => traceVectors(ctx, line, rotation, frame));
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = 'rgba(120, 104, 92, 0.09)';
  ctx.stroke();
}

// Dots smaller than this (in device pixels) are drawn as squares with
// fillRect, which is several times cheaper than tracing an arc and looks the
// same at that size; larger dots (zoomed in, high-DPI) stay round and are
// stamped from one pre-rendered dot sprite, which is far cheaper per frame
// than filling a path of thousands of arcs.
const ROUND_DOT_MIN_DEVICE_RADIUS = 2;
let squareDots = null;
let roundDots = null;
let dotSprite = null;

function getDotSprite(deviceRadius) {
  const radius = Math.max(2, Math.ceil(deviceRadius));
  if (dotSprite && dotSprite.radius >= radius) return dotSprite;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const size = radius * 2 + 2;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext?.('2d');
  if (!context) return null;
  context.fillStyle = `rgb(${LAND_RGB})`;
  context.beginPath();
  context.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  context.fill();
  dotSprite = { canvas, radius, size };
  return dotSprite;
}

function drawLand(ctx, points, dotScale, opacity, rotation, frame, size, dpr) {
  const { cosL, sinL, cosP, sinP } = rotation;
  const { cx, cy, radius } = frame;
  const dot = clamp(radius * dotScale, 0.7, 2.4);
  const minRound = ROUND_DOT_MIN_DEVICE_RADIUS / dpr;
  // Per alpha bucket, square and round dots as packed [x, y, r] triples.
  if (!squareDots || squareDots[0].length < points.length) {
    squareDots = LAND_ALPHA.map(() => new Float32Array(points.length));
    roundDots = LAND_ALPHA.map(() => new Float32Array(points.length));
  }
  const squareCounts = LAND_ALPHA.map(() => 0);
  const roundCounts = LAND_ALPHA.map(() => 0);
  const sprite = getDotSprite(dot * dpr);
  for (let index = 0; index < points.length; index += 3) {
    const x = points[index];
    const y = points[index + 1];
    const z = points[index + 2];
    const x1 = x * cosL - z * sinL;
    const z1 = x * sinL + z * cosL;
    const depth = y * sinP + z1 * cosP;
    if (depth <= 0) continue;
    const sx = cx + x1 * radius;
    const sy = cy - (y * cosP - z1 * sinP) * radius;
    if (sx < -4 || sy < -4 || sx > size.width + 4 || sy > size.height + 4) continue;
    const r = dot * (0.5 + 0.5 * Math.sqrt(depth));
    const bucket = Math.min(LAND_ALPHA.length - 1, Math.floor(depth * LAND_ALPHA.length));
    const round = r >= minRound && sprite;
    const buffer = round ? roundDots[bucket] : squareDots[bucket];
    const counts = round ? roundCounts : squareCounts;
    const offset = counts[bucket];
    buffer[offset] = sx;
    buffer[offset + 1] = sy;
    // A square of equal area to the round dot.
    buffer[offset + 2] = round ? r : r * 0.886;
    counts[bucket] = offset + 3;
  }
  ctx.save();
  ctx.fillStyle = `rgb(${LAND_RGB})`;
  LAND_ALPHA.forEach((alpha, bucket) => {
    ctx.globalAlpha = alpha * opacity;
    const squares = squareDots[bucket];
    for (let offset = 0; offset < squareCounts[bucket]; offset += 3) {
      const half = squares[offset + 2];
      ctx.fillRect(squares[offset] - half, squares[offset + 1] - half, half * 2, half * 2);
    }
    if (!sprite) return;
    const dots = roundDots[bucket];
    // The sprite's circle has radius sprite.radius inside a canvas of sprite.size.
    const unit = sprite.size / sprite.radius;
    for (let offset = 0; offset < roundCounts[bucket]; offset += 3) {
      const r = dots[offset + 2];
      const extent = r * unit;
      ctx.drawImage(sprite.canvas, dots[offset] - extent / 2, dots[offset + 1] - extent / 2, extent, extent);
    }
  });
  ctx.restore();
}

function drawRoute(ctx, leg, rotation, frame) {
  const samples = 64;
  const route = Array.from({ length: samples + 1 }, (_, index) => sampleArc(leg.from, leg.to, index / samples));
  const vectors = route.map(toVector);
  const flown = Math.max(1, Math.round(leg.progress * samples));
  ctx.save();
  // The flight altitude is exaggerated, so arc points behind the globe could
  // project past its edge; only the front half is drawn, inside the disc.
  ctx.beginPath();
  ctx.arc(frame.cx, frame.cy, frame.radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = 'round';
  ctx.beginPath();
  traceVectors(ctx, vectors, rotation, frame, index => route[index].altitude, true);
  ctx.setLineDash([2, 5]);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = `rgba(${ROUTE_RGB}, 0.32)`;
  ctx.stroke();
  ctx.beginPath();
  traceVectors(ctx, vectors.slice(0, flown + 1), rotation, frame, index => route[index].altitude, true);
  ctx.setLineDash([]);
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = `rgba(${ROUTE_RGB}, 0.78)`;
  ctx.stroke();
  ctx.restore();
}

const UNIT_FRAME = { cx: 0, cy: 0, radius: 1 };
const boxesIntersect = (a, b) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;

export function createRaceGlobeScene({ viewport, canvas, aircraft, airliner, markers, callouts, onActiveRace, onSpinChange, onDragStart }) {
  const ctx = getContext(canvas);
  const state = { races: [], selectedId: null, playing: false, reducedMotion: false, active: false, size: null, zoom: 1 };
  const scene = {
    view: { lat: 0, lng: 0 }, zoom: 1, camera: null, flight: null, plane: null, planeAngle: 0, planeLeg: null, planeTurn: null, leg: null,
    tourElapsed: 0, spin: true, holds: new Set(), labels: new Map(), layout: null, drag: null, landMix: 0,
  };
  let frameId = 0;
  let lastTime = null;
  let destroyed = false;
  let sphereCache = null;
  let paintedSignature = null;
  let settling = false;

  const motion = () => !state.reducedMotion;
  const raceIndex = id => state.races.findIndex(race => race.id === id);
  const selectedRace = () => state.races[Math.max(0, raceIndex(state.selectedId))];
  const parkedPose = (race, index = raceIndex(race.id)) => {
    const next = state.races[(index + 1) % state.races.length] ?? race;
    return { ...flightPose(race.geo, next.geo, 0), destination: race.id, phase: 'dwell' };
  };
  const arrivedPose = (from, race) => (angularDistance(from, race.geo) < 1e-6
    ? { ...scene.plane, lat: race.geo.lat, lng: race.geo.lng, altitude: 0, destination: race.id, phase: 'dwell' }
    : { ...flightPose(from, race.geo, 1), destination: race.id, phase: 'dwell' });
  const dragging = () => Boolean(scene.drag?.committed);
  const spinning = () => scene.spin && motion() && !state.playing && !scene.flight && !scene.camera && !dragging() && scene.holds.size === 0;
  const canRun = () => state.active && !destroyed;
  const landTarget = () => (state.zoom >= DENSE_LAND_ZOOM ? 1 : 0);
  const wantsFrame = () => (state.playing && state.races.length > 1) || Boolean(scene.flight || scene.camera)
    || scene.zoom !== state.zoom || scene.landMix !== landTarget() || spinning() || settling;
  // Decode the land dots while the browser is idle, before the globe scrolls into view.
  const idle = ctx && typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(() => getLand(), { timeout: 3000 }) : null;

  function hold(reason, on) {
    if (on) scene.holds.add(reason);
    else scene.holds.delete(reason);
    ensureLoop();
  }

  function setSpin(on) {
    const next = Boolean(on) && motion();
    if (scene.spin === next) return;
    scene.spin = next;
    onSpinChange?.(next);
  }

  function syncRaces(previousRaces) {
    if (!state.races.length) { scene.plane = null; scene.flight = null; scene.leg = null; return; }
    const known = scene.plane && raceIndex(scene.plane.destination) >= 0;
    if (!known) {
      const race = selectedRace();
      scene.plane = parkedPose(race);
      scene.flight = null;
      scene.leg = null;
      if (!previousRaces.length) scene.view = viewForGeo(race.geo);
    }
    const ids = new Set(state.races.map(race => race.id));
    [...scene.labels.keys()].forEach(id => { if (!ids.has(id)) scene.labels.delete(id); });
  }

  function finishMotion() {
    if (scene.flight) {
      const race = state.races[raceIndex(scene.flight.id)];
      scene.plane = race ? arrivedPose(scene.flight.from, race) : scene.plane;
      scene.flight = null;
      scene.leg = null;
    }
    if (scene.camera && scene.camera.to !== 'tour') scene.view = { ...scene.camera.to };
    scene.camera = null;
    scene.zoom = state.zoom;
    scene.landMix = landTarget();
  }

  // Where the tour clock puts the airliner and the camera right now.
  function tourPose() {
    const { races } = state;
    const frame = getTourFrame(races.length, scene.tourElapsed);
    const source = races[frame.sourceIndex];
    const target = races[frame.targetIndex];
    if (frame.travelling && motion()) {
      const eased = easeInOutCubic(frame.progress);
      return {
        plane: { ...flightPose(source.geo, target.geo, eased), destination: target.id, phase: 'travelling' },
        leg: { from: source.geo, to: target.geo, progress: eased },
        view: interpolateView(viewForGeo(source.geo), followView(source.geo, target.geo, eased), frame.progress),
        activeId: target.id,
      };
    }
    const active = races[frame.activeIndex];
    const previous = races[(frame.activeIndex + races.length - 1) % races.length];
    return { plane: arrivedPose(previous.geo, active), leg: null, view: viewForGeo(active.geo), activeId: active.id };
  }

  function step(dt) {
    const { races } = state;
    if (!races.length) return false;
    let moving = false;
    if (state.playing && races.length > 1) {
      scene.tourElapsed += dt;
      const tour = tourPose();
      scene.plane = tour.plane;
      scene.leg = tour.leg;
      if (scene.camera?.to === 'tour') {
        scene.camera.elapsed += dt;
        scene.view = interpolateView(scene.camera.from, tour.view, scene.camera.elapsed / scene.camera.duration);
        if (scene.camera.elapsed >= scene.camera.duration) scene.camera = null;
      } else scene.view = tour.view;
      if (tour.activeId !== state.selectedId) onActiveRace?.(tour.activeId);
      moving = true;
    } else if (scene.flight) {
      const flight = scene.flight;
      flight.elapsed += dt;
      const t = motion() ? Math.min(1, flight.elapsed / flight.duration) : 1;
      const eased = easeInOutCubic(t);
      const pose = flightPose(flight.from, flight.to, eased);
      scene.plane = { ...pose, altitude: pose.altitude + flight.startAltitude * (1 - eased), destination: flight.id, phase: t < 1 ? 'travelling' : 'dwell' };
      scene.leg = t < 1 ? { from: flight.from, to: flight.to, progress: eased } : null;
      if (t < 1) moving = true;
      else scene.flight = null;
    }
    if (scene.camera && scene.camera.to !== 'tour') {
      const camera = scene.camera;
      camera.elapsed += dt;
      const t = motion() ? camera.elapsed / camera.duration : 1;
      const target = camera.follow ? followView(camera.follow.from, camera.follow.to, easeInOutCubic(Math.min(1, t))) : camera.to;
      scene.view = interpolateView(camera.from, target, t);
      if (t >= 1) scene.camera = null;
      else moving = true;
    }
    if (spinning()) {
      scene.view = { lat: scene.view.lat, lng: normalizeLng(scene.view.lng - GLOBE_SPIN_DEG_PER_SECOND * dt / 1000) };
      moving = true;
    }
    if (scene.zoom !== state.zoom) {
      const next = scene.zoom + (state.zoom - scene.zoom) * (1 - Math.exp(-dt / ZOOM_TIME_CONSTANT_MS));
      scene.zoom = !motion() || Math.abs(state.zoom - next) < 0.002 ? state.zoom : next;
      moving = moving || scene.zoom !== state.zoom;
    }
    if (scene.landMix !== landTarget()) {
      const target = landTarget();
      const next = scene.landMix + Math.sign(target - scene.landMix) * dt / LAND_FADE_MS;
      scene.landMix = !motion() || Math.abs(target - next) < 0.01 || Math.sign(target - next) !== Math.sign(target - scene.landMix) ? target : next;
      moving = moving || scene.landMix !== target;
    }
    return moving;
  }

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(state.size.width * dpr);
    const height = Math.round(state.size.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return dpr;
  }

  // The shaded disc (gradient + soft blurred shadow) only changes with size or
  // zoom, so it is rendered once into an offscreen canvas and blitted per
  // frame. While a zoom eases, the cached disc is scaled instead of re-baked.
  function paintSphere(frame, dpr) {
    const key = `${canvas.width}x${canvas.height}@${dpr}:${frame.cx}:${frame.cy}`;
    const stale = sphereCache?.key !== key || Math.abs(sphereCache.radius - frame.radius) > 0.01;
    const zooming = scene.zoom !== state.zoom && sphereCache?.key === key;
    if (stale && !zooming) {
      const layer = sphereCache?.layer ?? document.createElement('canvas');
      layer.width = canvas.width;
      layer.height = canvas.height;
      const layerContext = getContext(layer);
      if (!layerContext) { drawSphere(ctx, frame); return; }
      layerContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      layerContext.clearRect(0, 0, state.size.width, state.size.height);
      drawSphere(layerContext, frame);
      sphereCache = { key, layer, radius: frame.radius };
    }
    const scale = frame.radius / sphereCache.radius;
    const originX = frame.cx * dpr * (1 - scale);
    const originY = frame.cy * dpr * (1 - scale);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, originX, originY);
    ctx.drawImage(sphereCache.layer, 0, 0);
    ctx.restore();
  }

  function paintCanvas(frame, rotation) {
    if (!ctx) return;
    const dpr = sizeCanvas();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, state.size.width, state.size.height);
    paintSphere(frame, dpr);
    drawGraticule(ctx, rotation, frame);
    const { coarse, dense } = getLand();
    if (scene.landMix < 1) drawLand(ctx, coarse, DOT_SCALE.coarse, 1 - scene.landMix, rotation, frame, state.size, dpr);
    if (scene.landMix > 0) drawLand(ctx, dense, DOT_SCALE.dense, scene.landMix, rotation, frame, state.size, dpr);
    if (scene.leg) drawRoute(ctx, scene.leg, rotation, frame);
  }

  function setHidden(button, hidden) {
    if (hidden) {
      if (button === document.activeElement) viewport.focus({ preventScroll: true });
      if (button.style.visibility !== 'hidden') button.style.visibility = 'hidden';
      if (button.getAttribute('aria-hidden') !== 'true') button.setAttribute('aria-hidden', 'true');
      if (button.tabIndex !== -1) button.tabIndex = -1;
    } else {
      if (button.style.visibility) button.style.visibility = '';
      if (button.hasAttribute('aria-hidden')) button.removeAttribute('aria-hidden');
      if (button.tabIndex !== 0) button.tabIndex = 0;
    }
  }

  function setSide(button, z) {
    const side = z > 0 ? 'front' : 'back';
    if (button.dataset.side !== side) button.dataset.side = side;
  }

  // Offscreen: keep far-side labels out of the tab order and the accessibility
  // tree without painting anything.
  function syncVisibility() {
    const rotation = viewRotation(scene.view);
    state.races.forEach(race => {
      const button = markers.get(race.id);
      if (!button) return;
      const { z } = projectGeo(race.geo, scene.view, UNIT_FRAME, 0, rotation);
      setSide(button, z);
      setHidden(button, z <= LABEL_MIN_DEPTH);
    });
  }

  // The parked airliner's screen footprint: the body trails behind the nose.
  function planeObstacle(frame) {
    const { plane } = scene;
    if (!plane || plane.phase !== 'dwell') return null;
    const point = projectGeo(plane, scene.view, frame, plane.altitude);
    if (!point.visible) return null;
    const angle = scene.planeAngle / DEG;
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    return {
      x: point.x - Math.cos(angle) * 15, y: point.y - Math.sin(angle) * 15,
      halfWidth: 15 * cos + 13 * sin, halfHeight: 15 * sin + 13 * cos,
    };
  }

  // Re-run the label solver only when the arrangement changed: pins (or the
  // parked airliner) moved relative to each other, visibility changed, or a
  // label would leave the viewport. Otherwise each label keeps its offset from
  // its pin, which keeps it clear of the other labels and pins.
  function layoutLabels(anchors, frame) {
    const obstacle = planeObstacle(frame);
    const cached = scene.layout;
    const points = [...anchors, ...(obstacle ? [obstacle] : [])];
    const reuse = cached && cached.size === state.size && cached.selectedId === state.selectedId
      && cached.points.length === points.length && Boolean(cached.obstacle) === Boolean(obstacle)
      && anchors.every((anchor, index) => {
        const before = cached.anchors[index];
        return before.id === anchor.id && before.visible === anchor.visible && (before.z > 0) === (anchor.z > 0);
      })
      && points.every((point, index) => points.every((other, otherIndex) => otherIndex <= index
        || Math.hypot(
          (point.x - other.x) - (cached.points[index].x - cached.points[otherIndex].x),
          (point.y - other.y) - (cached.points[index].y - cached.points[otherIndex].y),
        ) <= LABEL_RELAYOUT_PX));
    if (reuse) {
      const labels = cached.labels.map((label, index) => ({
        ...label, anchorX: anchors[index].x, anchorY: anchors[index].y,
        x: anchors[index].x + label.x - label.anchorX, y: anchors[index].y + label.y - label.anchorY,
      }));
      const { width, height } = state.size;
      const shown = labels.filter(label => !label.hidden);
      // Pins drift relative to each other between re-layouts, so reused offsets
      // must still keep every pair of labels apart.
      const apart = shown.every((label, index) => shown.every((other, otherIndex) => otherIndex <= index || !boxesIntersect(label, other)));
      if (apart && shown.every(label => label.x >= label.width / 2 + 6 && label.x <= width - label.width / 2 - 6
        && label.y >= label.height / 2 + 6 && label.y <= height - label.height / 2 - 6)) return labels;
    }
    const previous = new Map([...scene.labels].map(([id, label]) => [id, label.key]));
    const labels = layoutGlobeLabels(anchors, state.size, {
      previous, center: { x: frame.cx, y: frame.cy }, radius: frame.radius, obstacles: obstacle ? [obstacle] : [],
    });
    scene.layout = { size: state.size, selectedId: state.selectedId, anchors, obstacle, points, labels };
    return labels;
  }

  function paintLabels(frame, rotation, dt) {
    const { size } = state;
    const anchors = state.races.map(race => {
      const point = projectGeo(race.geo, scene.view, frame, 0, rotation);
      return { id: race.id, x: point.x, y: point.y, z: point.z, visible: point.z > LABEL_MIN_DEPTH, priority: race.id === state.selectedId ? 1 : 0 };
    });
    const layout = layoutLabels(anchors, frame);
    const minX = label => label.width / 2 + 6;
    const maxX = label => Math.max(minX(label), size.width - label.width / 2 - 6);
    const minY = label => label.height / 2 + 6;
    const maxY = label => Math.max(minY(label), size.height - label.height / 2 - 6);
    const items = layout.map((label, index) => {
      const targetX = label.x - label.anchorX;
      const targetY = label.y - label.anchorY;
      let entry = scene.labels.get(label.id);
      if (label.hidden || !entry || entry.hidden || !motion()) {
        entry = { key: label.key, dx: targetX, dy: targetY, from: null, hidden: Boolean(label.hidden) };
      } else if (entry.key !== label.key) {
        entry = { ...entry, key: label.key, from: { dx: entry.dx, dy: entry.dy }, progress: 0 };
      }
      if (entry.from) {
        entry.progress += dt / LABEL_SWITCH_MS;
        const k = easeInOutCubic(Math.min(1, entry.progress));
        entry.dx = entry.from.dx + (targetX - entry.from.dx) * k;
        entry.dy = entry.from.dy + (targetY - entry.from.dy) * k;
        if (entry.progress >= 1) entry.from = null;
      } else {
        entry.dx = targetX;
        entry.dy = targetY;
      }
      scene.labels.set(label.id, entry);
      const item = { label, anchor: anchors[index], entry, targetX, targetY, width: label.width, height: label.height };
      item.place = () => {
        item.x = clamp(label.anchorX + entry.dx, minX(label), maxX(label));
        item.y = clamp(label.anchorY + entry.dy, minY(label), maxY(label));
      };
      item.place();
      return item;
    });
    // A label sliding to its new side must never pass through another label or
    // over a drawn pin (its own included): snap it straight to its target.
    const shown = items.filter(item => !item.label.hidden);
    const pins = anchors.filter(anchor => anchor.z > 0);
    const coversPin = item => pins.some(pin => Math.abs(pin.x - item.x) < item.width / 2 + 2 && Math.abs(pin.y - item.y) < item.height / 2 - 3);
    for (let snapped = true; snapped;) {
      snapped = false;
      for (const item of shown) {
        if (!item.entry.from || !(coversPin(item) || shown.some(other => other !== item && boxesIntersect(item, other)))) continue;
        item.entry.from = null;
        item.entry.dx = item.targetX;
        item.entry.dy = item.targetY;
        item.place();
        snapped = true;
      }
    }
    items.forEach(({ label, anchor, x, y }) => {
      const button = markers.get(label.id);
      if (button) {
        const transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
        if (button.style.transform !== transform) button.style.transform = transform;
        setSide(button, anchor.z);
        setHidden(button, Boolean(label.hidden));
      }
      const callout = callouts.get(label.id);
      if (callout) {
        const pinVisible = anchor.z > 0 && anchor.x > -8 && anchor.y > -8 && anchor.x < size.width + 8 && anchor.y < size.height + 8;
        callout.style.visibility = pinVisible ? '' : 'hidden';
        callout.style.opacity = pinVisible ? String(Math.min(1, 0.3 + anchor.z * 1.4).toFixed(3)) : '0';
        const [line, ...pins] = callout.children;
        line?.setAttribute('x1', anchor.x.toFixed(1));
        line?.setAttribute('y1', anchor.y.toFixed(1));
        line?.setAttribute('x2', x.toFixed(1));
        line?.setAttribute('y2', y.toFixed(1));
        line?.style.setProperty('visibility', label.hidden ? 'hidden' : '');
        pins.forEach(pin => { pin.setAttribute('cx', anchor.x.toFixed(1)); pin.setAttribute('cy', anchor.y.toFixed(1)); });
      }
    });
    return shown.some(item => item.entry.from);
  }

  function paintAircraft(frame, rotation, dt) {
    const { plane } = scene;
    if (!aircraft || !plane) return false;
    const point = projectGeo(plane, scene.view, frame, plane.altitude, rotation);
    const ahead = projectGeo(plane.ahead, scene.view, frame, plane.ahead.altitude, rotation);
    const heading = Math.hypot(ahead.x - point.x, ahead.y - point.y) > 1e-3 ? screenHeading(point, ahead) : scene.planeAngle;
    // A new leg turns the parked nose onto the arc instead of snapping it round.
    const leg = plane.phase === 'travelling' ? plane.destination : null;
    if (leg && leg !== scene.planeLeg && motion()) scene.planeTurn = { from: scene.planeAngle, elapsed: 0 };
    scene.planeLeg = leg;
    if (scene.planeTurn) {
      scene.planeTurn.elapsed += dt;
      const k = easeInOutCubic(Math.min(1, scene.planeTurn.elapsed / PLANE_TURN_MS));
      scene.planeAngle = scene.planeTurn.from + normalizeLng(heading - scene.planeTurn.from) * k;
      if (k >= 1) scene.planeTurn = null;
    } else scene.planeAngle = heading;
    aircraft.setAttribute('transform', `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${scene.planeAngle.toFixed(2)})`);
    aircraft.style.visibility = point.z > 0 ? '' : 'hidden';
    aircraft.dataset.destination = plane.destination;
    aircraft.dataset.flightPhase = plane.phase;
    airliner?.setAttribute('transform', `scale(${(0.62 * (1 + plane.altitude * 3)).toFixed(3)})`);
    return Boolean(scene.planeTurn);
  }

  // Everything a painted frame depends on; an unchanged signature (a tour
  // dwell, a paused flight) needs no repaint.
  function signature() {
    const { plane, leg, view, zoom } = scene;
    return [view.lat, view.lng, zoom, scene.landMix, plane?.lat, plane?.lng, plane?.altitude, plane?.destination, plane?.phase, leg?.progress, state.selectedId].join('|');
  }

  function paint(dt = 0) {
    if (!state.size?.width || !state.size?.height || !state.races.length) return false;
    const frame = globeFrame(state.size, scene.zoom);
    const rotation = viewRotation(scene.view);
    paintCanvas(frame, rotation);
    const turning = paintAircraft(frame, rotation, dt);
    const sliding = paintLabels(frame, rotation, dt);
    const lat = scene.view.lat.toFixed(2);
    const lng = scene.view.lng.toFixed(2);
    if (viewport.dataset.viewLat !== lat) viewport.dataset.viewLat = lat;
    if (viewport.dataset.viewLng !== lng) viewport.dataset.viewLng = lng;
    paintedSignature = signature();
    settling = turning || sliding;
    return settling;
  }

  function tick(time) {
    frameId = 0;
    const dt = lastTime === null ? 0 : clamp(time - lastTime, 0, MAX_FRAME_DELTA_MS);
    lastTime = time;
    const moving = step(dt);
    if (settling || signature() !== paintedSignature) paint(dt);
    if ((moving || settling) && canRun()) frameId = window.requestAnimationFrame(tick);
    else lastTime = null;
  }

  function ensureLoop() {
    if (frameId || !canRun() || !wantsFrame()) return;
    lastTime = null;
    frameId = window.requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = null;
  }

  // Paint now when on screen; offscreen, only keep label visibility honest and
  // paint once the globe becomes active.
  function refresh() {
    if (!state.active) { syncVisibility(); return; }
    paint(0);
    ensureLoop();
  }

  return {
    update(next) {
      const previous = { ...state };
      Object.assign(state, next);
      if (state.races !== previous.races) syncRaces(previous.races);
      // A new viewport size or race list re-lays labels from scratch instead of animating across it.
      if (state.races !== previous.races || state.size !== previous.size) { scene.labels.clear(); scene.layout = null; }
      if (state.reducedMotion) { setSpin(false); finishMotion(); }
      if (state.playing !== previous.playing) {
        if (state.playing && state.races.length > 1) {
          setSpin(false);
          if (scene.flight) finishMotion();
          // Blend back to the tour camera only if the visitor turned the globe meanwhile.
          const { view } = tourPose();
          const turned = Math.abs(view.lat - scene.view.lat) > 0.01 || Math.abs(normalizeLng(view.lng - scene.view.lng)) > 0.01;
          scene.camera = motion() && turned ? { from: { ...scene.view }, to: 'tour', elapsed: 0, duration: TOUR_CAMERA_BLEND_MS } : null;
        } else if (scene.camera?.to === 'tour') scene.camera = null;
      }
      if (!state.active) stopLoop();
      refresh();
    },
    // Fly the airliner along the great circle while the camera centres the destination.
    flyTo(id) {
      const index = raceIndex(id);
      if (index < 0 || !scene.plane) return;
      const race = state.races[index];
      setSpin(false);
      state.playing = false;
      scene.tourElapsed = index * GLOBE_TOUR_STEP_MS;
      const from = { lat: scene.plane.lat, lng: scene.plane.lng };
      const view = viewForGeo(race.geo);
      if (!motion() || angularDistance(from, race.geo) < 1e-4) {
        scene.plane = arrivedPose(from, race);
        scene.flight = null;
        scene.leg = null;
        if (motion()) scene.camera = { from: { ...scene.view }, to: view, elapsed: 0, duration: GLOBE_FLIGHT_MS };
        else { scene.view = view; scene.camera = null; }
      } else {
        scene.flight = { from, to: race.geo, id, elapsed: 0, duration: GLOBE_FLIGHT_MS, startAltitude: scene.plane.altitude };
        scene.plane = { ...scene.plane, destination: id, phase: 'travelling' };
        scene.camera = { from: { ...scene.view }, to: view, follow: { from, to: race.geo }, elapsed: 0, duration: GLOBE_FLIGHT_MS };
      }
      refresh();
    },
    recenter() {
      setSpin(false);
      const race = selectedRace();
      if (!race) return;
      if (motion()) scene.camera = { from: { ...scene.view }, to: viewForGeo(race.geo), elapsed: 0, duration: GLOBE_FLIGHT_MS };
      else { scene.view = viewForGeo(race.geo); scene.camera = null; }
      refresh();
    },
    rotateBy(deltaLat, deltaLng) {
      setSpin(false);
      scene.camera = null;
      scene.view = { lat: clampViewLat(scene.view.lat + deltaLat), lng: normalizeLng(scene.view.lng + deltaLng) };
      refresh();
    },
    interact() {
      setSpin(false);
    },
    // The visible pause control for the ambient rotation.
    setSpin(on) {
      setSpin(on);
      ensureLoop();
    },
    hold,
    // A mouse resting on the globe (the disc or a label) holds the spin; the
    // empty band around the disc does not.
    hover(event) {
      if (event.pointerType !== 'mouse' || !state.size) return;
      const bounds = viewport.getBoundingClientRect();
      const frame = globeFrame(state.size, scene.zoom);
      const onGlobe = Boolean(event.target?.closest?.('.landing-race-map-marker'))
        || Math.hypot(event.clientX - bounds.left - frame.cx, event.clientY - bounds.top - frame.cy) <= frame.radius;
      if (onGlobe !== scene.holds.has('hover')) hold('hover', onGlobe);
    },
    leave(event) {
      if (event.pointerType === 'mouse') hold('hover', false);
      if (scene.drag && !scene.drag.committed && scene.drag.pointer === event.pointerId) scene.drag = null;
    },
    // A press is only recorded here; it becomes a drag in moveDrag once it has
    // clearly moved, so taps and vertical page-scroll swipes change nothing.
    beginDrag(event) {
      if (scene.drag || event.isPrimary === false || event.button !== 0) return false;
      scene.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch', committed: false };
      return true;
    },
    moveDrag(event) {
      const drag = scene.drag;
      if (!drag || drag.pointer !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.committed) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        if (drag.touch && Math.abs(dx) <= Math.abs(dy)) { scene.drag = null; return; }
        drag.committed = true;
        drag.view = { ...scene.view };
        setSpin(false);
        scene.camera = null;
        viewport.setPointerCapture?.(event.pointerId);
        viewport.setAttribute('data-dragging', '');
        onDragStart?.();
      }
      const { radius } = globeFrame(state.size, scene.zoom);
      scene.view = {
        lat: clampViewLat(drag.view.lat + (dy / radius) * DEG),
        lng: normalizeLng(drag.view.lng - (dx / radius) * DEG),
      };
      refresh();
    },
    endDrag(event, released = false) {
      const drag = scene.drag;
      if (drag?.pointer !== event.pointerId) return;
      scene.drag = null;
      if (!drag.committed) return;
      viewport.removeAttribute('data-dragging');
      if (!released && viewport.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
      ensureLoop();
    },
    destroy() {
      destroyed = true;
      if (idle !== null) window.cancelIdleCallback?.(idle);
      stopLoop();
    },
  };
}
