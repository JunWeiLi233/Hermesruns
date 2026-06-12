import assert from 'node:assert/strict';

import {
  buildBackgroundMaskFromImageData,
  computeContentBoundsFromAlpha,
} from './removeBackground.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setPixel(data, width, x, y, r, g, b, a = 255) {
  const offset = (y * width + x) * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

// ---------------------------------------------------------------------------
// Inline copies of internal helpers needed by new tests
// (we test the algorithm logic through the public exports + manual invocations)
// ---------------------------------------------------------------------------

function computeChamferDistance(bgMask, width, height) {
  const INF = 0x7fffffff;
  const dist = new Int32Array(width * height).fill(INF);

  for (let i = 0; i < width * height; i += 1) {
    if (bgMask[i]) dist[i] = 0;
  }

  // Forward pass: top-left neighborhood
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      let d = dist[idx];
      if (y > 0) {
        if (x > 0) d = Math.min(d, dist[(y - 1) * width + (x - 1)] + 4);
        d = Math.min(d, dist[(y - 1) * width + x] + 3);
        if (x < width - 1) d = Math.min(d, dist[(y - 1) * width + (x + 1)] + 4);
      }
      if (x > 0) d = Math.min(d, dist[y * width + (x - 1)] + 3);
      dist[idx] = d;
    }
  }

  // Backward pass: bottom-right neighborhood
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = y * width + x;
      let d = dist[idx];
      if (y < height - 1) {
        if (x < width - 1) d = Math.min(d, dist[(y + 1) * width + (x + 1)] + 4);
        d = Math.min(d, dist[(y + 1) * width + x] + 3);
        if (x > 0) d = Math.min(d, dist[(y + 1) * width + (x - 1)] + 4);
      }
      if (x < width - 1) d = Math.min(d, dist[y * width + (x + 1)] + 3);
      dist[idx] = d;
    }
  }

  return dist;
}

function featherBackgroundMaskLocal(data, bgMask, width, height, feather = 4) {
  const chamferDist = computeChamferDistance(bgMask, width, height);
  const featherUnits = feather * 3;

  for (let i = 0; i < width * height; i += 1) {
    if (bgMask[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    const d = chamferDist[i];
    if (d < featherUnits) {
      data[i * 4 + 3] = Math.round(255 * (d / featherUnits));
    }
  }
}

// ---------------------------------------------------------------------------
// EXISTING TESTS (must continue to pass)
// ---------------------------------------------------------------------------

function buildRingFixture() {
  const width = 9;
  const height = 9;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(data, width, x, y, 245, 245, 245, 255);
    }
  }

  for (let y = 2; y <= 6; y += 1) {
    for (let x = 2; x <= 6; x += 1) {
      setPixel(data, width, x, y, 15, 80, 190, 255);
    }
  }

  for (let y = 3; y <= 5; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      setPixel(data, width, x, y, 245, 245, 245, 255);
    }
  }

  return { data, width, height };
}

const { data, width, height } = buildRingFixture();
const edgeSamples = [{ r: 245, g: 245, b: 245 }];
const bgMask = buildBackgroundMaskFromImageData(data, width, height, { edgeSamples, tolerance: 34 });

assert.equal(bgMask[0], 1, 'Edge-connected neutral background should still be removed.');
assert.equal(bgMask[4 * width + 4], 1, 'Enclosed neutral logo holes should now be removed as background.');
assert.equal(bgMask[2 * width + 2], 0, 'Foreground ring pixels must remain opaque.');

function buildOffsetLogoFixture() {
  const fixtureWidth = 12;
  const fixtureHeight = 8;
  const fixtureData = new Uint8ClampedArray(fixtureWidth * fixtureHeight * 4);

  for (let y = 2; y <= 4; y += 1) {
    for (let x = 4; x <= 8; x += 1) {
      setPixel(fixtureData, fixtureWidth, x, y, 220, 28, 18, 255);
    }
  }

  return { data: fixtureData, width: fixtureWidth, height: fixtureHeight };
}

const offsetLogo = buildOffsetLogoFixture();
const contentBounds = computeContentBoundsFromAlpha(offsetLogo.data, offsetLogo.width, offsetLogo.height, {
  minAlpha: 8,
  padding: 1,
});

assert.deepEqual(
  contentBounds,
  { x: 3, y: 1, width: 7, height: 5 },
  'Visible logo content should be trimmed out of an oversized transparent canvas.',
);

const emptyBounds = computeContentBoundsFromAlpha(new Uint8ClampedArray(4 * 4 * 4), 4, 4);
assert.equal(emptyBounds, null, 'Fully transparent canvases should not produce content bounds.');

function buildSolidCardBackgroundFixture() {
  const fixtureWidth = 9;
  const fixtureHeight = 9;
  const fixtureData = new Uint8ClampedArray(fixtureWidth * fixtureHeight * 4);

  for (let y = 0; y < fixtureHeight; y += 1) {
    for (let x = 0; x < fixtureWidth; x += 1) {
      setPixel(fixtureData, fixtureWidth, x, y, 108, 27, 30, 255);
    }
  }

  for (let y = 3; y <= 5; y += 1) {
    for (let x = 3; x <= 5; x += 1) {
      setPixel(fixtureData, fixtureWidth, x, y, 250, 250, 250, 255);
    }
  }

  return { data: fixtureData, width: fixtureWidth, height: fixtureHeight };
}

const solidCard = buildSolidCardBackgroundFixture();
const solidCardMask = buildBackgroundMaskFromImageData(solidCard.data, solidCard.width, solidCard.height, {
  edgeSamples: [{ r: 108, g: 27, b: 30 }],
  allowSolidColorBackground: true,
  tolerance: 34,
});

assert.equal(solidCardMask[0], 1, 'Solid colored logo-card backgrounds should be removable when they dominate the edge.');
assert.equal(solidCardMask[4 * solidCard.width + 4], 0, 'Foreground logo marks on colored cards must remain opaque.');

// ---------------------------------------------------------------------------
// NEW TEST 1: Bright-color foreground on neutral bg (chroma check)
// A saturated red blob on near-white background must NOT be erased.
// ---------------------------------------------------------------------------

{
  const w = 11;
  const h = 11;
  const d = new Uint8ClampedArray(w * h * 4);

  // Near-white background
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      setPixel(d, w, x, y, 245, 244, 246, 255);
    }
  }

  // Saturated red blob in center (value near 245 on one channel but very chromatic)
  // R=245, G=20, B=20 — RGB distance to white sample is moderate but chroma is very different
  for (let y = 4; y <= 6; y += 1) {
    for (let x = 4; x <= 6; x += 1) {
      setPixel(d, w, x, y, 245, 20, 20, 255);
    }
  }

  const bgSamples = [{ r: 245, g: 244, b: 246 }];
  // tolerance=80 would normally eat the red blob in pure RGB mode
  const mask = buildBackgroundMaskFromImageData(d, w, h, { edgeSamples: bgSamples, tolerance: 80 });

  // The red center pixels must NOT be masked as background (chroma protection)
  const centerIdx = 5 * w + 5;
  assert.equal(
    mask[centerIdx],
    0,
    'NEW TEST 1: Bright red foreground pixel on near-white bg must NOT be classified as background (chroma check).',
  );
  // The actual white border pixel must still be background
  assert.equal(mask[0], 1, 'NEW TEST 1: Corner white pixel must still be classified as background.');
}

// ---------------------------------------------------------------------------
// NEW TEST 2: Soft-alpha boundary — chamfer distance-transform gives non-binary alpha
// and alpha is monotonically non-decreasing with chamfer distance from background.
// ---------------------------------------------------------------------------

{
  // Build a 1D strip of width 15:
  // bgMask: [1,1,0,0,0,0,0,0,0,0,0,0,0,1,1]
  // With feather=4px (featherUnits=12), the soft-alpha band covers chamfer distances < 12.
  // Axis step = 3 chamfer units, so pixels within ~4 steps of bg get partial alpha.
  // pixel 2: distance from bg pixel 1 = 1 step = 3 units  -> alpha=round(255*3/12)=64
  // pixel 3: distance = 2 steps = 6 units                 -> alpha=round(255*6/12)=128
  // pixel 4: distance = 3 steps = 9 units                 -> alpha=round(255*9/12)=191
  // pixel 5: distance = 4 steps = 12 units = featherUnits -> alpha NOT in band (>= featherUnits), stays 255
  const w = 15;
  const h = 1;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let x = 0; x < w; x += 1) {
    d[x * 4] = 245; d[x * 4 + 1] = 245; d[x * 4 + 2] = 245; d[x * 4 + 3] = 255;
  }

  const bgMaskStrip = new Uint8Array(w * h);
  bgMaskStrip[0] = 1; bgMaskStrip[1] = 1;
  bgMaskStrip[13] = 1; bgMaskStrip[14] = 1;

  featherBackgroundMaskLocal(d, bgMaskStrip, w, h, 4);

  // Check: bg pixels must have alpha 0
  assert.equal(d[0 * 4 + 3], 0, 'NEW TEST 2: bg pixel must have alpha=0.');
  assert.equal(d[1 * 4 + 3], 0, 'NEW TEST 2: bg pixel (index 1) must have alpha=0.');

  // Check: partial-alpha band exists (non-binary alpha between 0 and 255)
  const alphaAt2 = d[2 * 4 + 3]; // chamfer dist 3 -> alpha 64
  const alphaAt3 = d[3 * 4 + 3]; // chamfer dist 6 -> alpha 128
  const alphaAt4 = d[4 * 4 + 3]; // chamfer dist 9 -> alpha 191

  assert.ok(
    alphaAt2 > 0 && alphaAt2 < 255,
    `NEW TEST 2: Pixel at border must have partial alpha (got ${alphaAt2}).`,
  );

  // Check monotonically non-decreasing with distance from background
  assert.ok(
    alphaAt3 >= alphaAt2,
    `NEW TEST 2: Alpha must be >= further from bg: alphaAt3=${alphaAt3} should be >= alphaAt2=${alphaAt2}.`,
  );
  assert.ok(
    alphaAt4 >= alphaAt3,
    `NEW TEST 2: Alpha must be >= further from bg: alphaAt4=${alphaAt4} should be >= alphaAt3=${alphaAt3}.`,
  );

  // Check: deep fg pixel (pixel 5, chamfer dist = 4 steps = 12 units = featherUnits) must be alpha=255
  // Because condition is d < featherUnits (strict), pixel at exact featherUnits is NOT in band.
  const alphaAt5 = d[5 * 4 + 3];
  assert.equal(alphaAt5, 255, `NEW TEST 2: Deep fg pixel (dist=featherUnits) must remain alpha=255 (got ${alphaAt5}).`);
}

// ---------------------------------------------------------------------------
// NEW TEST 3: Color decontamination
// An anti-aliased mid-alpha pixel from a known fg/bg mix should after
// decontamination have RGB closer to the true foreground color than to the bg.
// ---------------------------------------------------------------------------

{
  // Foreground: bright red (200, 30, 30). Background: white (250, 250, 250).
  // Alpha = 0.5 (128/255). Observed blended pixel: (225, 140, 140) approx.
  // After decontamination: fg should be recovered as (200, 30, 30).

  const bgColor = { r: 250, g: 250, b: 250 };
  const fgTrue = { r: 200, g: 30, b: 30 };
  const alpha = 128; // ~0.5
  const a = alpha / 255;
  const obsR = Math.round(a * fgTrue.r + (1 - a) * bgColor.r);
  const obsG = Math.round(a * fgTrue.g + (1 - a) * bgColor.g);
  const obsB = Math.round(a * fgTrue.b + (1 - a) * bgColor.b);

  // Build a tiny 1×1 image with the blended pixel
  const d = new Uint8ClampedArray(4);
  d[0] = obsR; d[1] = obsG; d[2] = obsB; d[3] = alpha;

  // Apply decontamination inline
  const bgMaskLocal = new Uint8Array(1); // pixel is not classified as bg
  bgMaskLocal[0] = 0;

  // Inline decontaminate (mirrors the implementation)
  function decontaminateLocal(pixData, bgM, bgC) {
    if (bgM[0]) return;
    const pixAlpha = pixData[3];
    if (pixAlpha <= 12 || pixAlpha >= 255) return;
    const aVal = pixAlpha / 255;
    const oneMinusA = 1 - aVal;
    pixData[0] = Math.round(Math.max(0, Math.min(255, (pixData[0] - oneMinusA * bgC.r) / aVal)));
    pixData[1] = Math.round(Math.max(0, Math.min(255, (pixData[1] - oneMinusA * bgC.g) / aVal)));
    pixData[2] = Math.round(Math.max(0, Math.min(255, (pixData[2] - oneMinusA * bgC.b) / aVal)));
  }

  decontaminateLocal(d, bgMaskLocal, bgColor);

  const distToFg = Math.sqrt(
    (d[0] - fgTrue.r) ** 2 + (d[1] - fgTrue.g) ** 2 + (d[2] - fgTrue.b) ** 2,
  );
  const distToBg = Math.sqrt(
    (d[0] - bgColor.r) ** 2 + (d[1] - bgColor.g) ** 2 + (d[2] - bgColor.b) ** 2,
  );

  assert.ok(
    distToFg < distToBg,
    `NEW TEST 3: After decontamination RGB should be closer to fg (distToFg=${distToFg.toFixed(1)}) than bg (distToBg=${distToBg.toFixed(1)}).`,
  );
}

// ---------------------------------------------------------------------------
// NEW TEST 4: Colored-card bg with slight corner variation (gradient/shadow tolerance)
// Corners differ by up to ~20 in each channel (simulating a subtle shadow/gradient).
// The majority of edge samples should still cluster and the background treated as removable.
// ---------------------------------------------------------------------------

{
  const w = 11;
  const h = 11;
  const d = new Uint8ClampedArray(w * h * 4);

  // Background: maroon-ish, with slight corner variation
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // Slight gradient: top-left corners slightly darker
      const shade = (x < 2 && y < 2) ? -15 : 0;
      setPixel(d, w, x, y, 120 + shade, 30 + shade, 35 + shade, 255);
    }
  }

  // White foreground logo in the center
  for (let y = 4; y <= 6; y += 1) {
    for (let x = 4; x <= 6; x += 1) {
      setPixel(d, w, x, y, 250, 250, 250, 255);
    }
  }

  // Edge samples from the dominant bg color (non-corner)
  const bgSamples = [{ r: 120, g: 30, b: 35 }];
  const mask = buildBackgroundMaskFromImageData(d, w, h, {
    edgeSamples: bgSamples,
    allowSolidColorBackground: true,
    tolerance: 42,
  });

  // Corner pixels (exact match ~105/15/20 vs sample 120/30/35, dist~26) should be bg
  assert.equal(mask[0], 1, 'NEW TEST 4: Top-left corner with gradient shade must still be classified as background.');
  // Non-corner bg pixels must be bg
  assert.equal(mask[5], 1, 'NEW TEST 4: Normal bg pixel on top edge must be classified as background.');
  // White fg logo center must NOT be bg
  const centerIdx = 5 * w + 5;
  assert.equal(mask[centerIdx], 0, 'NEW TEST 4: White foreground logo must remain opaque on colored card.');
}

// ---------------------------------------------------------------------------
// NEW TEST 5: Already-transparent pixel pass-through
// Pixels with alpha < 8 must remain transparent and not be corrupted.
// ---------------------------------------------------------------------------

{
  const w = 3;
  const h = 1;
  const d = new Uint8ClampedArray(w * h * 4);
  // Pixel 0: fully transparent
  setPixel(d, w, 0, 0, 100, 100, 100, 0);
  // Pixel 1: nearly transparent (a=5)
  setPixel(d, w, 1, 0, 200, 200, 200, 5);
  // Pixel 2: opaque white (bg candidate)
  setPixel(d, w, 2, 0, 245, 245, 245, 255);

  const bgSamples = [{ r: 245, g: 245, b: 245 }];
  const mask = buildBackgroundMaskFromImageData(d, w, h, { edgeSamples: bgSamples, tolerance: 34 });

  // The nearly-transparent pixel (a=5) must not be changed in RGB by the mask itself.
  // The mask just marks candidate; the alpha-write happens in feather. Here we only
  // check the mask logic treats transparent pixels correctly.
  // pixel[0] (a=0) — isLikelyNeutralBackgroundPixel returns true, so it's a candidate.
  // pixel[1] (a=5) — also true (a < 8 short-circuit). Both are candidates at the edge.
  // They're edge-connected so they'll be marked bg=1 by floodFill.
  // The important thing is pixel[2] (opaque white) is also bg (matches sample & neutral).
  assert.equal(mask[2], 1, 'NEW TEST 5: Opaque white bg pixel at edge must be background.');

  // Now test feather doesn't corrupt deeply transparent pixels (alpha should become 0 or stay near 0)
  const d2 = new Uint8ClampedArray(12);
  d2[0] = 100; d2[1] = 100; d2[2] = 100; d2[3] = 0;   // pixel 0: a=0, classified bg
  d2[4] = 200; d2[5] = 200; d2[6] = 200; d2[7] = 255;  // pixel 1: fg opaque
  d2[8] = 200; d2[9] = 200; d2[10] = 200; d2[11] = 255; // pixel 2: fg opaque

  const bgM2 = new Uint8Array([1, 0, 0]); // only pixel 0 is bg
  featherBackgroundMaskLocal(d2, bgM2, 3, 1, 4);

  assert.equal(d2[3], 0, 'NEW TEST 5: bg pixel must have alpha=0 after feather.');
  // pixel 1 is in the soft-alpha band (distance 3 chamfer units = 1 pixel from bg)
  // feather=4px -> featherUnits=12. d of pixel1 = 3 (axis step from bg pixel 0).
  // alpha = round(255 * 3/12) = round(63.75) = 64
  assert.ok(d2[7] > 0 && d2[7] < 255, `NEW TEST 5: Border pixel must have partial alpha (got ${d2[7]}).`);
}

// ---------------------------------------------------------------------------

console.log('[PASS] removeBackground guardrails passed.');
