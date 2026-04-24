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


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract an ordered skeleton path from a route image.")
    parser.add_argument("--image", required=True, help="Path to the input route image.")
    parser.add_argument("--route-hex-color", required=True, help="Target route color in #RRGGBB form.")
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
    return cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel) > 0


def extract_ordered_path(skeleton_mask: np.ndarray) -> list[list[int]]:
    coordinates = {(int(y), int(x)) for y, x in np.argwhere(skeleton_mask)}
    if not coordinates:
        return []

    route_component = select_route_component(coordinates)
    adjacency = build_adjacency(route_component)
    ordered = walk_simple_path(adjacency)
    if len(ordered) != len(route_component):
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
    route_rgb = parse_hex_color(route_hex_color)
    mask = prepare_route_mask(build_color_mask(image, route_rgb))
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
    ordered_points = extract_ordered_path(skeleton)

    return {
        "points": ordered_points,
        "pointCount": len(ordered_points),
        "maskPixelCount": mask_pixel_count,
        "skeletonPixelCount": int(skeleton.sum()),
    }


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
