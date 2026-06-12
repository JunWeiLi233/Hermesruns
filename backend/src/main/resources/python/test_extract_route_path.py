import json
import subprocess
import sys
import unittest
import uuid
from pathlib import Path


SCRIPT_PATH = Path(__file__).resolve().parent / "extract_route_path.py"


def _write_ppm(path: Path, width: int, height: int, pixels: list[tuple[int, int, int]]) -> None:
    lines = ["P3", f"{width} {height}", "255"]
    for index, (red, green, blue) in enumerate(pixels, start=1):
        lines.append(f"{red} {green} {blue}")
        if index % width == 0:
            lines.append("")
    path.write_text("\n".join(lines), encoding="ascii")


class ExtractRoutePathCliTests(unittest.TestCase):
    def test_cli_extracts_ordered_route_points_from_synthetic_image(self) -> None:
        width = 11
        height = 11
        route_color = (255, 0, 0)
        background = (255, 255, 255)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_route_pixel = x == 5 and 2 <= y <= 8
                pixels.append(route_color if is_route_pixel else background)

        image_path = Path(__file__).resolve().parent / f"route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--route-hex-color",
                    "#FF0000",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        self.assertEqual(payload["routeSource"], "target")
        self.assertEqual(payload["routeHexColor"], "#FF0000")
        self.assertEqual(payload["maskPixelCount"], 7)
        self.assertEqual(payload["pointCount"], payload["skeletonPixelCount"])
        self.assertGreater(payload["pointCount"], 0)

        points = payload["points"]
        self.assertEqual(payload["pointCount"], len(points))

        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        self.assertEqual(len(set(xs)), 1)
        self.assertEqual(xs[0], 5)
        self.assertEqual(ys, sorted(ys))
        self.assertEqual(ys[0], 2)
        self.assertEqual(ys[-1], 8)

    def test_cli_bridges_fragmented_route_segments_and_ignores_distant_fragment(self) -> None:
        width = 140
        height = 15
        route_color = (255, 0, 0)
        background = (255, 255, 255)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_main_route_pixel = y == 7 and (
                    2 <= x <= 7
                    or 11 <= x <= 16
                    or 20 <= x <= 25
                )
                is_distant_fragment = y == 2 and 110 <= x <= 116
                pixels.append(route_color if is_main_route_pixel or is_distant_fragment else background)

        image_path = Path(__file__).resolve().parent / f"fragmented-route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--route-hex-color",
                    "#FF0000",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        points = payload["points"]
        xs = [point[0] for point in points]
        self.assertGreater(payload["pointCount"], 18)
        self.assertLessEqual(min(xs), 5)
        self.assertGreaterEqual(max(xs), 23)
        self.assertLess(max(xs), 50, msg=f"unexpected distant fragment leak: {points[:20]}")

    def test_cli_unions_repeated_route_hex_colors(self) -> None:
        width = 11
        height = 11
        red_route = (255, 0, 0)
        blue_route = (0, 109, 170)
        background = (255, 255, 255)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_red_route = x == 5 and 2 <= y <= 5
                is_blue_route = x == 5 and 6 <= y <= 8
                if is_red_route:
                    pixels.append(red_route)
                elif is_blue_route:
                    pixels.append(blue_route)
                else:
                    pixels.append(background)

        image_path = Path(__file__).resolve().parent / f"multi-color-route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--route-hex-color",
                    "#FF0000",
                    "--route-hex-color",
                    "#006DAA",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        self.assertEqual(payload["routeSource"], "target")
        self.assertEqual(payload["routeHexColor"], "#FF0000")
        self.assertEqual(payload["maskPixelCount"], 7)

        points = payload["points"]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        self.assertEqual(len(set(xs)), 1)
        self.assertEqual(xs[0], 5)
        self.assertEqual(min(ys), 2)
        self.assertEqual(max(ys), 8)
        self.assertEqual(set(ys), set(range(2, 9)))

    def test_cli_prefers_main_diameter_path_when_annotations_create_branch(self) -> None:
        width = 45
        height = 30
        route_color = (255, 0, 0)
        background = (255, 255, 255)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_main_route_pixel = y == 20 and 3 <= x <= 40
                is_annotation_branch = x == 20 and 11 <= y <= 19
                pixels.append(route_color if is_main_route_pixel or is_annotation_branch else background)

        image_path = Path(__file__).resolve().parent / f"branched-route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--route-hex-color",
                    "#FF0000",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        points = payload["points"]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        self.assertEqual(min(xs), 3)
        self.assertEqual(max(xs), 40)
        self.assertGreater(min(ys), 17, msg=f"annotation branch leaked into path: {points}")
        self.assertLessEqual(max(ys), 20, msg=f"annotation branch leaked into path: {points}")

    def test_cli_can_append_prominent_side_branch_for_near_loop_course(self) -> None:
        width = 130
        height = 80
        route_color = (255, 0, 0)
        background = (255, 255, 255)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_main_route_pixel = y == 55 and 3 <= x <= 120
                is_prominent_branch = x == 60 and 20 <= y <= 54
                pixels.append(route_color if is_main_route_pixel or is_prominent_branch else background)

        image_path = Path(__file__).resolve().parent / f"prominent-branch-route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--route-hex-color",
                    "#FF0000",
                    "--append-prominent-branch",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        points = payload["points"]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        self.assertLessEqual(min(ys), 20, msg=f"prominent branch was not appended: {points[-20:]}")
        self.assertGreaterEqual(max(ys), 55)
        self.assertLessEqual(max(ys), 57)
        self.assertLessEqual(min(xs), 3)
        self.assertGreaterEqual(max(xs), 120)

    def test_cli_excludes_branding_region_and_prefers_broad_saturated_route(self) -> None:
        width = 130
        height = 90
        route_color = (120, 200, 40)
        label_color = (229, 57, 53)
        background = (245, 245, 245)

        pixels: list[tuple[int, int, int]] = []
        for y in range(height):
            for x in range(width):
                is_main_route = 15 <= x <= 115 and y == 45 + ((x - 15) // 8 % 9) - 4
                is_small_precise_label = y == 12 and 10 <= x <= 34
                is_bottom_branding = y == 84 and 0 <= x < width
                if is_main_route:
                    pixels.append(route_color)
                elif is_small_precise_label or is_bottom_branding:
                    pixels.append(label_color)
                else:
                    pixels.append(background)

        image_path = Path(__file__).resolve().parent / f"excluded-branding-route-fixture-{uuid.uuid4().hex}.ppm"
        try:
            _write_ppm(image_path, width, height, pixels)

            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_PATH),
                    "--image",
                    str(image_path),
                    "--exclude-region",
                    "0,0.90,1,1",
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            image_path.unlink(missing_ok=True)

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"CLI stderr was: {completed.stderr.strip()}",
        )

        payload = json.loads(completed.stdout)
        points = payload["points"]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        self.assertEqual(payload["routeSource"], "saturated")
        self.assertGreater(payload["pointCount"], 80)
        self.assertLess(min(xs), 25)
        self.assertGreater(max(xs), 105)
        self.assertLess(max(ys), 70, msg=f"excluded bottom branding leaked into path: {points[-20:]}")


if __name__ == "__main__":
    unittest.main()
