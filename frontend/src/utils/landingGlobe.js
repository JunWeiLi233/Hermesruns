// Pure geometry for the landing page's race globe (pages/landing/LandingRaceMap.jsx).
// Coordinates are degrees; unit vectors use x = east at lng 90°, y = north, z = toward lng 0°.
// A view { lat, lng } is the geographic point shown at the globe's centre.

export const GLOBE_MIN_ZOOM = 1;
export const GLOBE_MAX_ZOOM = 2.5;
export const GLOBE_ZOOM_STEP = 0.5;
export const GLOBE_MAX_VIEW_LAT = 60;
export const GLOBE_KEY_STEP_DEG = 10;
export const GLOBE_SPIN_DEG_PER_SECOND = 5.5;
export const GLOBE_FLIGHT_MS = 900;
export const GLOBE_TOUR_DWELL_MS = 2100;
export const GLOBE_TOUR_STEP_MS = GLOBE_TOUR_DWELL_MS + GLOBE_FLIGHT_MS;

const RAD = Math.PI / 180;
const GOLDEN_ANGLE_DEG = 180 * (3 - Math.sqrt(5));

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const normalizeLng = lng => ((lng % 360) + 540) % 360 - 180;
export const clampViewLat = lat => clamp(Number.isFinite(lat) ? lat : 0, -GLOBE_MAX_VIEW_LAT, GLOBE_MAX_VIEW_LAT);
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

// Must match tools/generate-landing-globe-land.mjs, which wrote the land bitmask.
const fibonacciLng = index => ((index * GOLDEN_ANGLE_DEG) % 360 + 360) % 360 - 180;
export function fibonacciPoint(index, count) {
  return { lat: Math.asin(1 - (2 * index + 1) / count) * 180 / Math.PI, lng: fibonacciLng(index) };
}

export function toVector({ lat, lng }) {
  const phi = lat * RAD;
  const lambda = lng * RAD;
  return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
}

export function toGeo([x, y, z]) {
  const length = Math.hypot(x, y, z) || 1;
  return { lat: Math.asin(clamp(y / length, -1, 1)) / RAD, lng: Math.atan2(x, z) / RAD };
}

function decodeBase64(text) {
  if (typeof atob === 'function') return Uint8Array.from(atob(text), character => character.charCodeAt(0));
  return new Uint8Array(globalThis.Buffer.from(text, 'base64'));
}

// Must match tools/generate-landing-globe-land.mjs: bands of consecutive
// indices, each sorted by longitude (quantized to 1/4096°, ties by index),
// give the order the land runs follow.
export const landBandSize = count => Math.max(1, Math.round(Math.sqrt(count * Math.PI)));
const bandOrders = new Map();
// Longitude + 180° of every index, stepped by the golden angle: cheaper than a
// modulo per point, and the generator steps identically, so both sort on
// exactly the same keys.
function steppedTurns(count) {
  const turns = new Float64Array(count);
  let turn = 0;
  for (let index = 0; index < count; index += 1) {
    turns[index] = turn;
    turn += GOLDEN_ANGLE_DEG;
    if (turn >= 360) turn -= 360;
  }
  return turns;
}

function bandLayout(count) {
  if (bandOrders.has(count)) return bandOrders.get(count);
  const band = landBandSize(count);
  const turns = steppedTurns(count);
  const keys = new Float64Array(band);
  const order = new Int32Array(count);
  for (let start = 0; start < count; start += band) {
    const size = Math.min(count, start + band) - start;
    const slice = keys.subarray(0, size);
    for (let offset = 0; offset < size; offset += 1) slice[offset] = Math.floor(turns[start + offset] * 4096) * 65536 + offset;
    slice.sort();
    for (let offset = 0; offset < size; offset += 1) order[start + offset] = start + (slice[offset] % 65536);
  }
  const layout = { order, turns };
  bandOrders.set(count, layout);
  return layout;
}

export const landBandOrder = count => bandLayout(count).order;

// Decodes alternating water/land run lengths (LEB128 varints, water first, in
// landBandOrder) into one land flag per lattice index.
export function decodeLandRuns(base64, count) {
  const data = decodeBase64(base64);
  const order = landBandOrder(count);
  const flags = new Uint8Array(count);
  let position = 0;
  let cursor = 0;
  let land = false;
  while (cursor < data.length && position < count) {
    let run = 0;
    let shift = 0;
    let byte;
    do { byte = data[cursor]; cursor += 1; run += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80 && cursor < data.length);
    const end = Math.min(count, position + run);
    if (land) for (let index = position; index < end; index += 1) flags[order[index]] = 1;
    position = end;
    land = !land;
  }
  return flags;
}

// The land flags of a (coarser) `targetCount` lattice, each taken from the
// dense point beside it: the dense band at the same latitude, sorted by
// longitude, is binary-searched for the closest longitude.
export function resampleLand(flags, count, targetCount) {
  const { order, turns } = bandLayout(count);
  const band = landBandSize(count);
  const lngs = new Float64Array(count);
  for (let position = 0; position < count; position += 1) lngs[position] = turns[order[position]];
  const targetTurns = steppedTurns(targetCount);
  const result = new Uint8Array(targetCount);
  for (let target = 0; target < targetCount; target += 1) {
    const lng = targetTurns[target];
    // Inverse of fibonacciPoint's latitude: the dense index at this latitude.
    const denseIndex = clamp(Math.round(((2 * target + 1) / targetCount * count - 1) / 2), 0, count - 1);
    const start = Math.floor(denseIndex / band) * band;
    const size = Math.min(count, start + band) - start;
    let low = start;
    let high = start + size;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (lngs[middle] < lng) low = middle + 1;
      else high = middle;
    }
    const after = low < start + size ? low : start;
    const before = low > start ? low - 1 : start + size - 1;
    const gapAfter = Math.abs(lngs[after] - lng);
    const gapBefore = Math.abs(lngs[before] - lng);
    result[target] = flags[order[Math.min(gapBefore, 360 - gapBefore) < Math.min(gapAfter, 360 - gapAfter) ? before : after]];
  }
  return result;
}

// Returns the unit vectors of every land point as a flat Float32Array [x, y, z, ...].
export function landVectors(flags, count = flags.length) {
  let land = 0;
  for (let index = 0; index < count; index += 1) land += flags[index] ? 1 : 0;
  const points = new Float32Array(land * 3);
  let offset = 0;
  for (let index = 0; index < count; index += 1) {
    if (!flags[index]) continue;
    const y = 1 - (2 * index + 1) / count;
    const ring = Math.sqrt(1 - y * y);
    const lambda = fibonacciLng(index) * RAD;
    points[offset] = ring * Math.sin(lambda);
    points[offset + 1] = y;
    points[offset + 2] = ring * Math.cos(lambda);
    offset += 3;
  }
  return points;
}

// Camera rotation: yaw by -view.lng around the polar axis, then pitch by view.lat.
export function viewRotation(view) {
  const lambda = view.lng * RAD;
  const phi = view.lat * RAD;
  return { cosL: Math.cos(lambda), sinL: Math.sin(lambda), cosP: Math.cos(phi), sinP: Math.sin(phi) };
}

export function rotateVector(x, y, z, rotation) {
  const x1 = x * rotation.cosL - z * rotation.sinL;
  const z1 = x * rotation.sinL + z * rotation.cosL;
  return [x1, y * rotation.cosP - z1 * rotation.sinP, y * rotation.sinP + z1 * rotation.cosP];
}

// Orthographic projection. `frame` is { cx, cy, radius }; altitude is a
// fraction of the radius above the surface. A point is on the visible
// hemisphere when it faces the camera, or when it is raised far enough to
// clear the limb.
// Pass a precomputed `rotation` (viewRotation(view)) when projecting many points per frame.
export function projectVector(vector, rotation, frame, altitude = 0) {
  const [x, y, z] = rotateVector(vector[0], vector[1], vector[2], rotation);
  const scale = frame.radius * (1 + altitude);
  const visible = z > 0 || (x * x + y * y) * (1 + altitude) ** 2 > 1;
  return { x: frame.cx + x * scale, y: frame.cy - y * scale, z, visible };
}

export function projectGeo(geo, view, frame, altitude = 0, rotation = viewRotation(view)) {
  return projectVector(toVector(geo), rotation, frame, altitude);
}

export function angularDistance(a, b) {
  const [ax, ay, az] = toVector(a);
  const [bx, by, bz] = toVector(b);
  return Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1));
}

// Spherical linear interpolation along the great circle; t outside [0, 1] extrapolates.
export function slerpGeo(a, b, t) {
  const omega = angularDistance(a, b);
  if (omega < 1e-9) return { lat: a.lat, lng: a.lng };
  const va = toVector(a);
  const vb = toVector(b);
  const sin = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sin;
  const wb = Math.sin(t * omega) / sin;
  return toGeo([va[0] * wa + vb[0] * wb, va[1] * wa + vb[1] * wb, va[2] * wa + vb[2] * wb]);
}

// Peak altitude of a flight arc, as a fraction of the globe radius.
export function arcPeakAltitude(a, b) {
  return Math.min(0.14, 0.035 + angularDistance(a, b) * 0.06);
}

export function sampleArc(a, b, t) {
  const progress = clamp(t, 0, 1);
  return { ...slerpGeo(a, b, progress), altitude: arcPeakAltitude(a, b) * Math.sin(Math.PI * progress) };
}

// Plane position at arc progress t plus a point just ahead of it (≥1° further
// along the same great circle, extrapolated past the destination), so the
// nose can be oriented along the arc even while parked.
export function flightPose(a, b, t) {
  const pose = sampleArc(a, b, t);
  const omega = angularDistance(a, b);
  if (omega < 1e-9) return { ...pose, ahead: { lat: a.lat, lng: normalizeLng(a.lng + 1), altitude: 0 } };
  const aheadT = clamp(t, 0, 1) + Math.max(0.02, RAD / omega);
  const ahead = slerpGeo(a, b, aheadT);
  return { ...pose, ahead: { ...ahead, altitude: arcPeakAltitude(a, b) * Math.sin(Math.PI * clamp(aheadT, 0, 1)) } };
}

// Screen angle (degrees, SVG convention: clockwise from +x) from one projected point to another.
export function screenHeading(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x) / RAD;
}

export function viewForGeo(geo) {
  return { lat: clampViewLat(geo.lat), lng: normalizeLng(geo.lng) };
}

// How far ahead of the airliner (as a share of the remaining arc) the camera aims.
export const GLOBE_FOLLOW_LEAD = 0.3;

// Camera target while flying: a point on the great circle a little ahead of
// the airliner, so the globe rolls along the route and the arc is seen from
// above rather than edge-on. It reaches the destination when progress is 1.
export function followView(a, b, progress) {
  const p = clamp(progress, 0, 1);
  return viewForGeo(slerpGeo(a, b, p + GLOBE_FOLLOW_LEAD * (1 - p)));
}

// Eased camera move that turns the short way round in longitude.
export function interpolateView(from, to, t, ease = easeInOutCubic) {
  const k = ease(clamp(t, 0, 1));
  const deltaLng = normalizeLng(to.lng - from.lng);
  return { lat: from.lat + (to.lat - from.lat) * k, lng: normalizeLng(from.lng + deltaLng * k) };
}

// One clock drives the tour: dwell at a race, then fly to the next. While
// travelling the destination is already the active race.
export function getTourFrame(count, elapsedMs) {
  if (!count) return null;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const sourceIndex = Math.floor(elapsed / GLOBE_TOUR_STEP_MS) % count;
  const phase = elapsed % GLOBE_TOUR_STEP_MS;
  const travelling = count > 1 && phase >= GLOBE_TOUR_DWELL_MS;
  const targetIndex = (sourceIndex + 1) % count;
  return {
    sourceIndex,
    targetIndex,
    activeIndex: travelling ? targetIndex : sourceIndex,
    progress: travelling ? (phase - GLOBE_TOUR_DWELL_MS) / GLOBE_FLIGHT_MS : 0,
    travelling,
  };
}

export function globeFrame(size, zoom = 1) {
  const radius = Math.max(40, Math.min(size.width, size.height) / 2 - (size.width < 600 ? 22 : 30));
  return { cx: size.width / 2, cy: size.height / 2, radius: radius * zoom };
}

// Label placement adapted from the flat map's layoutRaceMarkers: every visible
// race keeps a separate ≥44px touch target contained in the viewport, labels
// never overlap each other or cover a true city dot, and a callout joins each
// label to its pin. Candidates ring the projected anchor first, so labels stay
// beside their pins while the globe turns, and only crowded views fall back to
// a viewport grid; `previous` (id → key) adds hysteresis so a label only
// switches side when it has to.
const LABEL_DIRECTIONS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2 - Math.PI / 2;
  return { index, x: Math.cos(angle), y: Math.sin(angle) };
});
const LABEL_RINGS = [1, 1.7, 2.5, 3.4, 4.4];

function segmentsCross(a, b, c, d) {
  const orient = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

// Liang–Barsky clip: does segment a→b pass through the box centred on c?
function segmentHitsBox(a, b, c, halfWidth, halfHeight) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - (c.x - halfWidth)], [dx, c.x + halfWidth - a.x], [-dy, a.y - (c.y - halfHeight)], [dy, c.y + halfHeight - a.y]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

export function labelSize(width) {
  return { width: width < 600 ? 76 : 88, height: 44 };
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

// Anchors are { id, x, y, visible, z?, priority? }. A pin is drawn on screen
// whenever it faces the camera (z > 0), even when it sits too close to the limb
// to carry a label, so labels and callouts keep clear of every drawn pin.
// `obstacles` are soft keep-out boxes { x, y, halfWidth, halfHeight } such as
// the parked airliner.
export function layoutGlobeLabels(anchors, size, {
  previous = new Map(), center = { x: size.width / 2, y: size.height / 2 }, radius = Math.min(size.width, size.height) / 2, obstacles = [],
} = {}) {
  const { width, height } = labelSize(size.width);
  const gap = 8;
  const pinClearance = 7;
  const calloutClearance = 6;
  // The visible pill inside each 44px touch target, plus a small margin.
  const pillHalfWidth = width / 2 + 2;
  const pillHalfHeight = height / 2 - 5;
  const inViewport = anchor => anchor.x >= 0 && anchor.x <= size.width && anchor.y >= 0 && anchor.y <= size.height;
  const visible = anchors.filter(anchor => anchor.visible && inViewport(anchor));
  const pins = anchors.filter(anchor => (anchor.visible || anchor.z > 0) && inViewport(anchor));
  const contained = (x, y) => x >= width / 2 + 6 && x <= size.width - width / 2 - 6 && y >= height / 2 + 6 && y <= size.height - height / 2 - 6;
  const coversPin = (x, y) => pins.some(pin => Math.abs(pin.x - x) < width / 2 + pinClearance && Math.abs(pin.y - y) < height / 2 + pinClearance);
  const hitsObstacle = (x, y) => obstacles.some(box => Math.abs(box.x - x) < width / 2 - 2 + box.halfWidth && Math.abs(box.y - y) < height / 2 - 8 + box.halfHeight);
  // Hard constraints dominate the soft cost (distance, preferred side, hysteresis, tangles).
  const HARD = 1e5;
  // Callouts that graze another pin or run under another label read as the wrong connection.
  const CROSSED = 2000;

  // Preferred direction for a label: above its pin, leaning away from nearby
  // pins (so a cluster fans out) and outward toward the limb.
  const preference = anchor => {
    const outX = anchor.x - center.x;
    const outY = anchor.y - center.y;
    const outLength = Math.hypot(outX, outY);
    const lean = Math.min(1, outLength / (radius * 0.6 || 1));
    const neighbours = pins.filter(pin => pin.id !== anchor.id && Math.hypot(pin.x - anchor.x, pin.y - anchor.y) < width * 2);
    let clusterX = 0;
    let clusterY = 0;
    if (neighbours.length) {
      clusterX = anchor.x - neighbours.reduce((sum, pin) => sum + pin.x, 0) / neighbours.length;
      clusterY = anchor.y - neighbours.reduce((sum, pin) => sum + pin.y, 0) / neighbours.length;
      const clusterLength = Math.hypot(clusterX, clusterY) || 1;
      clusterX /= clusterLength; clusterY /= clusterLength;
    }
    const outWeight = neighbours.length ? 0.4 : 1;
    const x = (outLength ? outX / outLength : 0) * lean * outWeight + clusterX * 0.8;
    const y = (outLength ? outY / outLength : 0) * lean * outWeight + clusterY * 0.8 - 0.9;
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  };
  const preferences = new Map(visible.map(anchor => [anchor.id, preference(anchor)]));

  // Cost of putting `anchor`'s label at (x, y) given the labels in `others`.
  // Candidates whose cost before tangles already reaches `bound` are cut short.
  function evaluate(anchor, x, y, key, others, bound = Infinity) {
    const label = { x, y };
    const inside = contained(x, y);
    const overlaps = others.some(other => Math.abs(x - other.x) < width + 6 && Math.abs(y - other.y) < height + 4);
    const covers = coversPin(x, y);
    const prefer = preferences.get(anchor.id);
    const dx = x - anchor.x;
    const dy = y - anchor.y;
    const distance = Math.hypot(dx, dy) || 1;
    let cost = distance + 26 * (1 - (dx * prefer.x + dy * prefer.y) / distance)
      - (previous.get(anchor.id) === key ? 22 : 0)
      + (inside ? 0 : 10 * HARD) + (overlaps ? HARD : 0) + (covers ? HARD : 0)
      + (hitsObstacle(x, y) ? 1500 : 0);
    const hard = !inside || overlaps || covers;
    if (cost >= bound) return { x, y, key, cost, hard };
    // Callouts should neither cross each other, pass through another pin, nor run underneath another label.
    // The callout is judged from a few pixels out, so a pin right beside this
    // one only counts when the callout heads toward it.
    const length = Math.hypot(label.x - anchor.x, label.y - anchor.y) || 1;
    const lead = Math.min(8, length) / length;
    const start = { x: anchor.x + (label.x - anchor.x) * lead, y: anchor.y + (label.y - anchor.y) * lead };
    for (const pin of pins) if (pin.id !== anchor.id && distanceToSegment(pin, start, label) < calloutClearance) cost += CROSSED;
    for (const other of others) {
      const otherAnchor = { x: other.anchorX, y: other.anchorY };
      if (segmentsCross(anchor, label, otherAnchor, other)) cost += CROSSED;
      if (segmentHitsBox(anchor, label, other, pillHalfWidth, pillHalfHeight)) cost += CROSSED;
      if (segmentHitsBox(otherAnchor, other, label, pillHalfWidth, pillHalfHeight)) cost += CROSSED;
    }
    return { x, y, key, cost, hard };
  }

  function choose(anchor, others) {
    let best = null;
    const consider = (x, y, key) => {
      const option = evaluate(anchor, x, y, key, others, best ? best.cost : Infinity);
      if (!best || option.cost < best.cost) best = option;
    };
    for (const [ringIndex, ring] of LABEL_RINGS.entries()) {
      for (const direction of LABEL_DIRECTIONS) {
        // Shortest step along this direction that clears the label box off its own pin.
        const step = Math.min(
          Math.abs(direction.x) > 1e-6 ? (width / 2 + gap) / Math.abs(direction.x) : Infinity,
          Math.abs(direction.y) > 1e-6 ? (height / 2 + gap) / Math.abs(direction.y) : Infinity,
        ) * ring;
        consider(anchor.x + direction.x * step, anchor.y + direction.y * step, `${ringIndex}:${direction.index}`);
      }
    }
    // Crowded views: fall back to any free slot in the viewport, as the flat map's grid did.
    if (best.hard) {
      for (let y = height / 2 + 6; y <= size.height - height / 2 - 6; y += 8) {
        for (let x = width / 2 + 6; x <= size.width - width / 2 - 6; x += 8) consider(x, y, `grid:${Math.round(x)}:${Math.round(y)}`);
      }
    }
    return {
      id: anchor.id, anchorX: anchor.x, anchorY: anchor.y, key: best.key, width, height, cost: best.cost,
      x: clamp(best.x, width / 2 + 6, Math.max(width / 2 + 6, size.width - width / 2 - 6)),
      y: clamp(best.y, height / 2 + 6, Math.max(height / 2 + 6, size.height - height / 2 - 6)),
      failed: best.hard,
    };
  }

  function place(order) {
    // Greedy pass in order, then two refinement passes that re-place each
    // label against all the others, so early labels can make room.
    const placed = [];
    for (const anchor of order) placed.push(choose(anchor, placed));
    for (let pass = 0; pass < 2; pass += 1) {
      let improved = false;
      order.forEach((anchor, index) => {
        // Only labels that are tangled or stretched are worth moving.
        if (placed[index].cost < 90) return;
        const others = placed.filter((_, other) => other !== index);
        const current = evaluate(anchor, placed[index].x, placed[index].y, placed[index].key, others);
        const next = choose(anchor, others);
        if (next.cost < current.cost - 1) { placed[index] = next; improved = true; }
      });
      if (!improved) break;
    }
    return { placed, violations: placed.filter(label => label.failed).length };
  }

  // Total cost of a finished layout, each label judged against all the others.
  const byAnchor = new Map(visible.map(anchor => [anchor.id, anchor]));
  const totalCost = placed => placed.reduce((sum, label, index) => sum
    + evaluate(byAnchor.get(label.id), label.x, label.y, label.key, placed.filter((_, other) => other !== index)).cost, 0);
  const better = (a, b) => a.violations < b.violations || (a.violations === b.violations && a.total < b.total);
  const attempt = order => {
    const result = place(order);
    return { ...result, total: totalCost(result.placed) };
  };

  // Greedy placement in priority order; labels that found no valid spot get
  // placed first on a retry, keeping the attempt with the fewest violations.
  let order = [...visible].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  let result = attempt(order);
  for (let retry = 0; retry < 4 && result.violations; retry += 1) {
    const failed = new Set(result.placed.filter(label => label.failed).map(label => label.id));
    order = [...order.filter(anchor => failed.has(anchor.id)), ...order.filter(anchor => !failed.has(anchor.id))];
    const next = attempt(order);
    if (better(next, result)) result = next;
  }
  // A tangled or stretched layout (a crowded cluster near the limb) tries a
  // few other placement orders, the selected race always first.
  const stretched = result.placed.some(label => Math.hypot(label.x - label.anchorX, label.y - label.anchorY) > 100);
  if (result.violations || stretched || result.placed.some(label => label.cost >= CROSSED)) {
    const [first, ...rest] = [...visible].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const compare of [(a, b) => a.y - b.y, (a, b) => b.y - a.y, (a, b) => a.x - b.x, (a, b) => b.x - a.x]) {
      const next = attempt([first, ...[...rest].sort(compare)]);
      if (better(next, result)) result = next;
    }
  }
  const placed = result.placed.map(({ failed: _failed, cost: _cost, ...label }) => label);
  const byId = new Map(placed.map(label => [label.id, label]));
  return anchors.map(anchor => byId.get(anchor.id)
    ?? { id: anchor.id, anchorX: anchor.x, anchorY: anchor.y, x: anchor.x, y: anchor.y, key: null, width, height, hidden: true });
}
