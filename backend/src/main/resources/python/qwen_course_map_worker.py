import json
import os
import re
import sys
from contextlib import redirect_stdout
from functools import lru_cache
from pathlib import Path

DEFAULT_IMAGE_MAX_PIXELS = 1024 * 1024


def _normalize_cache_dir(cache_dir: str | None) -> str | None:
    if cache_dir is None:
        return None
    trimmed = cache_dir.strip()
    return trimmed or None


@lru_cache(maxsize=2)
def _load_bundle(model_id: str, device_map: str, cache_dir: str | None):
    # Protocol parsing and validation also run in installations without the inference stack.
    import torch
    from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

    kwargs = {
        "torch_dtype": torch.bfloat16,
        "device_map": device_map,
    }
    normalized_cache_dir = _normalize_cache_dir(cache_dir)
    if normalized_cache_dir is not None:
        kwargs["cache_dir"] = normalized_cache_dir

    model = Qwen2_5_VLForConditionalGeneration.from_pretrained(model_id, **kwargs)
    model.eval()
    processor = AutoProcessor.from_pretrained(model_id, cache_dir=normalized_cache_dir)
    return model, processor


def _resolve_image_max_pixels() -> int:
    raw_value = os.environ.get("HERMES_QWEN_IMAGE_MAX_PIXELS", "").strip()
    if not raw_value:
        return DEFAULT_IMAGE_MAX_PIXELS
    try:
        parsed = int(raw_value)
    except ValueError:
        return DEFAULT_IMAGE_MAX_PIXELS
    return parsed if parsed > 0 else DEFAULT_IMAGE_MAX_PIXELS


def build_image_content(image_path: str) -> dict:
    return {
        "type": "image",
        "image": image_path,
        "max_pixels": _resolve_image_max_pixels(),
    }


def _response_text(model, processor, image_path: Path, prompt: str, max_new_tokens: int) -> str:
    import torch
    from qwen_vl_utils import process_vision_info

    messages = [
        {
            "role": "user",
            "content": [
                build_image_content(str(image_path.resolve())),
                {"type": "text", "text": prompt},
            ],
        }
    ]

    chat_text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    image_inputs, video_inputs = process_vision_info(messages)
    inputs = processor(
        text=[chat_text],
        images=image_inputs,
        videos=video_inputs,
        padding=True,
        return_tensors="pt",
    )

    target_device = "cuda" if torch.cuda.is_available() else "cpu"
    inputs = inputs.to(target_device)

    with torch.inference_mode():
        generated_ids = model.generate(**inputs, max_new_tokens=max_new_tokens)
    trimmed_ids = [
        output_ids[len(input_ids):]
        for input_ids, output_ids in zip(inputs.input_ids, generated_ids)
    ]
    decoded = processor.batch_decode(
        trimmed_ids,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )
    if not decoded:
        raise RuntimeError("Qwen returned no decoded output.")
    return decoded[0]


def invoke_qwen_json(
        image_path: str,
        prompt: str,
        model_id: str,
        device_map: str,
        cache_dir: str | None,
        max_new_tokens: int,
):
    path = Path(image_path)
    if not path.is_file():
        raise RuntimeError(f"Route image file does not exist: {image_path}")
    model, processor = _load_bundle(model_id, device_map, _normalize_cache_dir(cache_dir))
    raw_text = _response_text(model, processor, path, prompt, max_new_tokens=max_new_tokens)
    return extract_json_object(raw_text)


def extract_json_object(raw_text: str):
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start < 0 or end <= start:
        recovered = recover_course_map_payload(raw_text)
        if recovered is not None:
            return recovered
        raise RuntimeError("Qwen response did not include a JSON object.")
    try:
        return json.loads(raw_text[start:end + 1])
    except json.JSONDecodeError as exc:
        recovered = recover_course_map_payload(raw_text)
        if recovered is not None:
            return recovered
        raise RuntimeError("Failed to parse Qwen JSON response.") from exc


def recover_course_map_payload(raw_text: str):
    text = raw_text or ""
    if "\"isCourseMap\"" not in text or "\"routePoints\"" not in text:
        return None

    bool_match = re.search(r'"isCourseMap"\s*:\s*(true|false)', text, flags=re.IGNORECASE)
    confidence_match = re.search(r'"confidence"\s*:\s*(-?\d+(?:\.\d+)?)', text)
    summary_match = re.search(r'"summary"\s*:\s*"([^"]*)"', text)
    north_match = re.search(r'"north"\s*:\s*(-?\d+(?:\.\d+)?)', text)
    south_match = re.search(r'"south"\s*:\s*(-?\d+(?:\.\d+)?)', text)
    east_match = re.search(r'"east"\s*:\s*(-?\d+(?:\.\d+)?)', text)
    west_match = re.search(r'"west"\s*:\s*(-?\d+(?:\.\d+)?)', text)
    start_label_match = re.search(r'"startLabel"\s*:\s*"([^"]*)"', text)
    finish_label_match = re.search(r'"finishLabel"\s*:\s*"([^"]*)"', text)

    if not bool_match or not confidence_match or not summary_match:
        return None

    point_matches = re.findall(
        r'\{\s*"lat"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"lng"\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*"label"\s*:\s*"([^"]*)")?\s*\}',
        text,
        flags=re.MULTILINE,
    )
    if not point_matches:
        return None

    payload = {
        "isCourseMap": bool_match.group(1).lower() == "true",
        "confidence": float(confidence_match.group(1)),
        "summary": summary_match.group(1),
        "routePoints": [
            {
                **{"lat": float(lat), "lng": float(lng)},
                **({"label": label} if label else {}),
            }
            for lat, lng, label in point_matches
        ],
    }

    if all(match is not None for match in (north_match, south_match, east_match, west_match)):
        payload["overlayBounds"] = {
            "north": float(north_match.group(1)),
            "south": float(south_match.group(1)),
            "east": float(east_match.group(1)),
            "west": float(west_match.group(1)),
        }
    else:
        payload["overlayBounds"] = None

    if start_label_match:
        payload["startLabel"] = start_label_match.group(1)
    if finish_label_match:
        payload["finishLabel"] = finish_label_match.group(1)

    return payload


def handle_request(request):
    operation = request.get('operation')
    if operation not in ('alignment', 'route_parameters', 'anchor_pixels'):
        raise ValueError(f'Unsupported Qwen operation: {operation}')
    image_path = request['imagePath']
    labels = None
    if operation == 'alignment':
        prompt = request['prompt']
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError('Alignment prompt is required.')
    elif operation == 'route_parameters':
        from extract_route_parameters_qwen import PROMPT_TEMPLATE
        prompt = PROMPT_TEMPLATE.format(
            race_name=request.get('raceName', 'unknown'), city=request.get('city', 'unknown'),
            country=request.get('country', 'unknown'), distance_km=request.get('distanceKm', 'unknown'))
    else:
        from PIL import Image
        from extract_anchor_pixels_qwen import PROMPT_TEMPLATE, validate_anchor_pixels
        labels = request.get('anchors', [])
        if not 4 <= len(labels) <= 10:
            raise ValueError('Between 4 and 10 anchors are required.')
        with Image.open(image_path) as image:
            width, height = image.size
        prompt = PROMPT_TEMPLATE.format(width=width, height=height, count=len(labels), labels=json.dumps(labels))
    budget = int(request.get('maxNewTokens', 2048))
    if not 1 <= budget <= 8192:
        raise ValueError('Qwen output budget must be between 1 and 8192 tokens.')
    if labels is not None:
        budget = max(budget, 64 * len(labels) + 64)
    for attempt in range(2 if labels is not None else 1):
        payload = invoke_qwen_json(
            image_path=image_path, prompt=prompt, model_id=request['modelId'],
            device_map=request.get('deviceMap', 'auto'), cache_dir=request.get('cacheDir', ''),
            max_new_tokens=budget)
        if labels is None:
            return payload
        try:
            validate_anchor_pixels(payload, labels, width, height)
            return payload
        except RuntimeError as error:
            if attempt:
                raise
            prompt += f'\nThe previous answer was unusable: {error} Reinspect the image and correct the coordinates.'


def serve_stdio(source=None, output=None):
    source = sys.stdin if source is None else source
    output = sys.stdout if output is None else output
    for line in source:
        try:
            # Libraries and model diagnostics must not enter the JSON-line protocol.
            with redirect_stdout(sys.stderr):
                request = json.loads(line)
                if not isinstance(request, dict):
                    raise ValueError('Qwen request must be an object.')
                payload = handle_request(request)
            response = {'ok': True, 'payload': payload}
        except Exception as error:
            response = {'ok': False, 'error': str(error)}
        output.write(json.dumps(response, separators=(',', ':')) + '\n')
        output.flush()


if __name__ == '__main__':
    if sys.argv[1:] != ['--stdio-worker']:
        raise SystemExit('Use --stdio-worker for the persistent JSON-line worker.')
    serve_stdio()
