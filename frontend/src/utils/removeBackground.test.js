import assert from 'node:assert/strict';

import { buildBackgroundMaskFromImageData } from './removeBackground.js';

function setPixel(data, width, x, y, r, g, b, a = 255) {
  const offset = (y * width + x) * 4;
  data[offset] = r;
  data[offset + 1] = g;
  data[offset + 2] = b;
  data[offset + 3] = a;
}

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

console.log('[PASS] removeBackground enclosed-hole guardrail passed.');
