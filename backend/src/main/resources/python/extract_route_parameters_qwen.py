import argparse
import json
import sys

from qwen_course_map_worker import invoke_qwen_json


PROMPT_TEMPLATE = """
Analyze this road-race course map for the target event.
Race context:
- raceName: {race_name}
- city: {city}
- country: {country}
- targetDistanceKm: {distance_km}
Ignore sponsor logos, elevation charts, and decorative text unless that text is needed to identify where the target race route passes.
If the map shows multiple courses, choose the official route that best matches the target event and targetDistanceKm.
Ignore shorter side events, companion races, relay/community variants, or alternate promotional routes that do not match the target race.
Identify the main race route line and return only a JSON object with this exact shape:
{{
  "routeHexColor": "#RRGGBB",
  "anchorPoints": ["Start", "Major landmark one", "Major landmark two", "Finish"]
}}
Requirements:
- routeHexColor must be the dominant hex color of the main race route line in #RRGGBB form.
- anchorPoints must contain exactly 4 major, geographically distant intersections, street names, or landmarks that the route explicitly passes through.
- Include the Start and Finish within anchorPoints.
- Preserve route order from start to finish.
- Return only valid JSON with no markdown or commentary.
""".strip()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Extract route parameters from a course-map image with Qwen.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--race-name", default="unknown")
    parser.add_argument("--city", default="unknown")
    parser.add_argument("--country", default="unknown")
    parser.add_argument("--distance-km", default="unknown")
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--cache-dir", default="")
    return parser.parse_args(argv)


def main(argv=None):
    try:
        args = parse_args(argv)
        payload = invoke_qwen_json(
            image_path=args.image,
            prompt=PROMPT_TEMPLATE.format(
                race_name=args.race_name,
                city=args.city,
                country=args.country,
                distance_km=args.distance_km,
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
