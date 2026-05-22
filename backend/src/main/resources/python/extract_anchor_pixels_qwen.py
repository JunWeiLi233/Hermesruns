import argparse
import json
import sys

from qwen_course_map_worker import invoke_qwen_json


PROMPT_TEMPLATE = """
Inspect this marathon course-map image and return only a JSON object with exactly this structure:
{{
  "anchors": [
    {{"label": "{anchor_1}", "x": 123, "y": 456}},
    {{"label": "{anchor_2}", "x": 234, "y": 567}},
    {{"label": "{anchor_3}", "x": 345, "y": 678}},
    {{"label": "{anchor_4}", "x": 456, "y": 789}}
  ]
}}
Requirements:
- Use these 4 anchor labels exactly and preserve their order:
  1. {anchor_1}
  2. {anchor_2}
  3. {anchor_3}
  4. {anchor_4}
- anchors must contain exactly 4 objects.
- Each object must include a non-blank label plus integer x and integer y pixel coordinates.
- Keep labels identical to the provided anchor labels.
- Return only valid JSON with no markdown or commentary.
""".strip()


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
        if len(anchors) != 4:
            raise RuntimeError("Exactly 4 anchors are required.")
        payload = invoke_qwen_json(
            image_path=args.image,
            prompt=PROMPT_TEMPLATE.format(
                anchor_1=anchors[0],
                anchor_2=anchors[1],
                anchor_3=anchors[2],
                anchor_4=anchors[3],
            ),
            model_id=args.model_id,
            device_map=args.device_map,
            cache_dir=args.cache_dir,
            max_new_tokens=256,
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(payload, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
