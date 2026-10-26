from qwen_course_map_worker import build_image_content, extract_json_object
import io
import json
import qwen_course_map_worker as worker


def test_stdio_worker_serves_multiple_requests_and_recovers_after_bad_request(monkeypatch):
    calls = []
    def invoke(**kwargs):
        calls.append(kwargs)
        print('model diagnostic must not corrupt protocol')
        return {'isCourseMap': True, 'routePoints': []}
    monkeypatch.setattr(worker, 'invoke_qwen_json', invoke)
    request = {'operation': 'alignment', 'imagePath': 'map.jpg', 'prompt': 'trace',
               'modelId': 'test-model', 'maxNewTokens': 2048}
    source = io.StringIO(json.dumps(request) + '\ninvalid json\n' + json.dumps(request) + '\n')
    output = io.StringIO()
    worker.serve_stdio(source, output)
    responses = [json.loads(line) for line in output.getvalue().splitlines()]
    assert [response['ok'] for response in responses] == [True, False, True]
    assert responses[0]['payload']['isCourseMap'] is True
    assert len(calls) == 2
    assert calls[0]['max_new_tokens'] == 2048


def test_stdio_worker_rejects_unknown_operations_before_loading_model(monkeypatch):
    def unexpected(**kwargs):
        raise AssertionError('No model should be loaded')
    monkeypatch.setattr(worker, 'invoke_qwen_json', unexpected)
    output = io.StringIO()
    worker.serve_stdio(io.StringIO('{"operation":"delete"}\n'), output)
    response = json.loads(output.getvalue())
    assert response['ok'] is False
    assert 'Unsupported' in response['error']


def test_build_image_content_caps_qwen_pixels_by_default():
    content = build_image_content("course-map.webp")

    assert content["image"] == "course-map.webp"
    assert content["max_pixels"] <= 1024 * 1024


def test_extract_json_object_recovers_truncated_course_map_payload():
    raw = """```json
{
  "isCourseMap": true,
  "confidence": 90,
  "summary": "Official Boston Marathon course map showing the route from Hopkinton to Boston.",
  "overlayBounds": {
    "north": 42.360100,
    "south": 42.359800,
    "east": -71.058900,
    "west": -71.059100
  },
  "routePoints": [
    {"lat": 42.360100, "lng": -71.058900, "label": "Hopkinton"},
    {"lat": 42.360000, "lng": -71.058900, "label": "Hopkinton"},
    {"lat": 42.359900, "lng": -71.058900, "label": "Hopkinton"},
    {"lat": 42.359800, "lng": -71.058900, "label": "
"""

    payload = extract_json_object(raw)

    assert payload["isCourseMap"] is True
    assert payload["confidence"] == 90
    assert payload["summary"].startswith("Official Boston Marathon course map")
    assert payload["overlayBounds"]["north"] == 42.3601
    assert len(payload["routePoints"]) == 3
    assert payload["routePoints"][0]["label"] == "Hopkinton"
