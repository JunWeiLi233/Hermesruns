import { apiFetch } from '../api';

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

async function resolveProcessableImageSource(imgSrc) {
  if (!imgSrc || isDataUrl(imgSrc) || isBlobUrl(imgSrc) || isSameOriginUrl(imgSrc)) {
    return imgSrc;
  }

  if (fetchedImageCache[imgSrc]) {
    return fetchedImageCache[imgSrc];
  }

  const proxyUrl = `/api/shoes/render-source?url=${encodeURIComponent(imgSrc)}`;

  try {
    const response = await apiFetch(proxyUrl);
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

        // Flood-fill from all edge pixels
        const tolerance = 34;
        const visited = new Uint8Array(w * h);
        const bgMask = new Uint8Array(w * h); // 1 = background
        const queue = [];

        // Seed from all edge pixels
        for (let x = 0; x < w; x++) { queue.push(x, 0); queue.push(x, h - 1); }
        for (let y = 1; y < h - 1; y++) { queue.push(0, y); queue.push(w - 1, y); }

        while (queue.length > 0) {
          const py = queue.pop();
          const px = queue.pop();
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          const idx = py * w + px;
          if (visited[idx]) continue;
          visited[idx] = 1;

          const i = idx * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (!isLikelyNeutralBackgroundPixel(r, g, b, a) || !matchesAnyBackgroundSample(r, g, b, edgeSamples, tolerance)) {
            continue;
          }

          bgMask[idx] = 1;
          queue.push(px - 1, py); queue.push(px + 1, py);
          queue.push(px, py - 1); queue.push(px, py + 1);
        }

        // Apply mask with feathered edges (3px)
        const feather = 3;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (bgMask[idx]) {
              data[idx * 4 + 3] = 0; // fully transparent
            } else {
              // Check distance to nearest bg pixel for feathering
              let minDist = feather + 1;
              outer: for (let dy = -feather; dy <= feather; dy++) {
                for (let dx = -feather; dx <= feather; dx++) {
                  const nx = x + dx, ny = y + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h && bgMask[ny * w + nx]) {
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < minDist) minDist = d;
                    if (d <= 1) break outer;
                  }
                }
              }
              if (minDist <= feather) {
                data[idx * 4 + 3] = Math.round(255 * (minDist / feather));
              }
            }
          }
        }

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
