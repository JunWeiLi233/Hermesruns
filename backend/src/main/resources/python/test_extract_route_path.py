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
        self.assertEqual(
            sorted(payload.keys()),
            ["maskPixelCount", "pointCount", "points", "skeletonPixelCount"],
        )
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
        ys = [point[1] for point in points]
        self.assertGreater(payload["pointCount"], 18)
        self.assertEqual(min(xs), 2)
        self.assertEqual(max(xs), 25)
        self.assertTrue(all(y >= 6 for y in ys), msg=f"unexpected distant fragment leak: {points[:20]}")


if __name__ == "__main__":
    unittest.main()
