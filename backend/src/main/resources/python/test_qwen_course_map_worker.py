from qwen_course_map_worker import build_image_content, extract_json_object


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
