#!/usr/bin/env python3
"""
extract-muscle-masks.py
Pixel-traces muscle regions from anatomy PNGs using Python Pillow + numpy.
No browser needed.

Algorithm:
1. Load PNG. Compute dist_white per pixel = (255-R + 255-G + 255-B) / 3.
2. For each anchor, if the seed pixel is near-white, find nearest non-white neighbor.
3. Flood fill using RGB color distance from seed. Constrained by radius.
4. Trace boundary with Moore neighborhood algorithm.
5. Simplify with iterative RDP.
6. Convert pixel coords back to SVG viewBox coords.

Usage:
  python .tools/extract-muscle-masks.py
  python .tools/extract-muscle-masks.py --dry-run
  python .tools/extract-muscle-masks.py --key neck
  python .tools/extract-muscle-masks.py --visualize  # saves debug images

Output: frontend/src/utils/muscleMasks.data.json
"""

import sys, os, json, math, argparse, datetime
from pathlib import Path
from collections import deque

try:
    import numpy as np
    from PIL import Image, ImageDraw
except ImportError:
    print("ERROR: Pillow/numpy not found. Install with: pip install pillow numpy")
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent
ANTERIOR_PNG = REPO_ROOT / "frontend/src/assets/anatomy/muscles-anterior-gray.png"
POSTERIOR_PNG = REPO_ROOT / "frontend/src/assets/anatomy/muscles-posterior-gray-unlabeled.png"
OUT_PATH = REPO_ROOT / "frontend/src/utils/muscleMasks.data.json"

# ── SVG layout constants (from MuscleTraining.jsx) ────────────────────────────
# Viewbox: 0,0 -> 790,580
# Anterior: <image x=58 y=42 width=264 height=508 preserveAspectRatio="xMidYMid slice">
# Posterior: <image x=411.12 y=59.4 width=370.2 height=491.2 preserveAspectRatio="xMidYMid meet">

SVG_ANTERIOR = dict(svgX=58.0, svgY=42.0, svgW=264.0, svgH=508.0, ar='slice')
SVG_POSTERIOR = dict(svgX=411.12, svgY=59.4, svgW=370.2, svgH=491.2, ar='meet')


def compute_render_transform(img_w, img_h, svg_w, svg_h, ar):
    """
    Returns (scale, off_x, off_y):
      scale: image pixels per SVG unit
      off_x, off_y: offset in SVG units from rect origin to image origin
                    (negative for slice = image extends beyond boundary)
    """
    if ar == 'slice':
        scale = max(svg_w / img_w, svg_h / img_h)
    else:
        scale = min(svg_w / img_w, svg_h / img_h)
    rendered_w = img_w * scale
    rendered_h = img_h * scale
    off_x = (svg_w - rendered_w) / 2
    off_y = (svg_h - rendered_h) / 2
    return scale, off_x, off_y


def svg_to_img_px(svgX, svgY, svg_rect, img_size, ar):
    """SVG viewBox coords -> image pixel coords (float)."""
    img_w, img_h = img_size
    scale, off_x, off_y = compute_render_transform(img_w, img_h, svg_rect['svgW'], svg_rect['svgH'], ar)
    local_x = svgX - svg_rect['svgX']
    local_y = svgY - svg_rect['svgY']
    return (local_x - off_x) / scale, (local_y - off_y) / scale


def img_px_to_svg(px_x, px_y, svg_rect, img_size, ar):
    """Image pixel coords -> SVG viewBox coords."""
    img_w, img_h = img_size
    scale, off_x, off_y = compute_render_transform(img_w, img_h, svg_rect['svgW'], svg_rect['svgH'], ar)
    return svg_rect['svgX'] + px_x * scale + off_x, svg_rect['svgY'] + px_y * scale + off_y


# ── Anchor table ──────────────────────────────────────────────────────────────
# svgX, svgY: top-level SVG viewBox coords
# radius: SVG units (max flood-fill extent from seed)
# colorThreshold: max RGB Euclidean distance from seed for flood fill
# seedSearch: max pixels to search for non-white seed (0 = use exact anchor)
ANCHORS = [
    # ── ANTERIOR (calibrated from actual PNG pixel analysis)
    dict(key='neck',                 view='anterior',  svgX=199,  svgY=118, radius=20, colorThreshold=130, seedSearch=25),
    dict(key='traps-front-left',     view='anterior',  svgX=174,  svgY=144, radius=22, colorThreshold=110, seedSearch=20),
    dict(key='traps-front-right',    view='anterior',  svgX=199,  svgY=131, radius=22, colorThreshold=110, seedSearch=20),
    dict(key='deltoids-left',        view='anterior',  svgX=129,  svgY=156, radius=26, colorThreshold=110, seedSearch=15),
    dict(key='deltoids-right',       view='anterior',  svgX=234,  svgY=155, radius=30, colorThreshold=150, seedSearch=30),
    dict(key='pectorals-left',       view='anterior',  svgX=163,  svgY=174, radius=32, colorThreshold=120, seedSearch=15),
    dict(key='pectorals-right',      view='anterior',  svgX=202,  svgY=156, radius=32, colorThreshold=120, seedSearch=15),
    dict(key='biceps-left',          view='anterior',  svgX=113,  svgY=205, radius=20, colorThreshold=108, seedSearch=15),
    dict(key='biceps-right',         view='anterior',  svgX=255,  svgY=199, radius=20, colorThreshold=108, seedSearch=20),
    dict(key='forearms-front-left',  view='anterior',  svgX=93,   svgY=246, radius=26, colorThreshold=110, seedSearch=15),
    dict(key='forearms-front-right', view='anterior',  svgX=286,  svgY=249, radius=26, colorThreshold=110, seedSearch=15),
    dict(key='abdominals',           view='anterior',  svgX=186,  svgY=221, radius=52, colorThreshold=136, seedSearch=20),
    dict(key='quadriceps-left',      view='anterior',  svgX=161,  svgY=377, radius=48, colorThreshold=120, seedSearch=15),
    dict(key='quadriceps-right',     view='anterior',  svgX=220,  svgY=378, radius=48, colorThreshold=120, seedSearch=15),
    dict(key='calves-front-left',    view='anterior',  svgX=160,  svgY=480, radius=28, colorThreshold=110, seedSearch=15),
    dict(key='calves-front-right',   view='anterior',  svgX=221,  svgY=480, radius=28, colorThreshold=110, seedSearch=15),

    # ── POSTERIOR (calibrated from actual PNG pixel analysis)
    dict(key='trapezius-left',       view='posterior', svgX=550,  svgY=113, radius=26, colorThreshold=100, seedSearch=20),
    dict(key='trapezius-right',      view='posterior', svgX=608,  svgY=127, radius=34, colorThreshold=140, seedSearch=25),
    dict(key='shoulders-back-left',  view='posterior', svgX=518,  svgY=126, radius=28, colorThreshold=140, seedSearch=25),
    dict(key='shoulders-back-right', view='posterior', svgX=629,  svgY=137, radius=28, colorThreshold=120, seedSearch=20),
    dict(key='lats-left',            view='posterior', svgX=490,  svgY=186, radius=34, colorThreshold=124, seedSearch=25),
    dict(key='lats-right',           view='posterior', svgX=617,  svgY=186, radius=34, colorThreshold=109, seedSearch=25),
    dict(key='triceps-left',         view='posterior', svgX=476,  svgY=194, radius=28, colorThreshold=115, seedSearch=15),
    dict(key='triceps-right',        view='posterior', svgX=690,  svgY=199, radius=28, colorThreshold=115, seedSearch=15),
    dict(key='forearms-back-left',   view='posterior', svgX=462,  svgY=245, radius=28, colorThreshold=115, seedSearch=15),
    dict(key='forearms-back-right',  view='posterior', svgX=703,  svgY=250, radius=28, colorThreshold=115, seedSearch=15),
    dict(key='lower-back-left',      view='posterior', svgX=556,  svgY=251, radius=26, colorThreshold=115, seedSearch=15),
    dict(key='lower-back-right',     view='posterior', svgX=598,  svgY=251, radius=26, colorThreshold=140, seedSearch=25),
    dict(key='glutes-left',          view='posterior', svgX=551,  svgY=306, radius=36, colorThreshold=120, seedSearch=15),
    dict(key='glutes-right',         view='posterior', svgX=608,  svgY=306, radius=36, colorThreshold=120, seedSearch=15),
    dict(key='hamstrings-left',      view='posterior', svgX=544,  svgY=378, radius=50, colorThreshold=120, seedSearch=15),
    dict(key='hamstrings-right',     view='posterior', svgX=597,  svgY=380, radius=50, colorThreshold=140, seedSearch=25),
    dict(key='gastrocnemius-left',   view='posterior', svgX=550,  svgY=468, radius=33, colorThreshold=110, seedSearch=25),
    dict(key='gastrocnemius-right',  view='posterior', svgX=603,  svgY=468, radius=33, colorThreshold=110, seedSearch=20),
]


# ── Image analysis helpers ────────────────────────────────────────────────────

def dist_white(r, g, b):
    """Average distance from white (0=white, 255=black)."""
    return ((255 - int(r)) + (255 - int(g)) + (255 - int(b))) / 3.0


def rgb_dist(r1, g1, b1, r2, g2, b2):
    """Euclidean RGB distance."""
    dr, dg, db = int(r1)-int(r2), int(g1)-int(g2), int(b1)-int(b2)
    return math.sqrt(dr*dr + dg*dg + db*db)


def find_best_seed(pixels_np, cx, cy, max_search, min_dist_white=20):
    """
    Find the best seed pixel near (cx, cy).
    Prefers pixels with dist_white in range [40, 160] (visible muscle tissue, not pure white or black outline).
    Falls back to any non-white pixel if none found.
    Returns (best_x, best_y) or (cx, cy) as fallback.
    """
    h, w = pixels_np.shape[:2]
    cx, cy = int(round(cx)), int(round(cy))

    def pixel_score(x, y):
        if not (0 <= x < w and 0 <= y < h):
            return -1
        r, g, b = pixels_np[y, x]
        dw = dist_white(r, g, b)
        if dw < min_dist_white:
            return -1
        # Prefer muscle-tone range (dw 60-140). Score peaks at dw=100.
        # Penalize very light (below 40) and very dark outlines (above 170).
        if dw < 40:
            score = dw * 0.5  # light gray - low score
        elif dw > 170:
            score = 170 - (dw - 170) * 0.5  # very dark outline - penalize
        elif dw > 140:
            score = 140 - (dw - 140) * 0.3  # slightly dark - mild penalty
        else:
            score = dw  # muscle tone (40-140) - use raw dw
        # Warm tone bonus (red > others = flesh tone)
        warm = int(r) - (int(r) + int(g) + int(b)) // 3
        return score + warm * 0.5

    # Check current pixel
    s = pixel_score(cx, cy)
    if s > 20:
        return cx, cy

    best_x, best_y, best_score = None, None, 0
    for radius in range(1, max_search + 1):
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if abs(dx) != radius and abs(dy) != radius:
                    continue
                nx, ny = cx + dx, cy + dy
                s = pixel_score(nx, ny)
                if s > best_score:
                    best_score = s
                    best_x, best_y = nx, ny
        if best_score > 40:  # found a good candidate
            return best_x, best_y

    return best_x if best_x is not None else cx, best_y if best_y is not None else cy


def flood_fill_color(pixels_np, seed_x, seed_y, color_threshold, radius_px, img_w, img_h):
    """
    BFS flood fill using RGB color distance from seed.
    Also requires pixel dist_white > 10 (not background).
    Radius constraint prevents overflow into neighboring muscles.
    Returns set of (x,y) pixel coords.
    """
    sr, sg, sb = int(pixels_np[seed_y, seed_x, 0]), int(pixels_np[seed_y, seed_x, 1]), int(pixels_np[seed_y, seed_x, 2])
    seed_dw = dist_white(sr, sg, sb)

    radius_sq = radius_px * radius_px
    filled = set()
    visited = set()
    queue = deque([(seed_x, seed_y)])

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or y < 0 or x >= img_w or y >= img_h:
            continue
        visited.add((x, y))

        r, g, b = int(pixels_np[y, x, 0]), int(pixels_np[y, x, 1]), int(pixels_np[y, x, 2])
        dw = dist_white(r, g, b)

        # Skip near-white pixels (background)
        if dw < 12:
            continue

        # Color distance from seed
        cd = rgb_dist(r, g, b, sr, sg, sb)
        if cd > color_threshold:
            continue

        # Radius constraint
        dx, dy = x - seed_x, y - seed_y
        if dx * dx + dy * dy > radius_sq:
            continue

        filled.add((x, y))
        queue.append((x + 1, y))
        queue.append((x - 1, y))
        queue.append((x, y + 1))
        queue.append((x, y - 1))

    return filled, (sr, sg, sb)


def extract_radial_polygon(fill_set, n_angles=64):
    """
    Extract a radial polygon from the fill set.

    For each angular bin (0..2π divided into n_angles bins):
    1. Find the FARTHEST filled pixel from the centroid in that direction.
    2. Use that as the polygon vertex.

    This gives a clean, compact polygon that accurately traces the muscle
    outline even for complex shapes with internal detail.

    Returns list of (x, y) pixel-coordinate vertices (or fewer if some
    angular bins are empty).
    """
    if not fill_set:
        return []

    xs = [x for x, y in fill_set]
    ys = [y for x, y in fill_set]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)

    # For each fill pixel, compute angle and distance from centroid
    angle_buckets = {}  # angle_bin -> (x, y, dist)
    step = 2 * math.pi / n_angles
    for (x, y) in fill_set:
        angle = math.atan2(y - cy, x - cx)
        bucket = int((angle + math.pi) / (2 * math.pi) * n_angles) % n_angles
        dist = math.sqrt((x - cx)**2 + (y - cy)**2)
        if bucket not in angle_buckets or dist > angle_buckets[bucket][2]:
            angle_buckets[bucket] = (x, y, dist)

    # Collect vertices in angular order
    vertices = []
    for i in range(n_angles):
        if i in angle_buckets:
            x, y, _ = angle_buckets[i]
            vertices.append((x, y))

    return vertices


def rdp_iterative(points, epsilon):
    """Iterative Ramer-Douglas-Peucker simplification."""
    if len(points) < 3:
        return list(points)

    keep = [False] * len(points)
    keep[0] = True
    keep[-1] = True
    stack = [(0, len(points) - 1)]

    while stack:
        start_i, end_i = stack.pop()
        if end_i - start_i <= 1:
            continue
        start, end = points[start_i], points[end_i]
        dx = end[0] - start[0]
        dy = end[1] - start[1]
        length = math.sqrt(dx * dx + dy * dy)

        max_dist = 0.0
        max_idx = start_i
        for i in range(start_i + 1, end_i):
            if length == 0:
                dist = math.sqrt((points[i][0] - start[0])**2 + (points[i][1] - start[1])**2)
            else:
                dist = abs(dy * points[i][0] - dx * points[i][1] + end[0] * start[1] - end[1] * start[0]) / length
            if dist > max_dist:
                max_dist = dist
                max_idx = i

        if max_dist > epsilon:
            keep[max_idx] = True
            stack.append((start_i, max_idx))
            stack.append((max_idx, end_i))

    return [p for i, p in enumerate(points) if keep[i]]


def process_anchor(anchor, pixels_np, img_size, svg_rect):
    """Process a single muscle anchor and return mask data dict."""
    img_w, img_h = img_size
    ar = svg_rect['ar']

    # Convert SVG coords to image pixels
    px_f, py_f = svg_to_img_px(anchor['svgX'], anchor['svgY'], svg_rect, img_size, ar)
    px, py = int(round(px_f)), int(round(py_f))

    if px < 0 or py < 0 or px >= img_w or py >= img_h:
        return {'error': f'anchor outside image: px={px}, py={py}, img={img_w}x{img_h}', 'view': anchor['view']}

    # Find best seed (nearest non-white pixel)
    seed_search = anchor.get('seedSearch', 20)
    seed_x, seed_y = find_best_seed(pixels_np, px, py, seed_search)
    if seed_x is None:
        return {'error': 'no non-white pixel found near anchor', 'view': anchor['view']}

    # Compute radius in image pixels
    scale, _, _ = compute_render_transform(img_w, img_h, svg_rect['svgW'], svg_rect['svgH'], ar)
    radius_px = anchor['radius'] / scale

    # Flood fill
    filled, seed_rgb = flood_fill_color(pixels_np, seed_x, seed_y, anchor['colorThreshold'], radius_px, img_w, img_h)
    filled_count = len(filled)

    if filled_count < 20:
        return {
            'error': f'fill too small: {filled_count} pixels',
            'seedRGB': list(seed_rgb),
            'seedXY': [seed_x, seed_y],
            'view': anchor['view'],
        }

    # Extract radial polygon (clean, compact boundary)
    # Use 48 angles = ~48 polygon vertices which is smooth enough for visual quality
    n_angles = 48
    poly_img = extract_radial_polygon(filled, n_angles=n_angles)
    if len(poly_img) < 4:
        return {'error': f'polygon too short: {len(poly_img)} pts', 'filledCount': filled_count, 'view': anchor['view']}

    # RDP simplify to remove near-collinear points
    epsilon_px = 0.8 / scale  # ~0.8 SVG units tolerance
    simplified = rdp_iterative(poly_img, epsilon_px)
    if len(simplified) < 4:
        # RDP too aggressive — use all radial points
        simplified = poly_img

    # Convert back to SVG coords
    path_points = []
    for (ix, iy) in simplified:
        sx, sy = img_px_to_svg(ix, iy, svg_rect, img_size, ar)
        path_points.append((round(sx, 1), round(sy, 1)))

    d = ' '.join(
        ('M' if i == 0 else 'L') + f'{p[0]},{p[1]}'
        for i, p in enumerate(path_points)
    ) + ' Z'

    return {
        'view': anchor['view'],
        'd': d,
        'pointCount': len(simplified),
        'filledCount': filled_count,
        'seedRGB': list(seed_rgb),
        'seedXY': [seed_x, seed_y],
        'anchorSvg': [anchor['svgX'], anchor['svgY']],
    }


def save_debug_visualization(anchor, filled, seed_x, seed_y, pixels_np, svg_rect, img_size, out_dir):
    """Save a debug visualization for a single anchor."""
    try:
        img_w, img_h = img_size
        ar = svg_rect['ar']
        scale, off_x, off_y = compute_render_transform(img_w, img_h, svg_rect['svgW'], svg_rect['svgH'], ar)

        if not filled:
            return

        xs = [x for x, y in filled]
        ys = [y for x, y in filled]
        minx, maxx = max(0, min(xs) - 30), min(img_w, max(xs) + 30)
        miny, maxy = max(0, min(ys) - 30), min(img_h, max(ys) + 30)

        from PIL import Image as PILImage, ImageDraw as PILDraw
        img_array = pixels_np[miny:maxy, minx:maxx].copy()
        img_crop = PILImage.fromarray(img_array.astype('uint8'), 'RGB')

        draw = PILDraw.Draw(img_crop)
        for (x, y) in filled:
            cx, cy = x - minx, y - miny
            if 0 <= cx < img_crop.width and 0 <= cy < img_crop.height:
                draw.point((cx, cy), fill=(255, 80, 60, 180))

        # Mark seed
        sx, sy = seed_x - minx, seed_y - miny
        draw.ellipse([sx-4, sy-4, sx+4, sy+4], outline='yellow', width=2)

        # Scale up for visibility
        w, h = img_crop.size
        scale_up = max(1, 300 // max(w, h))
        img_crop = img_crop.resize((w * scale_up, h * scale_up), resample=PILImage.NEAREST)
        out_path = out_dir / f"debug-{anchor['key']}.png"
        img_crop.save(str(out_path))
    except Exception as e:
        print(f"    (debug vis failed: {e})")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--key', type=str, help='Process only this anchor key')
    parser.add_argument('--visualize', action='store_true', help='Save debug images to task-images/')
    args = parser.parse_args()

    if args.dry_run:
        for a in ANCHORS:
            print(json.dumps({k: a[k] for k in ('key', 'view', 'svgX', 'svgY', 'radius', 'colorThreshold')}))
        return

    print("Loading images...")
    anterior_img = Image.open(str(ANTERIOR_PNG)).convert('RGB')
    posterior_img = Image.open(str(POSTERIOR_PNG)).convert('RGB')
    anterior_np = np.array(anterior_img)
    posterior_np = np.array(posterior_img)
    print(f"  anterior: {anterior_img.size}")
    print(f"  posterior: {posterior_img.size}")

    anchors_to_process = ANCHORS if not args.key else [a for a in ANCHORS if a['key'] == args.key]
    if args.key and not anchors_to_process:
        print(f"ERROR: No anchor with key='{args.key}'")
        print(f"Available: {[a['key'] for a in ANCHORS]}")
        sys.exit(1)

    # Load existing masks for incremental update
    existing_masks = {}
    if OUT_PATH.exists():
        try:
            existing_masks = json.loads(OUT_PATH.read_text()).get('masks', {})
        except Exception:
            pass

    masks = dict(existing_masks)
    ok_list, failed_list = [], []

    debug_dir = None
    if args.visualize:
        debug_dir = REPO_ROOT / "task-images"
        debug_dir.mkdir(exist_ok=True)

    for anchor in anchors_to_process:
        is_posterior = anchor['view'] == 'posterior'
        pixels_np = posterior_np if is_posterior else anterior_np
        img = posterior_img if is_posterior else anterior_img
        svg_rect = SVG_POSTERIOR if is_posterior else SVG_ANTERIOR

        sys.stdout.write(f"  {anchor['key']} ({anchor['view']})... ")
        sys.stdout.flush()

        result = process_anchor(anchor, pixels_np, img.size, svg_rect)
        masks[anchor['key']] = result

        if 'error' in result:
            print(f"FAIL: {result['error']}")
            failed_list.append({'key': anchor['key'], 'error': result['error'], **{k: result.get(k) for k in ('seedRGB','seedXY')}})
        else:
            print(f"OK: {result['pointCount']} pts, {result['filledCount']} px, seed={result.get('seedRGB')}")
            ok_list.append(anchor['key'])

            if args.visualize:
                # Re-run fill for visualization
                scale, _, _ = compute_render_transform(img.size[0], img.size[1], svg_rect['svgW'], svg_rect['svgH'], svg_rect['ar'])
                radius_px = anchor['radius'] / scale
                px_f, py_f = svg_to_img_px(anchor['svgX'], anchor['svgY'], svg_rect, img.size, svg_rect['ar'])
                seed_x, seed_y = find_best_seed(pixels_np, int(round(px_f)), int(round(py_f)), anchor.get('seedSearch', 20))
                if seed_x is not None:
                    filled_vis, _ = flood_fill_color(pixels_np, seed_x, seed_y, anchor['colorThreshold'], radius_px, img.size[0], img.size[1])
                    save_debug_visualization(anchor, filled_vis, seed_x, seed_y, pixels_np, svg_rect, img.size, debug_dir)

    # Write output
    output = {
        'version': 1,
        'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'anteriorImageBBox': {'x': 58, 'y': 42, 'w': 264, 'h': 508},
        'posteriorImageBBox': {'x': 411.12, 'y': 59.4, 'w': 370.2, 'h': 491.2},
        'anchors': [{k: a[k] for k in ('key', 'view', 'svgX', 'svgY', 'radius', 'colorThreshold')} for a in ANCHORS],
        'masks': masks,
    }

    OUT_PATH.write_text(json.dumps(output, indent=2), encoding='utf-8')
    print(f"\nDone: {len(ok_list)} OK, {len(failed_list)} failed")
    if failed_list:
        print("Failed:")
        for f in failed_list:
            extra = ''
            if f.get('seedRGB'):
                extra = f" seed={f['seedRGB']}"
            if f.get('seedXY'):
                extra += f" xy={f['seedXY']}"
            print(f"  {f['key']}: {f['error']}{extra}")
    print(f"Wrote: {OUT_PATH}")


if __name__ == '__main__':
    main()
