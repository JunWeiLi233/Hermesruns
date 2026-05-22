import { apiFetch } from '../api.js';

/**
 * Background removal algorithm using flood-fill from corners.
 * Works well for product images with white/neutral backgrounds and simple logo-card backgrounds.
 * Algorithm: sample edge colors -> flood fill from edges -> chamfer distance-transform feather.
 *
 * Improvements over the original:
 *  1. Chamfer 2-pass distance transform replaces O(W*H*feather^2) neighborhood scan.
 *  2. Chroma-aware discrimination (YCbCr Cb/Cr) keeps brightly coloured shoes intact on near-white bg.
 *  3. Color decontamination removes bg-colour halo from semi-transparent edge pixels.
 *  4. Wider perimeter sampling (8 pts per side, 32 total) with outlier rejection.
 *  5. Working-resolution cap: images larger than 1024px on the longest side are downscaled before
 *     processing (output stays at working resolution — no upscale).
 */

// Cache for processed images (URL -> bg-removed data URL)
const bgRemovedCache = {};
const fetchedImageCache = {};

export { bgRemovedCache };

function isDataUrl(src) {
  return typeof src === 'string' && src.startsWith('data:image/');
}

function isBlobUrl(src) {
  return typeof src === 'string' && src.startsWith('blob:');
}

function isRemoteHttpUrl(src) {
  return typeof src === 'string' && /^https?:\/\//i.test(src);
}

function isSameOriginUrl(src) {
  if (!isRemoteHttpUrl(src)) return true;
  try {
    return new URL(src).origin === window.location.origin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chroma helpers (BT.601)
// ---------------------------------------------------------------------------

function chromaCbCr(r, g, b) {
  const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
  const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
  return { cb, cr };
}

function chromaDistance(r1, g1, b1, r2, g2, b2) {
  const c1 = chromaCbCr(r1, g1, b1);
  const c2 = chromaCbCr(r2, g2, b2);
  const dCb = c1.cb - c2.cb;
  const dCr = c1.cr - c2.cr;
  return Math.sqrt(dCb * dCb + dCr * dCr);
}

// ---------------------------------------------------------------------------
// Neutral / background detection
// ---------------------------------------------------------------------------

function isLikelyNeutralBackgroundPixel(r, g, b, a) {
  if (a < 8) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  return spread <= 28 && brightness >= 176;
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Returns true when the pixel colour matches any bg sample in RGB space AND
 * has a similar chroma to that sample (Cb/Cr distance <= chromaTolerance).
 * The chroma gate prevents bright coloured shoes (orange/red/blue) near value=245
 * from being classified as background even when their RGB distance is small.
 */
function matchesAnyBackgroundSample(r, g, b, samples, tolerance, chromaTolerance = 18) {
  for (const sample of samples) {
    const dr = r - sample.r;
    const dg = g - sample.g;
    const db = b - sample.b;
    const rgbDist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (rgbDist > tolerance) continue;
    // Chroma gate: sample must also be chromatically similar
    const cd = chromaDistance(r, g, b, sample.r, sample.g, sample.b);
    if (cd <= chromaTolerance) return true;
  }
  return false;
}

function buildNeutralCandidateMask(data, width, height, edgeSamples, tolerance, options = {}) {
  const candidateMask = new Uint8Array(width * height);
  const allowSolidColorBackground = Boolean(options.allowSolidColorBackground);
  // For solid-color backgrounds use a looser chroma gate (the bg itself may be chromatic)
  const chromaTolerance = allowSolidColorBackground ? 40 : 18;

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    const matchesEdge = matchesAnyBackgroundSample(r, g, b, edgeSamples, tolerance, chromaTolerance);
    if (!matchesEdge) continue;

    if (allowSolidColorBackground || isLikelyNeutralBackgroundPixel(r, g, b, a)) {
      candidateMask[index] = 1;
    }
  }
  return candidateMask;
}

// ---------------------------------------------------------------------------
// Edge sampling — 8 evenly-spaced points per side (32 total) + outlier rejection
// ---------------------------------------------------------------------------

function buildPerimeterSamplePositions(w, h, pointsPerSide = 8) {
  const positions = [];
  for (let i = 0; i < pointsPerSide; i += 1) {
    const t = i / (pointsPerSide - 1);
    // Top edge
    positions.push([Math.round(t * (w - 1)), 0]);
    // Bottom edge
    positions.push([Math.round(t * (w - 1)), h - 1]);
    // Left edge
    positions.push([0, Math.round(t * (h - 1))]);
    // Right edge
    positions.push([w - 1, Math.round(t * (h - 1))]);
  }
  return positions;
}

/**
 * Reject samples whose RGB distance from the per-side median is large (> 60).
 * "Per-side" grouping is approximated by grouping into the 4 sides based on
 * whether x or y coordinate is at the border.
 */
function rejectOutlierSamples(samples, distanceThreshold = 60) {
  if (samples.length <= 3) return samples;

  // Compute median colour of all samples (independent channels)
  const rs = samples.map((s) => s.r).sort((a, b) => a - b);
  const gs = samples.map((s) => s.g).sort((a, b) => a - b);
  const bs = samples.map((s) => s.b).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const median = { r: rs[mid], g: gs[mid], b: bs[mid] };

  return samples.filter((s) => colorDistance(s, median) <= distanceThreshold);
}

function dominantEdgeColorSamples(samples, options = {}) {
  const clusterTolerance = options.clusterTolerance || 30;
  const minCoverage = options.minCoverage || 0.58;
  const minSamples = options.minSamples || 6;
  const opaqueSamples = samples.filter((sample) => sample.a >= 8);
  if (opaqueSamples.length < minSamples) return [];

  const clusters = [];
  for (const sample of opaqueSamples) {
    let matchedCluster = null;
    for (const cluster of clusters) {
      if (colorDistance(sample, cluster.average) <= clusterTolerance) {
        matchedCluster = cluster;
        break;
      }
    }

    if (!matchedCluster) {
      clusters.push({
        count: 1,
        sumR: sample.r,
        sumG: sample.g,
        sumB: sample.b,
        average: { r: sample.r, g: sample.g, b: sample.b },
      });
      continue;
    }

    matchedCluster.count += 1;
    matchedCluster.sumR += sample.r;
    matchedCluster.sumG += sample.g;
    matchedCluster.sumB += sample.b;
    matchedCluster.average = {
      r: Math.round(matchedCluster.sumR / matchedCluster.count),
      g: Math.round(matchedCluster.sumG / matchedCluster.count),
      b: Math.round(matchedCluster.sumB / matchedCluster.count),
    };
  }

  clusters.sort((a, b) => b.count - a.count);
  const dominant = clusters[0];
  if (!dominant || dominant.count < minSamples) return [];
  if (dominant.count / opaqueSamples.length < minCoverage) return [];
  return [dominant.average];
}

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

function floodFillEdgeBackground(candidateMask, width, height) {
  const visited = new Uint8Array(width * height);
  const bgMask = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x += 1) {
    queue.push(x, 0);
    queue.push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    queue.push(0, y);
    queue.push(width - 1, y);
  }

  while (queue.length > 0) {
    const py = queue.pop();
    const px = queue.pop();
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    const idx = py * width + px;
    if (visited[idx]) continue;
    visited[idx] = 1;
    if (!candidateMask[idx]) continue;

    bgMask[idx] = 1;
    queue.push(px - 1, py);
    queue.push(px + 1, py);
    queue.push(px, py - 1);
    queue.push(px, py + 1);
  }

  return bgMask;
}

function fillEnclosedNeutralHoles(candidateMask, bgMask, width, height, options = {}) {
  const visited = new Uint8Array(width * height);
  const maxHolePixels = options.maxHolePixels || Math.max(48, Math.round(width * height * 0.035));
  const maxHoleSpan = options.maxHoleSpan || Math.max(16, Math.round(Math.min(width, height) * 0.35));

  for (let index = 0; index < width * height; index += 1) {
    if (!candidateMask[index] || bgMask[index] || visited[index]) continue;

    const queue = [index];
    const component = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let touchesEdge = false;

    while (queue.length > 0) {
      const current = queue.pop();
      if (visited[current]) continue;
      visited[current] = 1;
      if (!candidateMask[current] || bgMask[current]) continue;

      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        touchesEdge = true;
      }
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;

      if (x > 0) queue.push(current - 1);
      if (x < width - 1) queue.push(current + 1);
      if (y > 0) queue.push(current - width);
      if (y < height - 1) queue.push(current + width);
    }

    if (component.length === 0 || touchesEdge) continue;

    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    if (component.length <= maxHolePixels && spanX <= maxHoleSpan && spanY <= maxHoleSpan) {
      for (const pixel of component) {
        bgMask[pixel] = 1;
      }
    }
  }

  return bgMask;
}

// ---------------------------------------------------------------------------
// Chamfer distance-transform feather (replaces O(W*H*feather^2) neighborhood scan)
//
// Two-pass chamfer distance transform using 3-4 weights (axis=3, diagonal=4).
// Distance values are in "chamfer units" (multiply by 1/3 to get approximate pixels).
// The soft-alpha gradient is driven by the distance, giving a smooth band wider than
// the old 3-px hard ramp.
// ---------------------------------------------------------------------------

/**
 * Compute chamfer distance from the nearest bg pixel for every foreground pixel.
 * bg pixels get distance 0.  fg pixels get distance proportional to their
 * chamfer distance from the nearest bg pixel.
 *
 * We store distances * 3 (integer chamfer units) and divide at the end.
 */
function computeChamferDistance(bgMask, width, height) {
  const INF = 0x7fffffff;
  // dist[i] in chamfer units (* 3 for axis, * 4 for diagonal)
  const dist = new Int32Array(width * height).fill(INF);

  // Seed: bg pixels have distance 0
  for (let i = 0; i < width * height; i += 1) {
    if (bgMask[i]) dist[i] = 0;
  }

  // Forward pass: top-left neighborhood
  // Neighbors checked: (-1,-1)=4, (0,-1)=3, (+1,-1)=4, (-1,0)=3
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
  // Neighbors checked: (+1,+1)=4, (0,+1)=3, (-1,+1)=4, (+1,0)=3
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

/**
 * Apply soft alpha based on chamfer distance from background.
 *
 * bg pixels (bgMask[i]=1) → alpha = 0
 * fg pixels far from bg   → alpha = 255 (unchanged)
 * border band              → smooth gradient, monotonically non-decreasing with distance
 *
 * feather is in approximate pixels (converted to chamfer units: feather * 3).
 */
function featherBackgroundMask(data, bgMask, width, height, feather = 4) {
  const chamferDist = computeChamferDistance(bgMask, width, height);
  // feather pixels -> chamfer units (axis weight=3, so 1 px ≈ 3 units)
  const featherUnits = feather * 3;

  for (let i = 0; i < width * height; i += 1) {
    if (bgMask[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }

    const d = chamferDist[i]; // chamfer units; INF if far from bg
    if (d < featherUnits) {
      // Smooth gradient: 0 at d=0 (bg), 255 at d=featherUnits
      const alpha = Math.round(255 * (d / featherUnits));
      data[i * 4 + 3] = alpha;
    }
    // else: fg pixel far from bg — leave alpha as-is (255 for opaque input)
  }
}

// ---------------------------------------------------------------------------
// Color decontamination — remove bg colour halo from partial-alpha edge pixels
// ---------------------------------------------------------------------------

/**
 * For partial-alpha pixels (0 < alpha < 255) un-mix the dominant background color.
 * Given observed pixel C_obs, alpha a, and background sample C_bg:
 *   C_fg = (C_obs - (1 - a) * C_bg) / a
 * Clamped to [0, 255].  Skipped when a < 12 (too transparent to recover reliably).
 */
function decontaminateEdgePixels(data, bgMask, width, height, bgColor) {
  if (!bgColor) return;
  const bgR = bgColor.r;
  const bgG = bgColor.g;
  const bgB = bgColor.b;

  for (let i = 0; i < width * height; i += 1) {
    if (bgMask[i]) continue; // fully classified as bg — alpha already 0
    const offset = i * 4;
    const alpha = data[offset + 3];
    if (alpha <= 12 || alpha >= 255) continue; // skip fully opaque or nearly-transparent

    const a = alpha / 255;
    const oneMinusA = 1 - a;

    const obsR = data[offset];
    const obsG = data[offset + 1];
    const obsB = data[offset + 2];

    const fgR = Math.round(Math.max(0, Math.min(255, (obsR - oneMinusA * bgR) / a)));
    const fgG = Math.round(Math.max(0, Math.min(255, (obsG - oneMinusA * bgG) / a)));
    const fgB = Math.round(Math.max(0, Math.min(255, (obsB - oneMinusA * bgB) / a)));

    data[offset] = fgR;
    data[offset + 1] = fgG;
    data[offset + 2] = fgB;
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function computeContentBoundsFromAlpha(data, width, height, options = {}) {
  if (!data || width <= 0 || height <= 0) return null;

  const minAlpha = options.minAlpha ?? 8;
  const padding = Math.max(0, Math.round(options.padding ?? 0));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= minAlpha) continue;

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);

  return {
    x,
    y,
    width: right - x + 1,
    height: bottom - y + 1,
  };
}

function canvasFromImageDataBounds(imageData, bounds) {
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = bounds.width;
  outputCanvas.height = bounds.height;
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) return null;
  outputContext.putImageData(imageData, -bounds.x, -bounds.y);
  return outputCanvas;
}

export function buildBackgroundMaskFromImageData(data, width, height, options = {}) {
  const edgeSamples = options.edgeSamples || [];
  if (!edgeSamples.length) {
    return new Uint8Array(width * height);
  }

  const tolerance = options.tolerance || 34;
  const candidateMask = buildNeutralCandidateMask(data, width, height, edgeSamples, tolerance, {
    allowSolidColorBackground: options.allowSolidColorBackground,
  });
  const bgMask = floodFillEdgeBackground(candidateMask, width, height);
  fillEnclosedNeutralHoles(candidateMask, bgMask, width, height, options);
  return bgMask;
}

// ---------------------------------------------------------------------------
// Cross-origin image resolver
// ---------------------------------------------------------------------------

async function resolveProcessableImageSource(imgSrc) {
  if (!imgSrc || isDataUrl(imgSrc) || isBlobUrl(imgSrc) || isSameOriginUrl(imgSrc)) {
    return imgSrc;
  }

  if (fetchedImageCache[imgSrc]) {
    return fetchedImageCache[imgSrc];
  }

  try {
    const response = await apiFetch('/api/shoes/render-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imgSrc }),
    });
    if (!response.ok) return imgSrc;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return imgSrc;
    const objectUrl = URL.createObjectURL(blob);
    fetchedImageCache[imgSrc] = objectUrl;
    return objectUrl;
  } catch {
    return imgSrc;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Maximum longest-side resolution for the working canvas (improvement 5). */
const WORKING_RES_CAP = 1024;

export default function removeBackground(imgSrc) {
  return resolveProcessableImageSource(imgSrc).then((resolvedSrc) => new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const safeResolve = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Avoid hanging forever on slow/blocked hosts.
    const timeoutId = window.setTimeout(() => safeResolve(resolvedSrc || imgSrc), 6000);
    img.onload = () => {
      try {
        const srcW = img.width;
        const srcH = img.height;

        // Improvement 5: downscale to working resolution if image is too large
        const longestSide = Math.max(srcW, srcH);
        const scale = longestSide > WORKING_RES_CAP ? WORKING_RES_CAP / longestSide : 1;
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timeoutId);
          safeResolve(resolvedSrc || imgSrc);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Improvement 4: wider perimeter sampling (8 per side, 32 total) + outlier rejection
        const neutralEdgeSamples = [];
        const sampledEdgePixels = [];
        const samplePositions = buildPerimeterSamplePositions(w, h, 8);

        for (const [cx, cy] of samplePositions) {
          const i = (cy * w + cx) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          sampledEdgePixels.push({ r, g, b, a });
          if (isLikelyNeutralBackgroundPixel(r, g, b, a)) {
            neutralEdgeSamples.push({ r, g, b });
          }
        }

        // Reject outlier samples before solid-bg clustering
        const filteredSampledEdgePixels = rejectOutlierSamples(
          sampledEdgePixels.filter((s) => s.a >= 8),
          60,
        ).map((s) => ({ ...s, a: s.a ?? 255 }));

        const solidEdgeSamples = neutralEdgeSamples.length
          ? []
          : dominantEdgeColorSamples(filteredSampledEdgePixels);
        const edgeSamples = neutralEdgeSamples.length ? neutralEdgeSamples : solidEdgeSamples;
        const allowSolidColorBackground = solidEdgeSamples.length > 0;

        if (edgeSamples.length === 0) {
          window.clearTimeout(timeoutId);
          safeResolve(resolvedSrc || imgSrc);
          return;
        }

        const bgMask = buildBackgroundMaskFromImageData(data, w, h, {
          edgeSamples,
          tolerance: allowSolidColorBackground ? 42 : 34,
          allowSolidColorBackground,
        });

        // Improvement 1: chamfer distance-transform feather (smooth soft-alpha gradient)
        featherBackgroundMask(data, bgMask, w, h, 4);

        // Improvement 3: color decontamination — un-mix bg halo from partial-alpha edge pixels
        decontaminateEdgePixels(data, bgMask, w, h, edgeSamples[0]);

        const trimPadding = Math.max(2, Math.round(Math.min(w, h) * 0.04));
        const contentBounds = computeContentBoundsFromAlpha(data, w, h, {
          minAlpha: 8,
          padding: trimPadding,
        });
        const hasTrimmedBounds = contentBounds
          && (contentBounds.x > 0 || contentBounds.y > 0 || contentBounds.width < w || contentBounds.height < h);
        const outputCanvas = hasTrimmedBounds
          ? canvasFromImageDataBounds(imageData, contentBounds)
          : null;

        ctx.putImageData(imageData, 0, 0);
        window.clearTimeout(timeoutId);
        safeResolve((outputCanvas || canvas).toDataURL('image/png'));
      } catch {
        // Cross-origin images without CORS headers taint canvas; just use original URL.
        window.clearTimeout(timeoutId);
        safeResolve(resolvedSrc || imgSrc);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timeoutId);
      safeResolve(resolvedSrc || imgSrc);
    }; // fallback to original
    img.src = resolvedSrc || imgSrc;
  }));
}
