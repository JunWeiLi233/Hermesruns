#!/usr/bin/env node
// Generates frontend/src/data/landingGlobeLand.js: the dotted land mask drawn
// by the landing page's race globe (frontend/src/pages/landing/LandingRaceMap.jsx).
//
// Provenance: Natural Earth 1:110m land (public domain, naturalearthdata.com),
// as packaged in the world-atlas@2 npm package's land-110m.json TopoJSON
// (ISC licence, Copyright Mike Bostock). The input is not committed; fetch it with
//   npm pack world-atlas@2 && tar xzf world-atlas-2.*.tgz
// and run from the repository root:
//   node tools/generate-landing-globe-land.mjs path/to/package/land-110m.json [--points 60000]
//
// Dependency-free: TopoJSON arcs are decoded and point-in-polygon is tested
// here. The output stores the land/water flag of every Fibonacci-sphere point
// in band order (latitude bands about one lattice spacing tall, each sorted
// west to east) as alternating water/land run lengths, LEB128 varints, base64
// encoded; the runs make a dense lattice fit in a few kilobytes.
// fibonacciPoint and landBandOrder below must stay identical to the ones in
// frontend/src/utils/landingGlobe.js, which decodes the runs at runtime.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_POINT_COUNT = 60000;
export const DEFAULT_OUTPUT = path.join(repositoryRoot, 'frontend/src/data/landingGlobeLand.js');
const GOLDEN_ANGLE_DEG = 180 * (3 - Math.sqrt(5));

// Known coordinates used to validate the generated mask: [label, lat, lng, isLand].
export const VALIDATION_POINTS = [
  ['Berlin', 52.52, 13.405, true],
  ['Sahara', 23, 12, true],
  ['Amazon', -5, -62, true],
  ['Australia interior', -25, 134, true],
  ['Antarctica', -82, 40, true],
  ['Siberia', 62, 100, true],
  ['North America interior', 45, -100, true],
  ['Mid-Atlantic', 20, -40, false],
  ['Central Pacific', 0, -150, false],
  ['Indian Ocean', -20, 80, false],
  ['South Atlantic', -35, -15, false],
  ['North Pacific', 35, -160, false],
];

export function fibonacciPoint(index, count) {
  const lat = Math.asin(1 - (2 * index + 1) / count) * 180 / Math.PI;
  const lng = ((index * GOLDEN_ANGLE_DEG) % 360 + 360) % 360 - 180;
  return { lat, lng };
}

// Encoding order: bands of consecutive indices (the lattice runs pole to pole),
// each sorted by longitude quantized to 1/4096° (ties by index), so
// neighbouring points follow each other.
export const landBandSize = (count) => Math.max(1, Math.round(Math.sqrt(count * Math.PI)));
export function landBandOrder(count) {
  const band = landBandSize(count);
  const keys = new Float64Array(band);
  const order = new Int32Array(count);
  // Longitude + 180° of each index, stepped by the golden angle; the frontend
  // decoder steps identically, so both sort on exactly the same keys.
  let turn = 0;
  for (let start = 0; start < count; start += band) {
    const size = Math.min(count, start + band) - start;
    const slice = keys.subarray(0, size);
    for (let offset = 0; offset < size; offset += 1) {
      slice[offset] = Math.floor(turn * 4096) * 65536 + offset;
      turn += GOLDEN_ANGLE_DEG;
      if (turn >= 360) turn -= 360;
    }
    slice.sort();
    for (let offset = 0; offset < size; offset += 1) order[start + offset] = start + (slice[offset] % 65536);
  }
  return order;
}

// Decode every land ring as [[lng, lat], ...] from a quantized or plain TopoJSON topology.
export function decodeTopologyRings(topology, objectName = 'land') {
  const { scale = [1, 1], translate = [0, 0] } = topology.transform ?? {};
  const quantized = Boolean(topology.transform);
  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      if (quantized) { x += dx; y += dy; } else { x = dx; y = dy; }
      return quantized ? [x * scale[0] + translate[0], y * scale[1] + translate[1]] : [x, y];
    });
  });
  const ring = (indices) => indices.flatMap((index, position) => {
    const points = index >= 0 ? arcs[index] : [...arcs[~index]].reverse();
    return position === 0 ? points : points.slice(1);
  });
  const object = topology.objects?.[objectName];
  if (!object) throw new Error(`TopoJSON object "${objectName}" not found.`);
  const geometries = object.type === 'GeometryCollection' ? object.geometries : [object];
  return geometries.flatMap((geometry) => {
    if (geometry.type === 'Polygon') return geometry.arcs.map(ring);
    if (geometry.type === 'MultiPolygon') return geometry.arcs.flatMap((polygon) => polygon.map(ring));
    return [];
  });
}

// Unwrap a ring's longitudes so no edge jumps across the antimeridian. A ring
// that winds once around the globe (Antarctica) is closed through its pole.
export function unwrapRing(points) {
  const unwrapped = [];
  let winding = 0;
  for (const [lng, lat] of points) {
    if (!unwrapped.length) { unwrapped.push([lng, lat]); continue; }
    const previous = unwrapped[unwrapped.length - 1][0];
    const delta = ((lng - previous) % 360 + 540) % 360 - 180;
    winding += delta;
    unwrapped.push([previous + delta, lat]);
  }
  if (Math.abs(winding) > 180) {
    const pole = unwrapped.reduce((sum, [, lat]) => sum + lat, 0) < 0 ? -90 : 90;
    unwrapped.push([unwrapped[unwrapped.length - 1][0], pole], [unwrapped[0][0], pole]);
  }
  return unwrapped;
}

function insideRing({ points, minLng, maxLng, minLat, maxLat }, lat, lng) {
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Even-odd point-in-polygon over every ring on the equirectangular plane,
// after unwrapping, testing the longitude and its ±360° copies.
export function createLandTest(rings) {
  const indexed = rings.filter((points) => points.length > 2).map((ring) => {
    const points = unwrapRing(ring);
    const lngs = points.map(([lng]) => lng);
    const lats = points.map(([, lat]) => lat);
    return { points, minLng: Math.min(...lngs), maxLng: Math.max(...lngs), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
  });
  return (lat, lng) => indexed.reduce((inside, ring) => (
    insideRing(ring, lat, lng) || insideRing(ring, lat, lng - 360) || insideRing(ring, lat, lng + 360) ? !inside : inside
  ), false);
}

export function buildLandMask(isLand, count) {
  const bytes = new Uint8Array(Math.ceil(count / 8));
  let land = 0;
  for (let index = 0; index < count; index += 1) {
    const { lat, lng } = fibonacciPoint(index, count);
    if (isLand(lat, lng)) {
      bytes[index >> 3] |= 1 << (index & 7);
      land += 1;
    }
  }
  return { bytes, land };
}

export function maskHasPoint(bytes, index) {
  return (bytes[index >> 3] & (1 << (index & 7))) !== 0;
}

export function nearestFibonacciIndex(lat, lng, count) {
  const toVector = (latDeg, lngDeg) => {
    const phi = latDeg * Math.PI / 180;
    const lambda = lngDeg * Math.PI / 180;
    return [Math.cos(phi) * Math.sin(lambda), Math.sin(phi), Math.cos(phi) * Math.cos(lambda)];
  };
  const target = toVector(lat, lng);
  let best = 0;
  let bestDot = -Infinity;
  for (let index = 0; index < count; index += 1) {
    const point = fibonacciPoint(index, count);
    const vector = toVector(point.lat, point.lng);
    const dot = vector[0] * target[0] + vector[1] * target[1] + vector[2] * target[2];
    if (dot > bestDot) { bestDot = dot; best = index; }
  }
  return best;
}

export function validateLandMask(bytes, count, points = VALIDATION_POINTS) {
  return points
    .map(([label, lat, lng, expected]) => ({ label, expected, actual: maskHasPoint(bytes, nearestFibonacciIndex(lat, lng, count)) }))
    .filter(({ expected, actual }) => expected !== actual);
}

// Alternating water/land run lengths (water first) in band order, as LEB128 varints.
export function encodeLandRuns(bytes, count) {
  const out = [];
  const push = (value) => {
    let rest = value;
    while (rest >= 0x80) { out.push((rest & 0x7f) | 0x80); rest >>>= 7; }
    out.push(rest);
  };
  let land = false;
  let run = 0;
  for (const index of landBandOrder(count)) {
    if (maskHasPoint(bytes, index) === land) { run += 1; continue; }
    push(run);
    land = !land;
    run = 1;
  }
  push(run);
  return Buffer.from(out).toString('base64');
}

export function decodeLandRuns(encoded, count) {
  const data = Buffer.from(encoded, 'base64');
  const order = landBandOrder(count);
  const bytes = new Uint8Array(Math.ceil(count / 8));
  let position = 0;
  let cursor = 0;
  let land = false;
  while (cursor < data.length && position < count) {
    let run = 0;
    let shift = 0;
    let byte;
    do { byte = data[cursor]; cursor += 1; run |= (byte & 0x7f) << shift; shift += 7; } while (byte & 0x80);
    for (let end = Math.min(count, position + run); position < end; position += 1) {
      if (land) bytes[order[position] >> 3] |= 1 << (order[position] & 7);
    }
    land = !land;
  }
  return bytes;
}

export function renderLandModule(bytes, count) {
  const encoded = encodeLandRuns(bytes, count);
  const lines = (encoded.match(/.{1,96}/g) ?? ['']).map((line) => `'${line}'`);
  return [
    '// GENERATED by tools/generate-landing-globe-land.mjs — do not edit.',
    '// Natural Earth 1:110m land (public domain) via world-atlas@2 land-110m.json (ISC).',
    '// Fibonacci-sphere land flags in band order as alternating water/land run',
    '// lengths (LEB128 varints), base64 encoded. Decode with decodeLandRuns in src/utils/landingGlobe.js.',
    `export const LANDING_GLOBE_POINT_COUNT = ${count};`,
    `export const LANDING_GLOBE_LAND_RUNS = ${lines.join('\n  + ')};`,
    '',
  ].join('\n');
}

function parseArguments(argv) {
  const options = { input: null, points: DEFAULT_POINT_COUNT, out: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--points') options.points = Number(argv[++index]);
    else if (value === '--out') options.out = path.resolve(argv[++index]);
    else if (!options.input) options.input = path.resolve(value);
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!options.input) throw new Error('Usage: node tools/generate-landing-globe-land.mjs <land-110m.json> [--points N] [--out file]');
  if (!Number.isInteger(options.points) || options.points < 1000 || options.points > 200000) throw new Error('--points must be an integer between 1000 and 200000.');
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const topology = JSON.parse(readFileSync(options.input, 'utf8'));
  const isLand = createLandTest(decodeTopologyRings(topology));
  const { bytes, land } = buildLandMask(isLand, options.points);
  const failures = validateLandMask(bytes, options.points);
  if (failures.length) {
    throw new Error(`Land mask validation failed: ${failures.map(({ label, expected }) => `${label} should be ${expected ? 'land' : 'water'}`).join('; ')}`);
  }
  const source = renderLandModule(bytes, options.points);
  writeFileSync(options.out, source);
  console.log(`[globe-land] ${land}/${options.points} land points (${(100 * land / options.points).toFixed(1)}%), ${Buffer.byteLength(source)} bytes -> ${path.relative(repositoryRoot, options.out)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`[globe-land] ${error.message}`);
    process.exitCode = 1;
  }
}
