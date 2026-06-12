#!/usr/bin/env node
// .tools/extract-muscle-masks.mjs
//
// Drives the running browser to pixel-trace muscle regions from the
// photographic anatomy PNGs rendered in MuscleTraining.jsx.
//
// Processes one anchor at a time to stay under the browser-harness socket
// timeout (5 seconds per recv call).
//
// Usage:
//   node .tools/extract-muscle-masks.mjs
//   node .tools/extract-muscle-masks.mjs --dry-run   # print anchors only, no browser
//   node .tools/extract-muscle-masks.mjs --key neck   # run single anchor
//
// Output: frontend/src/utils/muscleMasks.data.json

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'frontend/src/utils/muscleMasks.data.json');
const BROWSER_TOOL = path.join(REPO_ROOT, '.tools/auto-hermes-browser.mjs');
const NODE = process.execPath;

const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_KEY = (() => {
  const idx = process.argv.indexOf('--key');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ──────────────────────────────────────────────────────────────────────────────
// Muscle anchor table
// Each anchor: { key, view, svgX, svgY, radius, lumThreshold }
// svgX/svgY are in the top-level SVG viewBox coordinate space (0,0)-(790,580).
//
// Anterior image bbox in viewBox coords: x=58, y=42, w=264, h=508
// Posterior image bbox in viewBox coords: x=411.12, y=59.4, w=370.2, h=491.2
//
// Posterior region anchor coords from REFERENCE_BODY_MEASURE_REGIONS are
// in their own transformed space. We compute display coords by applying
// the region transforms:
//   POSTERIOR_REGION_ALIGNMENT_TRANSFORM = matrix(0.9665,0,0,0.9665, 83.7, 9.0)
//   POSTERIOR_GLUTE_REGION_ALIGNMENT_TRANSFORM = matrix(0.9665,0,0,0.9665, 89.0, 12.0)
//   POSTERIOR_LEG_REGION_ALIGNMENT_TRANSFORM = matrix(0.9665,0,0,0.9665, 70.5, 7.0)
// displayX = 0.9665354331 * cx + tx
// displayY = 0.9665354331 * cy + ty
// ──────────────────────────────────────────────────────────────────────────────
const ANCHORS = [
  // ── ANTERIOR ──────────────────────────────────────────────────────────────
  { key: 'neck',                view: 'anterior',  svgX: 190,  svgY: 110, radius: 16, lumThreshold: 32 },

  { key: 'traps-front-left',    view: 'anterior',  svgX: 172,  svgY: 137, radius: 18, lumThreshold: 30 },
  { key: 'traps-front-right',   view: 'anterior',  svgX: 208,  svgY: 137, radius: 18, lumThreshold: 30 },

  { key: 'deltoids-left',       view: 'anterior',  svgX: 130,  svgY: 157, radius: 22, lumThreshold: 28 },
  { key: 'deltoids-right',      view: 'anterior',  svgX: 250,  svgY: 157, radius: 22, lumThreshold: 28 },

  { key: 'pectorals-left',      view: 'anterior',  svgX: 168,  svgY: 170, radius: 28, lumThreshold: 30 },
  { key: 'pectorals-right',     view: 'anterior',  svgX: 212,  svgY: 170, radius: 28, lumThreshold: 30 },

  { key: 'biceps-left',         view: 'anterior',  svgX: 97,   svgY: 200, radius: 20, lumThreshold: 30 },
  { key: 'biceps-right',        view: 'anterior',  svgX: 283,  svgY: 200, radius: 20, lumThreshold: 30 },

  { key: 'forearms-front-left', view: 'anterior',  svgX: 87,   svgY: 268, radius: 22, lumThreshold: 30 },
  { key: 'forearms-front-right',view: 'anterior',  svgX: 293,  svgY: 268, radius: 22, lumThreshold: 30 },

  { key: 'abdominals',          view: 'anterior',  svgX: 190,  svgY: 218, radius: 40, lumThreshold: 26 },

  { key: 'quadriceps-left',     view: 'anterior',  svgX: 167,  svgY: 365, radius: 44, lumThreshold: 28 },
  { key: 'quadriceps-right',    view: 'anterior',  svgX: 213,  svgY: 365, radius: 44, lumThreshold: 28 },

  { key: 'calves-front-left',   view: 'anterior',  svgX: 168,  svgY: 482, radius: 26, lumThreshold: 30 },
  { key: 'calves-front-right',  view: 'anterior',  svgX: 212,  svgY: 482, radius: 26, lumThreshold: 30 },

  // ── POSTERIOR ──────────────────────────────────────────────────────────────
  // Display coords computed from REFERENCE_BODY_MEASURE_REGIONS cx/cy + transforms
  { key: 'trapezius-left',      view: 'posterior', svgX: 554,  svgY: 133, radius: 30, lumThreshold: 26 },
  { key: 'trapezius-right',     view: 'posterior', svgX: 604,  svgY: 133, radius: 30, lumThreshold: 26 },

  { key: 'shoulders-back-left', view: 'posterior', svgX: 517,  svgY: 164, radius: 26, lumThreshold: 28 },
  { key: 'shoulders-back-right',view: 'posterior', svgX: 641,  svgY: 164, radius: 26, lumThreshold: 28 },

  { key: 'lats-left',           view: 'posterior', svgX: 538,  svgY: 217, radius: 38, lumThreshold: 28 },
  { key: 'lats-right',          view: 'posterior', svgX: 619,  svgY: 217, radius: 38, lumThreshold: 28 },

  { key: 'triceps-left',        view: 'posterior', svgX: 490,  svgY: 202, radius: 24, lumThreshold: 30 },
  { key: 'triceps-right',       view: 'posterior', svgX: 668,  svgY: 202, radius: 24, lumThreshold: 30 },

  { key: 'forearms-back-left',  view: 'posterior', svgX: 480,  svgY: 270, radius: 24, lumThreshold: 30 },
  { key: 'forearms-back-right', view: 'posterior', svgX: 677,  svgY: 270, radius: 24, lumThreshold: 30 },

  { key: 'lower-back-left',     view: 'posterior', svgX: 569,  svgY: 270, radius: 22, lumThreshold: 26 },
  { key: 'lower-back-right',    view: 'posterior', svgX: 588,  svgY: 270, radius: 22, lumThreshold: 26 },

  { key: 'glutes-left',         view: 'posterior', svgX: 574,  svgY: 331, radius: 32, lumThreshold: 28 },
  { key: 'glutes-right',        view: 'posterior', svgX: 611,  svgY: 331, radius: 32, lumThreshold: 28 },

  { key: 'hamstrings-left',     view: 'posterior', svgX: 564,  svgY: 389, radius: 46, lumThreshold: 28 },
  { key: 'hamstrings-right',    view: 'posterior', svgX: 604,  svgY: 389, radius: 46, lumThreshold: 28 },

  { key: 'gastrocnemius-left',  view: 'posterior', svgX: 568,  svgY: 481, radius: 26, lumThreshold: 30 },
  { key: 'gastrocnemius-right', view: 'posterior', svgX: 599,  svgY: 481, radius: 26, lumThreshold: 30 },
];

if (DRY_RUN) {
  console.log('Anchors:');
  ANCHORS.forEach(a => console.log(JSON.stringify(a)));
  process.exit(0);
}

// ──────────────────────────────────────────────────────────────────────────────
// Single-anchor in-browser JS
// This is designed to run fast enough to complete within the 5-second harness
// socket timeout. Uses SCALE=2 for speed.
// ──────────────────────────────────────────────────────────────────────────────
function buildSingleAnchorJS(anchor) {
  return `
(function() {
  var anchor = ${JSON.stringify(anchor)};
  var SCALE = 2;
  var RDP_EPSILON = 0.8;

  function floodFill(data, width, height, seedPx, seedPy, lumT, radiusPx) {
    var mask = new Uint8Array(width * height);
    var seedI = (seedPy * width + seedPx) * 4;
    var sR = data[seedI], sG = data[seedI+1], sB = data[seedI+2];
    var seedLum = 0.299*sR + 0.587*sG + 0.114*sB;
    var stack = [seedPx + seedPy * width];
    while (stack.length) {
      var idx = stack.pop();
      if (mask[idx]) continue;
      var x = idx % width;
      var y = (idx / width) | 0;
      var i = idx * 4;
      if (data[i+3] < 20) continue;
      var lum = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
      if (Math.abs(lum - seedLum) > lumT) continue;
      var dx = x - seedPx, dy = y - seedPy;
      if (dx*dx + dy*dy > radiusPx*radiusPx) continue;
      mask[idx] = 1;
      if (x+1 < width)  stack.push(idx+1);
      if (x-1 >= 0)     stack.push(idx-1);
      if (y+1 < height) stack.push(idx+width);
      if (y-1 >= 0)     stack.push(idx-width);
    }
    return { mask: mask, seedLum: seedLum };
  }

  function traceBoundary(mask, width, height) {
    var startX = -1, startY = -1;
    outer: for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        if (mask[y*width+x]) { startX = x; startY = y; break outer; }
      }
    }
    if (startX < 0) return [];
    var dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
    var contour = [];
    var cx = startX, cy = startY;
    var enterDir = 6;
    var maxIter = width * height + 10;
    var iter = 0;
    do {
      contour.push([cx, cy]);
      var searchStart = (enterDir + 5) % 8;
      var found = false;
      for (var d = 0; d < 8; d++) {
        var dir = (searchStart + d) % 8;
        var nx = cx + dirs[dir][0];
        var ny = cy + dirs[dir][1];
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny*width+nx]) {
          enterDir = (dir + 4) % 8;
          cx = nx; cy = ny;
          found = true;
          break;
        }
      }
      if (!found) break;
      iter++;
    } while ((cx !== startX || cy !== startY) && iter < maxIter);
    return contour;
  }

  function rdp(points, epsilon) {
    if (points.length < 3) return points;
    var maxDist = 0, maxIdx = 0;
    var start = points[0], end = points[points.length-1];
    var dx = end[0]-start[0], dy = end[1]-start[1];
    var len = Math.sqrt(dx*dx+dy*dy);
    for (var i = 1; i < points.length-1; i++) {
      var dist;
      if (len === 0) {
        var ddx = points[i][0]-start[0], ddy = points[i][1]-start[1];
        dist = Math.sqrt(ddx*ddx+ddy*ddy);
      } else {
        dist = Math.abs(dy*points[i][0] - dx*points[i][1] + end[0]*start[1] - end[1]*start[0]) / len;
      }
      if (dist > maxDist) { maxDist = dist; maxIdx = i; }
    }
    if (maxDist > epsilon) {
      var r1 = rdp(points.slice(0, maxIdx+1), epsilon);
      var r2 = rdp(points.slice(maxIdx), epsilon);
      return r1.slice(0,-1).concat(r2);
    }
    return [start, end];
  }

  // Find the image element
  var selector = anchor.view === 'anterior'
    ? 'image.mt-body-reference-image[href*="anterior"]'
    : 'image.mt-body-reference-image[href*="posterior"]';
  var imgEl = document.querySelector(selector);
  if (!imgEl) return JSON.stringify({ error: 'image element not found', key: anchor.key });

  var bbox = imgEl.getBBox();
  var href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href');

  // Canvas is already loaded as a global between calls — we cache it
  var cacheKey = '__hermesCanvasCache__';
  if (!window[cacheKey]) window[cacheKey] = {};

  if (!window[cacheKey][href]) {
    // Need to load — but this is sync context, can't await
    // Return a special "needs-load" signal
    return JSON.stringify({ needsLoad: true, href: href, key: anchor.key });
  }

  var info = window[cacheKey][href];
  var data = info.data, width = info.width, height = info.height;

  // Convert SVG viewBox coords to canvas pixel coords
  var px = Math.round((anchor.svgX - bbox.x) * SCALE);
  var py = Math.round((anchor.svgY - bbox.y) * SCALE);

  if (px < 0 || py < 0 || px >= width || py >= height) {
    return JSON.stringify({ error: 'anchor outside image', px: px, py: py, bboxX: bbox.x, bboxY: bbox.y, bboxW: bbox.width, bboxH: bbox.height, imgW: width, imgH: height, key: anchor.key });
  }

  var seedI = (py * width + px) * 4;
  if (data[seedI+3] < 20) {
    return JSON.stringify({ error: 'anchor pixel transparent', px: px, py: py, alpha: data[seedI+3], key: anchor.key });
  }

  var radiusPx = anchor.radius * SCALE;
  var fillResult = floodFill(data, width, height, px, py, anchor.lumThreshold, radiusPx);
  var mask = fillResult.mask;
  var seedLum = fillResult.seedLum;

  var filledCount = 0;
  for (var fi = 0; fi < mask.length; fi++) filledCount += mask[fi];

  if (filledCount < 10) {
    return JSON.stringify({ error: 'fill too small', filledCount: filledCount, seedLum: seedLum, key: anchor.key });
  }

  var contour = traceBoundary(mask, width, height);
  if (contour.length < 4) {
    return JSON.stringify({ error: 'contour too short', contourLength: contour.length, key: anchor.key });
  }

  var simplified = rdp(contour, RDP_EPSILON * SCALE);

  var pathPoints = simplified.map(function(p) {
    return [bbox.x + p[0] / SCALE, bbox.y + p[1] / SCALE];
  });

  var d = pathPoints.map(function(p, i) {
    return (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1);
  }).join(' ') + ' Z';

  return JSON.stringify({
    key: anchor.key,
    view: anchor.view,
    d: d,
    pointCount: simplified.length,
    filledCount: filledCount,
    seedLum: Math.round(seedLum * 10) / 10,
    anchorSvg: [anchor.svgX, anchor.svgY]
  });
})()
`.trim();
}

// JS to load a PNG into the canvas cache
function buildLoadImageJS(anchor) {
  return `
(async function() {
  var selector = '${anchor.view}' === 'anterior'
    ? 'image.mt-body-reference-image[href*="anterior"]'
    : 'image.mt-body-reference-image[href*="posterior"]';
  var imgEl = document.querySelector(selector);
  if (!imgEl) return JSON.stringify({ error: 'image element not found' });

  var href = imgEl.getAttribute('href') || imgEl.getAttribute('xlink:href');
  var cacheKey = '__hermesCanvasCache__';
  if (!window[cacheKey]) window[cacheKey] = {};
  if (window[cacheKey][href]) return JSON.stringify({ ok: true, cached: true, href: href });

  var bbox = imgEl.getBBox();
  var SCALE = 2;
  var c = document.createElement('canvas');
  c.width = Math.round(bbox.width * SCALE);
  c.height = Math.round(bbox.height * SCALE);
  var ctx = c.getContext('2d');

  await new Promise(function(resolve, reject) {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() { ctx.drawImage(img, 0, 0, c.width, c.height); resolve(); };
    img.onerror = function() { reject(new Error('load failed')); };
    img.src = href;
  });

  var imgData = ctx.getImageData(0, 0, c.width, c.height);
  window[cacheKey][href] = {
    data: imgData.data,
    width: c.width,
    height: c.height,
    bboxX: bbox.x,
    bboxY: bbox.y,
  };
  return JSON.stringify({ ok: true, cached: false, href: href, w: c.width, h: c.height });
})()
`.trim();
}

// ──────────────────────────────────────────────────────────────────────────────
// Execute a single eval via auto-hermes-browser.mjs
// auto-hermes-browser.mjs outputs raw JSON (not HERMES_RESULT prefix)
// ──────────────────────────────────────────────────────────────────────────────
function runBrowserEval(js, awaitPromise) {
  const result = spawnSync(NODE, [BROWSER_TOOL, 'eval', '--js', js, ...(awaitPromise ? ['--await'] : [])], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    env: process.env,
  });

  if (result.error) {
    throw new Error(`spawn failed: ${result.error.message}`);
  }
  const stdout = (result.stdout || '').toString().trim();
  const stderr = (result.stderr || '').toString();

  if (!stdout) {
    throw new Error(`Empty output from browser tool.\nstderr: ${stderr.slice(-400)}`);
  }

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`Could not parse browser tool output: ${stdout.slice(-400)}`);
  }

  if (!payload.ok) {
    throw new Error(`Browser eval error: ${payload.exception || payload.error || JSON.stringify(payload)}`);
  }
  // value may be string (when returnByValue) or a primitive
  return payload.value;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

let anchorsToProcess = ANCHORS;
if (SINGLE_KEY) {
  anchorsToProcess = ANCHORS.filter(a => a.key === SINGLE_KEY);
  if (anchorsToProcess.length === 0) {
    console.error(`No anchor with key="${SINGLE_KEY}". Available: ${ANCHORS.map(a=>a.key).join(', ')}`);
    process.exit(1);
  }
}

console.log(`extract-muscle-masks: processing ${anchorsToProcess.length} anchor(s)...`);

// Load existing output if it exists (for incremental updates)
let existingOutput = null;
if (fs.existsSync(OUT_PATH)) {
  try { existingOutput = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')); } catch { /* ignore */ }
}
const existingMasks = (existingOutput && existingOutput.masks) ? existingOutput.masks : {};

// Pre-load images into browser canvas cache
const viewsNeeded = [...new Set(anchorsToProcess.map(a => a.view))];
for (const view of viewsNeeded) {
  process.stdout.write(`  Loading ${view} image into canvas cache... `);
  const loadJs = buildLoadImageJS({ view });
  let loadResult;
  try {
    loadResult = runBrowserEval(loadJs, true);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  }
  const parsed = JSON.parse(loadResult);
  if (parsed.error) {
    console.error(`FAILED: ${parsed.error}`);
    process.exit(1);
  }
  console.log(parsed.cached ? 'already cached' : `loaded (${parsed.w}x${parsed.h})`);
}

// Process each anchor
const masks = { ...existingMasks };
const ok = [], failed = [];

for (const anchor of anchorsToProcess) {
  process.stdout.write(`  ${anchor.key} (${anchor.view})... `);

  const js = buildSingleAnchorJS(anchor);
  let rawValue;
  try {
    rawValue = runBrowserEval(js, false); // sync, no await needed
  } catch (err) {
    console.log(`ERROR: ${err.message.slice(0, 120)}`);
    masks[anchor.key] = { error: err.message.slice(0, 200), view: anchor.view };
    failed.push({ key: anchor.key, error: err.message.slice(0, 200) });
    continue;
  }

  let result;
  try {
    result = JSON.parse(rawValue);
  } catch (err) {
    console.log(`PARSE ERROR: ${String(rawValue).slice(0, 120)}`);
    masks[anchor.key] = { error: 'parse error', view: anchor.view };
    failed.push({ key: anchor.key, error: 'parse error' });
    continue;
  }

  if (result.needsLoad) {
    // This shouldn't happen since we pre-loaded, but handle gracefully
    console.log(`NEEDS_LOAD (unexpected)`);
    failed.push({ key: anchor.key, error: 'needsLoad after pre-load' });
    continue;
  }

  if (result.error) {
    console.log(`FAIL: ${result.error}`);
    masks[anchor.key] = { error: result.error, view: anchor.view, debug: result };
    failed.push({ key: anchor.key, error: result.error });
    continue;
  }

  console.log(`OK: ${result.pointCount} pts, ${result.filledCount} px, seedLum=${result.seedLum}`);
  masks[anchor.key] = {
    view: result.view,
    d: result.d,
    pointCount: result.pointCount,
    filledCount: result.filledCount,
    seedLum: result.seedLum,
    anchorSvg: result.anchorSvg,
  };
  ok.push(anchor.key);
}

// Write output
const anteriorBBox = { x: 58, y: 42, w: 264, h: 508 };
const posteriorBBox = { x: 411.12, y: 59.4, w: 370.2, h: 491.2 };

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  anteriorImageBBox: anteriorBBox,
  posteriorImageBBox: posteriorBBox,
  anchors: ANCHORS.map(a => ({ key: a.key, view: a.view, svgX: a.svgX, svgY: a.svgY, radius: a.radius, lumThreshold: a.lumThreshold })),
  masks,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');

console.log(`\nDone: ${ok.length} OK, ${failed.length} failed`);
if (failed.length > 0) {
  console.log('Failed:');
  failed.forEach(f => console.log(`  ${f.key}: ${f.error}`));
}
console.log(`Wrote: ${OUT_PATH}`);
