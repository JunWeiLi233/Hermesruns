import argparse
import json
import sys

from PIL import Image

from qwen_course_map_worker import invoke_qwen_json


PROMPT_TEMPLATE = """
Locate the requested landmarks on this marathon course-map image.
The ORIGINAL image is {width} pixels wide and {height} pixels high.
Return only a JSON object with an "anchors" array containing {count} objects.
Each object must have exactly these fields: "label" (string), "x" (integer pixel column), "y" (integer pixel row).
Use these labels exactly, in this order: {labels}
Measure each landmark's actual location on the image. Locate its route marker or geographic position, not an arbitrary point or the middle of the image.
The origin is the top-left corner. x increases rightward and must be at least zero and less than {width}. y increases downward and must be at least zero and less than {height}.
Use ORIGINAL image pixel coordinates, not percentages or coordinates for a resized image.
Do not invent positions or reuse example coordinates. Return only valid JSON with no markdown or commentary.
""".strip()


def validate_anchor_pixels(payload, labels, width, height):
    anchors = payload.get('anchors') if isinstance(payload, dict) else None
    if not isinstance(anchors, list) or len(anchors) != len(labels):
        raise RuntimeError('Return exactly one anchor for each requested landmark.')
    points = []
    for anchor, label in zip(anchors, labels):
        if not isinstance(anchor, dict) or anchor.get('label') != label:
            raise RuntimeError('Preserve every requested landmark label and its order.')
        x, y = anchor.get('x'), anchor.get('y')
        if type(x) is not int or type(y) is not int:
            raise RuntimeError('Landmark pixel coordinates must be integers.')
        if not (0 <= x < width and 0 <= y < height):
            raise RuntimeError('Landmark coordinates must remain inside the original image bounds.')
        points.append((x, y))
    x0, y0 = points[0]
    area = max(abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0))
               for x1, y1 in points[1:] for x2, y2 in points[1:])
    if area <= 1:
        raise RuntimeError('Locate at least three non-collinear landmark positions on the actual image.')


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Extract anchor pixel coordinates from a course-map image with Qwen.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--anchor", action="append", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--cache-dir", default="")
    return parser.parse_args(argv)


def main(argv=None):
    try:
        args = parse_args(argv)
        anchors = args.anchor or []
        if not 4 <= len(anchors) <= 10:
            raise RuntimeError("Between 4 and 10 anchors are required.")
        with Image.open(args.image) as image:
            width, height = image.size
        prompt = PROMPT_TEMPLATE.format(
            width=width, height=height, count=len(anchors), labels=json.dumps(anchors)
        )
        for attempt in range(2):
            payload = invoke_qwen_json(
                image_path=args.image,
                prompt=prompt,
                model_id=args.model_id,
                device_map=args.device_map,
                cache_dir=args.cache_dir,
                max_new_tokens=64 * len(anchors) + 64,
            )
            try:
                validate_anchor_pixels(payload, anchors, width, height)
                break
            except RuntimeError as error:
                if attempt:
                    raise
                prompt += f'\nThe previous answer was unusable: {error} Reinspect the image and correct the coordinates.'
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(payload, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
