import argparse
import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover - optional dependency in local envs
    cv2 = None

try:
    from PIL import Image
except Exception:  # pragma: no cover - optional dependency in local envs
    Image = None

try:
    from skimage.morphology import skeletonize
except Exception:  # pragma: no cover - optional dependency in local envs
    skeletonize = None


COLOR_DISTANCE_TOLERANCE = 48.0
MASK_CLOSE_KERNEL_PX = 7
COMPONENT_SIGNIFICANCE_RATIO = 0.1
MIN_SIGNIFICANT_COMPONENT_PIXELS = 4
MAX_COMPONENT_ENDPOINT_GAP_PX = 48.0
MIN_USABLE_ROUTE_POINTS = 12
SPUR_MAX_LENGTH_PX = 6
MORPH_BRIDGE_MAX_GAP_PX = 16
MULTI_COLOR_MAX_COMBINE = 3
AUTO_COLOR_SAMPLE_STRIDE = 4
AUTO_COLOR_MIN_SATURATION = 120
AUTO_COLOR_CLUSTER_RADIUS = 32.0
COMMON_ROUTE_COLORS = (
    "#E53935",  # red
    "#D32F2F",
    "#F4511E",  # orange-red
    "#FB8C00",  # orange
    "#FDD835",  # yellow
    "#FBC02D",
    "#1E88E5",  # blue
    "#1565C0",
    "#00ACC1",  # cyan
    "#00897B",  # teal
    "#43A047",  # green
    "#8E24AA",  # purple
    "#212121",  # dark route strokes
)
NEIGHBOR_OFFSETS = (
    (-1, -1),
    (-1, 0),
    (-1, 1),
    (0, -1),
    (0, 1),
    (1, -1),
    (1, 0),
    (1, 1),
)
FOUR_NEIGHBORS = (
    (-1, 0),
    (0, -1),
    (0, 1),
    (1, 0),
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract an ordered skeleton path from a route image.")
    parser.add_argument("--image", required=True, help="Path to the input route image.")
    parser.add_argument(
        "--route-hex-color",
        default="",
        help="Optional target route color in #RRGGBB form. When omitted, the extractor scans common course-map stroke colors.",
    )
    return parser.parse_args(argv)


def parse_hex_color(value: str) -> np.ndarray:
    text = value.strip()
    if not text.startswith("#") or len(text) != 7:
        raise ValueError("route color must be in #RRGGBB format")
    try:
        return np.array(
            [int(text[1:3], 16), int(text[3:5], 16), int(text[5:7], 16)],
            dtype=np.uint8,
        )
    except ValueError as exc:
        raise ValueError("route color must be in #RRGGBB format") from exc


def load_image(path: Path) -> np.ndarray:
    if Image is not None:
        with Image.open(path) as image:
            return np.asarray(image.convert("RGB"), dtype=np.uint8)
    return load_ascii_ppm(path)


def load_ascii_ppm(path: Path) -> np.ndarray:
    tokens: list[str] = []
    for raw_line in path.read_text(encoding="ascii").splitlines():
        content = raw_line.split("#", 1)[0].strip()
        if content:
            tokens.extend(content.split())

    if len(tokens) < 4 or tokens[0] != "P3":
        raise RuntimeError("Pillow is required to read non-P3 images in this environment.")

    width = int(tokens[1])
    height = int(tokens[2])
    max_value = int(tokens[3])
    values = [int(token) for token in tokens[4:]]
    expected_value_count = width * height * 3
    if len(values) != expected_value_count:
        raise RuntimeError("PPM image data is malformed.")

    pixels = np.array(values, dtype=np.float32).reshape((height, width, 3))
    if max_value != 255:
        pixels = np.round(pixels * (255.0 / max_value))
    return pixels.astype(np.uint8)


def build_color_mask(image: np.ndarray, route_rgb: np.ndarray, tolerance: float = COLOR_DISTANCE_TOLERANCE) -> np.ndarray:
    if cv2 is not None:
        return build_hsv_mask(image, route_rgb)
    difference = image.astype(np.int16) - route_rgb.astype(np.int16)
    distance = np.linalg.norm(difference, axis=2)
    return distance <= tolerance


def build_hsv_mask(image: np.ndarray, route_rgb: np.ndarray) -> np.ndarray:
    bgr_image = image[:, :, ::-1]
    route_pixel = np.uint8([[route_rgb.tolist()]])
    hsv_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
    hsv_color = cv2.cvtColor(route_pixel[:, :, ::-1], cv2.COLOR_BGR2HSV)[0, 0]

    hue = int(hsv_color[0])
    saturation = int(hsv_color[1])
    value = int(hsv_color[2])

    lower = np.array([max(0, hue - 8), max(0, saturation - 80), max(0, value - 80)], dtype=np.uint8)
    upper = np.array([min(179, hue + 8), min(255, saturation + 80), min(255, value + 80)], dtype=np.uint8)
    return cv2.inRange(hsv_image, lower, upper) > 0


def prepare_route_mask(mask: np.ndarray) -> np.ndarray:
    if cv2 is None:
        return mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (MASK_CLOSE_KERNEL_PX, MASK_CLOSE_KERNEL_PX))
    closed = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel) > 0
    # If the elliptical close produced a very sparse mask, try line-shaped
    # kernels as well to bridge directional gaps.
    if closed.sum() > 0 and closed.sum() < mask.size * 0.02:
        line_closed = bridge_with_morphological_closing(closed)
        if line_closed.sum() >= closed.sum() * 1.15:
            return line_closed
    return closed


def remove_spurs(skeleton: np.ndarray, max_spur_length: int = SPUR_MAX_LENGTH_PX) -> np.ndarray:
    """Remove short spurious branches from a skeletonized binary mask.

    Traces every endpoint with degree 1 backwards along the skeleton.
    If the path reaches a branch point (degree >= 3) within max_spur_length,
    only the segment from the endpoint to the branch point is pruned.
    If the path is shorter than max_spur_length and never hits a branch point,
    the entire short isolated segment is removed.
    """
    if skeleton.sum() == 0:
        return skeleton
    coords = {(int(y), int(x)) for y, x in np.argwhere(skeleton)}
    adjacency = _build_skeleton_adjacency(coords)

    endpoints = {node for node, neighbors in adjacency.items() if len(neighbors) == 1}
    branch_points = {node for node, neighbors in adjacency.items() if len(neighbors) >= 3}

    to_remove: set[tuple[int, int]] = set()
    for endpoint in endpoints:
        if endpoint in to_remove:
            continue
        path: list[tuple[int, int]] = []
        current = endpoint
        prev = None
        while current is not None and len(path) < max_spur_length + 1:
            path.append(current)
            if current in branch_points and len(path) > 1:
                break
            neighbors = [n for n in adjacency.get(current, []) if n != prev]
            if not neighbors:
                break
            if len(neighbors) >= 2 and current != endpoint:
                # Hit a fork — stop tracing to avoid over-pruning
                break
            prev = current
            current = neighbors[0]

        if len(path) <= max_spur_length and endpoint in path and path[-1] not in branch_points:
            # Entire path is a spur (endpoint never reached a branch point)
            to_remove.update(path)
        elif len(path) <= max_spur_length and path[-1] in branch_points:
            # Path from endpoint to branch point is short — prune it
            # Exclude the branch point itself from removal
            to_remove.update(path[:-1])

    if not to_remove:
        return skeleton.copy()

    result = skeleton.copy()
    for y, x in to_remove:
        if 0 <= y < result.shape[0] and 0 <= x < result.shape[1]:
            result[y, x] = False
    return result


def _build_skeleton_adjacency(coords: set[tuple[int, int]]) -> dict[tuple[int, int], list[tuple[int, int]]]:
    """Build adjacency for skeleton pixels using 8-neighbor connectivity."""
    adjacency: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for y, x in coords:
        adjacency[(y, x)] = []
        for dy, dx in NEIGHBOR_OFFSETS:
            neighbor = (y + dy, x + dx)
            if neighbor in coords:
                adjacency[(y, x)].append(neighbor)
    return adjacency


def bridge_with_morphological_closing(
    mask: np.ndarray, max_gap_px: int = MORPH_BRIDGE_MAX_GAP_PX
) -> np.ndarray:
    """Reconnect nearby disconnected route segments using morphological closing.

    Uses a line-shaped structuring element rotated across four orientations
    (horizontal, vertical, and both diagonals). Each orientation closes gaps
    along its direction. The union of all four closings is returned so that
    the route keeps its natural curves while still bridging gaps.
    """
    if cv2 is None:
        return mask

    kernel_size = max(3, max_gap_px)
    result = mask.astype(np.uint8)

    # Horizontal line kernel
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_size))
    closed_h = cv2.morphologyEx(result, cv2.MORPH_CLOSE, h_kernel)

    # Vertical line kernel
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, 1))
    closed_v = cv2.morphologyEx(result, cv2.MORPH_CLOSE, v_kernel)

    # Diagonal (45 deg) line kernel
    d1_kernel = np.eye(kernel_size, dtype=np.uint8)
    closed_d1 = cv2.morphologyEx(result, cv2.MORPH_CLOSE, d1_kernel)

    # Anti-diagonal (135 deg) line kernel
    d2_kernel = np.fliplr(np.eye(kernel_size, dtype=np.uint8))
    closed_d2 = cv2.morphologyEx(result, cv2.MORPH_CLOSE, d2_kernel)

    combined = np.maximum.reduce([closed_h, closed_v, closed_d1, closed_d2])
    return combined > 0


def build_combined_mask(
    image: np.ndarray,
    masks: list[tuple[str, np.ndarray]],
    max_combine: int = MULTI_COLOR_MAX_COMBINE,
) -> tuple[str, np.ndarray]:
    """Combine the best candidate color masks when a single color fails.

    When a route is drawn with a gradient or multiple overlapping colors,
    no single mask captures the full route. This function unions the top N
    promising masks and closes the result to form a connected whole.
    Filters out saturated and ocean-heavy masks from the combination.
    """
    scored: list[tuple[str, np.ndarray, int]] = []
    for source, mask in masks:
        pixel_count = int(mask.sum())
        # Skip masks that are overwhelmingly large (likely background/ocean)
        if pixel_count > image.shape[0] * image.shape[1] * 0.4:
            continue
        # Skip tiny masks
        if pixel_count < 20:
            continue
        scored.append((source, mask, pixel_count))

    if len(scored) < 2:
        return ("combined:none", np.zeros(image.shape[:2], dtype=bool))

    # Sort by pixel count descending — prefer masks with substantial coverage
    scored.sort(key=lambda item: item[2], reverse=True)
    top = scored[:min(len(scored), max_combine)]

    combined = np.zeros(image.shape[:2], dtype=bool)
    for _, mask, _ in top:
        combined = combined | mask

    # Apply morphological close to merge adjacent mask regions
    if cv2 is not None:
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        combined = cv2.morphologyEx(combined.astype(np.uint8), cv2.MORPH_CLOSE, close_kernel) > 0

    source_label = "combined:" + ",".join(source for source, _, _ in top)
    return (source_label, combined)


def sample_edge_colors(image: np.ndarray) -> list[tuple[str, np.ndarray]]:
    """Auto-detect route colors by sampling saturated edge pixels.

    When no target color is provided and palette scanning fails, this samples
    the most saturated pixels along the image border to find candidate route
    colors that might otherwise be missed.
    """
    if image.shape[0] < 8 or image.shape[1] < 8:
        return []

    h, w = image.shape[:2]
    stride = AUTO_COLOR_SAMPLE_STRIDE

    # Sample from all four edges
    edge_rows = list(range(0, h, stride))
    edge_cols = list(range(0, w, stride))

    candidates: list[np.ndarray] = []
    # Top and bottom edges
    for x in edge_cols:
        candidates.append(image[0, x, :].astype(np.int16))
        candidates.append(image[h - 1, x, :].astype(np.int16))
    # Left and right edges (skip corners already sampled)
    for y in edge_rows:
        candidates.append(image[y, 0, :].astype(np.int16))
        candidates.append(image[y, w - 1, :].astype(np.int16))

    if not candidates:
        return []

    # Filter for saturated pixels
    saturated: list[np.ndarray] = []
    for pixel in candidates:
        r, g, b = pixel
        brightness = (int(r) + int(g) + int(b)) / 3
        channel_range = max(int(r), int(g), int(b)) - min(int(r), int(g), int(b))
        if channel_range >= AUTO_COLOR_MIN_SATURATION and 30 <= brightness <= 240:
            saturated.append(pixel.astype(np.uint8))

    if not saturated:
        return []

    # Cluster similar colors to avoid duplicates
    clusters: list[list[np.ndarray]] = []
    for pixel in saturated:
        best_cluster = None
        best_distance = float("inf")
        for cluster_idx, cluster in enumerate(clusters):
            centroid = np.mean(cluster, axis=0)
            dist = np.linalg.norm(pixel.astype(np.float64) - centroid)
            if dist < AUTO_COLOR_CLUSTER_RADIUS and dist < best_distance:
                best_cluster = cluster_idx
                best_distance = dist
        if best_cluster is not None:
            clusters[best_cluster].append(pixel)
        else:
            clusters.append([pixel])

    # Take the top clusters by size (most frequently occurring edge colors)
    clusters.sort(key=len, reverse=True)

    results: list[tuple[str, np.ndarray]] = []
    for idx, cluster in enumerate(clusters[:4]):
        centroid = np.mean(cluster, axis=0).astype(np.uint8)
        hex_color = "#{:02X}{:02X}{:02X}".format(int(centroid[0]), int(centroid[1]), int(centroid[2]))
        mask = prepare_route_mask(build_color_mask(image, centroid))
        results.append((f"edge:{hex_color}", mask))

    return results


def build_saturated_line_mask(image: np.ndarray) -> np.ndarray:
    if cv2 is None:
        red = image[:, :, 0].astype(np.int16)
        green = image[:, :, 1].astype(np.int16)
        blue = image[:, :, 2].astype(np.int16)
        channel_range = np.maximum.reduce([red, green, blue]) - np.minimum.reduce([red, green, blue])
        brightness = (red + green + blue) / 3
        return (channel_range >= 72) & (brightness >= 45) & (brightness <= 245)

    hsv_image = cv2.cvtColor(image[:, :, ::-1], cv2.COLOR_BGR2HSV)
    hue = hsv_image[:, :, 0]
    saturation = hsv_image[:, :, 1]
    value = hsv_image[:, :, 2]
    # Keep saturated route strokes while dropping faint basemap roads and white/black text.
    colorful = (saturation >= 70) & (value >= 55) & (value <= 250)
    # Course maps often use blue ocean/background; suppress broad cyan-blue fills and let
    # explicit palette colors handle blue route lines.
    ocean_like = (hue >= 88) & (hue <= 106) & (saturation >= 45) & (value >= 80)
    return colorful & ~ocean_like


def build_candidate_masks(image: np.ndarray, route_rgb: np.ndarray | None) -> list[tuple[str, np.ndarray]]:
    masks: list[tuple[str, np.ndarray]] = []
    seen_colors: set[tuple[int, int, int]] = set()
    if route_rgb is not None:
        masks.append(("target", prepare_route_mask(build_color_mask(image, route_rgb))))
        seen_colors.add(tuple(int(value) for value in route_rgb.tolist()))
    for color in COMMON_ROUTE_COLORS:
        rgb = parse_hex_color(color)
        key = tuple(int(value) for value in rgb.tolist())
        if key in seen_colors:
            continue
        seen_colors.add(key)
        masks.append((f"palette:{color}", prepare_route_mask(build_color_mask(image, rgb))))
    masks.append(("saturated", prepare_route_mask(build_saturated_line_mask(image))))
    return masks


def result_from_mask(mask: np.ndarray) -> dict[str, object]:
    mask_pixel_count = int(mask.sum())
    if mask_pixel_count == 0:
        return {
            "points": [],
            "pointCount": 0,
            "maskPixelCount": 0,
            "skeletonPixelCount": 0,
        }

    if skeletonize is None:
        raise RuntimeError(
            "scikit-image is required for skeletonization. Install requirements-route-extraction.txt first."
        )

    skeleton = skeletonize(mask)
    skeleton = remove_spurs(skeleton)
    ordered_points = extract_ordered_path(skeleton)

    return {
        "points": ordered_points,
        "pointCount": len(ordered_points),
        "maskPixelCount": mask_pixel_count,
        "skeletonPixelCount": int(skeleton.sum()),
    }


def route_result_score(result: dict[str, object], source: str = "") -> tuple[int, int, int, int, int]:
    point_count = int(result.get("pointCount") or 0)
    skeleton_count = int(result.get("skeletonPixelCount") or 0)
    mask_count = int(result.get("maskPixelCount") or 0)
    usable_bonus = 1 if point_count >= MIN_USABLE_ROUTE_POINTS else 0
    broad_cool_penalty = 0
    if source.startswith("palette:#1E88E5") or source.startswith("palette:#1565C0") or source.startswith("palette:#00ACC1"):
        if mask_count >= 10_000 or skeleton_count >= 2_000:
            broad_cool_penalty = -1
    return (usable_bonus, broad_cool_penalty, skeleton_count, point_count, min(skeleton_count, mask_count))


def extract_ordered_path(skeleton_mask: np.ndarray) -> list[list[int]]:
    coordinates = {(int(y), int(x)) for y, x in np.argwhere(skeleton_mask)}
    if not coordinates:
        return []

    route_component = select_route_component(coordinates)
    adjacency = build_adjacency(route_component)
    ordered = walk_simple_path(adjacency)
    if len(ordered) != len(route_component):
        ordered = walk_all_edges(adjacency)
    if len(set(ordered)) != len(route_component):
        ordered = diameter_path(adjacency)
    return [[x, y] for y, x in ordered]


def select_route_component(coordinates: set[tuple[int, int]]) -> set[tuple[int, int]]:
    components = sorted(iter_components(coordinates), key=len, reverse=True)
    if not components:
        return set()
    if len(components) == 1:
        return set(components[0])

    largest_size = len(components[0])
    significant_components = [
        component
        for component in components
        if len(component) >= max(MIN_SIGNIFICANT_COMPONENT_PIXELS, int(largest_size * COMPONENT_SIGNIFICANCE_RATIO))
    ]
    if len(significant_components) <= 1:
        return set(components[0])

    bridge_candidates: list[tuple[float, int, int, tuple[int, int], tuple[int, int]]] = []
    component_endpoints = [resolve_component_endpoints(component) for component in significant_components]
    for left_index in range(len(significant_components)):
        for right_index in range(left_index + 1, len(significant_components)):
            distance, left_point, right_point = nearest_endpoint_pair(
                component_endpoints[left_index],
                component_endpoints[right_index],
            )
            if distance <= MAX_COMPONENT_ENDPOINT_GAP_PX:
                bridge_candidates.append((distance, left_index, right_index, left_point, right_point))

    if not bridge_candidates:
        return set(components[0])

    best_group = largest_component_group(significant_components, bridge_candidates)
    if len(best_group) == 1:
        return set(significant_components[next(iter(best_group))])

    merged_component: set[tuple[int, int]] = set()
    for component_index in best_group:
        merged_component.update(significant_components[component_index])

    for _, _, _, left_point, right_point in minimum_bridge_edges(best_group, bridge_candidates):
        merged_component.update(rasterize_line(left_point, right_point))
    return merged_component


def iter_components(coordinates: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    remaining = set(coordinates)
    components: list[set[tuple[int, int]]] = []

    while remaining:
        start = min(remaining)
        queue = deque([start])
        component: set[tuple[int, int]] = set()
        remaining.remove(start)

        while queue:
            current = queue.popleft()
            component.add(current)
            for neighbor in neighbors_for(current, coordinates):
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    queue.append(neighbor)

        components.append(component)

    return components


def build_adjacency(component: set[tuple[int, int]]) -> dict[tuple[int, int], list[tuple[int, int]]]:
    adjacency: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for coordinate in component:
        adjacency[coordinate] = sorted(neighbors_for(coordinate, component))
    return adjacency


def resolve_component_endpoints(component: set[tuple[int, int]]) -> list[tuple[int, int]]:
    adjacency = build_adjacency(component)
    endpoints = sorted(node for node, neighbors in adjacency.items() if len(neighbors) <= 1)
    if endpoints:
        return endpoints
    if not adjacency:
        return []
    ordered = diameter_path(adjacency)
    if not ordered:
        return []
    return [ordered[0], ordered[-1]]


def nearest_endpoint_pair(
    left_endpoints: list[tuple[int, int]],
    right_endpoints: list[tuple[int, int]],
) -> tuple[float, tuple[int, int], tuple[int, int]]:
    best_distance = float("inf")
    best_pair: tuple[tuple[int, int], tuple[int, int]] | None = None
    for left_point in left_endpoints:
        for right_point in right_endpoints:
            distance = math.dist(left_point, right_point)
            if distance < best_distance:
                best_distance = distance
                best_pair = (left_point, right_point)
    if best_pair is None:
        raise RuntimeError("significant component was missing endpoints")
    return best_distance, best_pair[0], best_pair[1]


def largest_component_group(
    components: list[set[tuple[int, int]]],
    bridge_candidates: list[tuple[float, int, int, tuple[int, int], tuple[int, int]]],
) -> set[int]:
    adjacency: dict[int, set[int]] = {index: set() for index in range(len(components))}
    for _, left_index, right_index, _, _ in bridge_candidates:
        adjacency[left_index].add(right_index)
        adjacency[right_index].add(left_index)

    remaining = set(adjacency)
    groups: list[set[int]] = []
    while remaining:
        start = remaining.pop()
        queue = deque([start])
        group = {start}
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    group.add(neighbor)
                    queue.append(neighbor)
        groups.append(group)

    return max(
        groups,
        key=lambda group: (
            sum(len(components[index]) for index in group),
            max(len(components[index]) for index in group),
            -min(group),
        ),
    )


def minimum_bridge_edges(
    group: set[int],
    bridge_candidates: list[tuple[float, int, int, tuple[int, int], tuple[int, int]]],
) -> list[tuple[float, int, int, tuple[int, int], tuple[int, int]]]:
    parent = {index: index for index in group}

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left_index: int, right_index: int) -> bool:
        left_root = find(left_index)
        right_root = find(right_index)
        if left_root == right_root:
            return False
        parent[right_root] = left_root
        return True

    edges: list[tuple[float, int, int, tuple[int, int], tuple[int, int]]] = []
    for candidate in sorted(bridge_candidates, key=lambda item: item[0]):
        _, left_index, right_index, _, _ = candidate
        if left_index not in group or right_index not in group:
            continue
        if union(left_index, right_index):
            edges.append(candidate)
        if len(edges) == len(group) - 1:
            break
    return edges


def rasterize_line(start: tuple[int, int], end: tuple[int, int]) -> set[tuple[int, int]]:
    start_y, start_x = start
    end_y, end_x = end
    delta_x = abs(end_x - start_x)
    delta_y = abs(end_y - start_y)
    step_x = 1 if start_x < end_x else -1
    step_y = 1 if start_y < end_y else -1

    error = delta_x - delta_y
    current_x = start_x
    current_y = start_y
    points: set[tuple[int, int]] = set()

    while True:
        points.add((current_y, current_x))
        if current_x == end_x and current_y == end_y:
            return points
        doubled_error = error * 2
        if doubled_error > -delta_y:
            error -= delta_y
            current_x += step_x
        if doubled_error < delta_x:
            error += delta_x
            current_y += step_y


def neighbors_for(coordinate: tuple[int, int], coordinates: set[tuple[int, int]]) -> list[tuple[int, int]]:
    y, x = coordinate
    return [
        (y + dy, x + dx)
        for dy, dx in NEIGHBOR_OFFSETS
        if (y + dy, x + dx) in coordinates
    ]


def walk_simple_path(adjacency: dict[tuple[int, int], list[tuple[int, int]]]) -> list[tuple[int, int]]:
    endpoints = sorted(node for node, neighbors in adjacency.items() if len(neighbors) == 1)
    start = endpoints[0] if endpoints else min(adjacency)
    visited = {start}
    ordered = [start]
    current = start

    while True:
        candidates = [neighbor for neighbor in adjacency[current] if neighbor not in visited]
        if not candidates:
            return ordered
        next_node = candidates[0]
        visited.add(next_node)
        ordered.append(next_node)
        current = next_node


def walk_all_edges(adjacency: dict[tuple[int, int], list[tuple[int, int]]]) -> list[tuple[int, int]]:
    endpoints = sorted(node for node, neighbors in adjacency.items() if len(neighbors) == 1)
    start = endpoints[0] if endpoints else min(adjacency)
    visited_edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    ordered = [start]

    def edge_key(left: tuple[int, int], right: tuple[int, int]) -> tuple[tuple[int, int], tuple[int, int]]:
        return (left, right) if left <= right else (right, left)

    def visit_iterative(root: tuple[int, int]) -> None:
        stack: list[tuple[tuple[int, int], int]] = [(root, 0)]
        while stack:
            node, next_index = stack[-1]
            neighbors = adjacency[node]
            if next_index >= len(neighbors):
                stack.pop()
                if stack:
                    ordered.append(stack[-1][0])
                continue
            neighbor = neighbors[next_index]
            stack[-1] = (node, next_index + 1)
            key = edge_key(node, neighbor)
            if key in visited_edges:
                continue
            visited_edges.add(key)
            ordered.append(neighbor)
            stack.append((neighbor, 0))

    visit_iterative(start)
    while len(set(ordered)) < len(adjacency):
        unvisited = min(node for node in adjacency if node not in set(ordered))
        ordered.append(unvisited)
        visit_iterative(unvisited)
    return ordered


def diameter_path(adjacency: dict[tuple[int, int], list[tuple[int, int]]]) -> list[tuple[int, int]]:
    start = min(adjacency)
    far_a, _, _ = bfs_farthest(adjacency, start)
    far_b, parents, _ = bfs_farthest(adjacency, far_a)

    path = [far_b]
    current = far_b
    while current != far_a:
        current = parents[current]
        path.append(current)
    path.reverse()
    return path


def bfs_farthest(
    adjacency: dict[tuple[int, int], list[tuple[int, int]]],
    start: tuple[int, int],
) -> tuple[tuple[int, int], dict[tuple[int, int], tuple[int, int] | None], dict[tuple[int, int], int]]:
    queue = deque([start])
    parents: dict[tuple[int, int], tuple[int, int] | None] = {start: None}
    distance = {start: 0}
    farthest = start

    while queue:
        current = queue.popleft()
        current_distance = distance[current]
        if current_distance > distance[farthest] or (
            current_distance == distance[farthest] and current < farthest
        ):
            farthest = current

        for neighbor in adjacency[current]:
            if neighbor in distance:
                continue
            parents[neighbor] = current
            distance[neighbor] = current_distance + 1
            queue.append(neighbor)

    return farthest, parents, distance


def extract_route(image_path: Path, route_hex_color: str) -> dict[str, object]:
    image = load_image(image_path)
    route_rgb = parse_hex_color(route_hex_color) if route_hex_color.strip() else None
    masks = build_candidate_masks(image, route_rgb)
    best_precise_result: dict[str, object] | None = None
    best_precise_source = ""
    saturated_result: dict[str, object] | None = None
    saturated_source = ""
    candidate_errors: list[str] = []

    for source, mask in masks:
        try:
            candidate = result_from_mask(mask)
        except Exception as exc:
            candidate_errors.append(f"{source}: {exc}")
            continue
        candidate["routeSource"] = source
        if source == "saturated":
            saturated_result = candidate
            saturated_source = source
            continue
        if source == "target" and int(candidate.get("pointCount") or 0) >= MIN_USABLE_ROUTE_POINTS:
            return with_route_diagnostics(candidate, route_hex_color, source, candidate_errors)
        if best_precise_result is None or should_replace_precise_candidate(candidate, best_precise_result):
            best_precise_result = candidate
            best_precise_source = source

    # Multi-color fallback: try combining the best candidate masks when no
    # single color produced a usable route (gradient or multi-color course line).
    if best_precise_result is not None and int(best_precise_result.get("pointCount") or 0) < MIN_USABLE_ROUTE_POINTS:
        combined_source, combined_mask = build_combined_mask(image, masks)
        if combined_mask.sum() > 0:
            try:
                combined_result = result_from_mask(combined_mask)
                combined_result["routeSource"] = combined_source
                combined_point_count = int(combined_result.get("pointCount") or 0)
                if combined_point_count >= MIN_USABLE_ROUTE_POINTS and combined_point_count > int(best_precise_result.get("pointCount") or 0):
                    return with_route_diagnostics(
                        combined_result,
                        selected_route_hex_color(route_hex_color, best_precise_source),
                        combined_source,
                        candidate_errors,
                    )
            except Exception as exc:
                candidate_errors.append(f"{combined_source}: {exc}")

    # Edge-sampled color fallback: when palette scanning also fails,
    # try colors auto-detected from saturated edge pixels.
    if route_rgb is None and (
        best_precise_result is None
        or int(best_precise_result.get("pointCount") or 0) < MIN_USABLE_ROUTE_POINTS
    ):
        edge_masks = sample_edge_colors(image)
        for edge_source, edge_mask in edge_masks:
            try:
                edge_result = result_from_mask(edge_mask)
                edge_result["routeSource"] = edge_source
            except Exception as exc:
                candidate_errors.append(f"{edge_source}: {exc}")
                continue
            edge_point_count = int(edge_result.get("pointCount") or 0)
            if edge_point_count >= MIN_USABLE_ROUTE_POINTS:
                if best_precise_result is None or edge_point_count > int(best_precise_result.get("pointCount") or 0):
                    best_precise_result = edge_result
                    best_precise_source = edge_source

    if best_precise_result is None:
        fallback = saturated_result or result_from_mask(np.zeros(image.shape[:2], dtype=bool))
        return with_route_diagnostics(fallback, selected_route_hex_color(route_hex_color, saturated_source), saturated_source, candidate_errors)
    if int(best_precise_result["pointCount"]) >= MIN_USABLE_ROUTE_POINTS:
        return with_route_diagnostics(best_precise_result, selected_route_hex_color(route_hex_color, best_precise_source), best_precise_source, candidate_errors)
    if saturated_result is not None and route_result_score(saturated_result, saturated_source) > route_result_score(best_precise_result, best_precise_source):
        return with_route_diagnostics(saturated_result, selected_route_hex_color(route_hex_color, saturated_source), saturated_source, candidate_errors)
    return with_route_diagnostics(best_precise_result, selected_route_hex_color(route_hex_color, best_precise_source), best_precise_source, candidate_errors)


def should_replace_precise_candidate(candidate: dict[str, object], best: dict[str, object]) -> bool:
    candidate_source = str(candidate.get("routeSource") or "")
    best_source = str(best.get("routeSource") or "")
    candidate_score = route_result_score(candidate, candidate_source)
    best_score = route_result_score(best, best_source)
    candidate_point_count = int(candidate.get("pointCount") or 0)
    best_point_count = int(best.get("pointCount") or 0)
    if best_point_count < MIN_USABLE_ROUTE_POINTS:
        return candidate_score > best_score
    if candidate_point_count < MIN_USABLE_ROUTE_POINTS:
        return False

    candidate_skeleton_count = int(candidate.get("skeletonPixelCount") or 0)
    best_skeleton_count = int(best.get("skeletonPixelCount") or 0)
    required_gain = max(4, int(best_skeleton_count * 0.20))
    if candidate_skeleton_count >= best_skeleton_count + required_gain:
        return True
    return candidate_skeleton_count == best_skeleton_count and candidate_score > best_score


def selected_route_hex_color(route_hex_color: str, source: str) -> str:
    if source == "target":
        return route_hex_color.strip()
    if source.startswith("palette:"):
        return source.split(":", 1)[1]
    return route_hex_color.strip()


def with_route_diagnostics(
    result: dict[str, object],
    route_hex_color: str,
    route_source: str,
    candidate_errors: list[str],
) -> dict[str, object]:
    result["routeHexColor"] = route_hex_color
    result["routeSource"] = route_source
    result["candidateErrors"] = candidate_errors
    return result


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        result = extract_route(Path(args.image), args.route_hex_color)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
