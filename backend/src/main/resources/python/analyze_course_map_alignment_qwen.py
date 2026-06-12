import argparse
import json
import sys
from pathlib import Path

from qwen_course_map_worker import invoke_qwen_json


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Analyze a course-map alignment with Qwen.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--prompt-file", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--device-map", default="auto")
    parser.add_argument("--cache-dir", default="")
    return parser.parse_args(argv)


def main(argv=None):
    try:
        args = parse_args(argv)
        prompt = Path(args.prompt_file).read_text(encoding="utf-8")
        payload = invoke_qwen_json(
            image_path=args.image,
            prompt=prompt,
            model_id=args.model_id,
            device_map=args.device_map,
            cache_dir=args.cache_dir,
            max_new_tokens=1024,
        )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(payload, separators=(",", ":")))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    import os

    exit_code = main()
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(exit_code)
