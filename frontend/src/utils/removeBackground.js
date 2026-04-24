import { apiFetch } from '../api.js';

/**
 * Background removal algorithm using flood-fill from corners.
 * Works well for product images with white/solid or checkerboard-like backgrounds.
 * Algorithm: sample edge colors -> flood fill from edges -> feather alpha.
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

function isLikelyNeutralBackgroundPixel(r, g, b, a) {
  if (a < 8) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const brightness = (r + g + b) / 3;
  return spread <= 28 && brightness >= 176;
}

function matchesAnyBackgroundSample(r, g, b, samples, tolerance) {
  for (const sample of samples) {
    const dr = r - sample.r;
    const dg = g - sample.g;
    const db = b - sample.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance <= tolerance) return true;
  }
  return false;
}

function buildNeutralCandidateMask(data, width, height, edgeSamples, tolerance) {
  const candidateMask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    if (
      isLikelyNeutralBackgroundPixel(r, g, b, a)
      && matchesAnyBackgroundSample(r, g, b, edgeSamples, tolerance)
    ) {
      candidateMask[index] = 1;
    }
  }
  return candidateMask;
}

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

function featherBackgroundMask(data, bgMask, width, height, feather = 3) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (bgMask[idx]) {
        data[idx * 4 + 3] = 0;
        continue;
      }

      let minDist = feather + 1;
      outer: for (let dy = -feather; dy <= feather; dy += 1) {
        for (let dx = -feather; dx <= feather; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && bgMask[ny * width + nx]) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < minDist) minDist = distance;
            if (distance <= 1) break outer;
          }
        }
      }

      if (minDist <= feather) {
        data[idx * 4 + 3] = Math.round(255 * (minDist / feather));
      }
    }
  }
}

export function buildBackgroundMaskFromImageData(data, width, height, options = {}) {
  const edgeSamples = options.edgeSamples || [];
  if (!edgeSamples.length) {
    return new Uint8Array(width * height);
  }

  const tolerance = options.tolerance || 34;
  const candidateMask = buildNeutralCandidateMask(data, width, height, edgeSamples, tolerance);
  const bgMask = floodFillEdgeBackground(candidateMask, width, height);
  fillEnclosedNeutralHoles(candidateMask, bgMask, width, height, options);
  return bgMask;
}

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
        const canvas = document.createElement('canvas');
        const w = img.width, h = img.height;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timeoutId);
          safeResolve(resolvedSrc || imgSrc);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const edgeSamples = [];
        const samplePositions = [
          [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
          [Math.floor(w * 0.1), 0], [Math.floor(w * 0.5), 0], [Math.floor(w * 0.9), 0],
          [Math.floor(w * 0.1), h - 1], [Math.floor(w * 0.5), h - 1], [Math.floor(w * 0.9), h - 1],
          [0, Math.floor(h * 0.1)], [0, Math.floor(h * 0.5)], [0, Math.floor(h * 0.9)],
          [w - 1, Math.floor(h * 0.1)], [w - 1, Math.floor(h * 0.5)], [w - 1, Math.floor(h * 0.9)],
        ];

        for (const [cx, cy] of samplePositions) {
          const i = (cy * w + cx) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (isLikelyNeutralBackgroundPixel(r, g, b, a)) {
            edgeSamples.push({ r, g, b });
          }
        }

        if (edgeSamples.length === 0) {
          window.clearTimeout(timeoutId);
          safeResolve(resolvedSrc || imgSrc);
          return;
        }

        const bgMask = buildBackgroundMaskFromImageData(data, w, h, { edgeSamples, tolerance: 34 });
        featherBackgroundMask(data, bgMask, w, h, 3);

        ctx.putImageData(imageData, 0, 0);
        window.clearTimeout(timeoutId);
        safeResolve(canvas.toDataURL('image/png'));
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
