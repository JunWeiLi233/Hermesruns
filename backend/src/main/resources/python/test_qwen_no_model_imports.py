import subprocess
import sys
from pathlib import Path


def test_helpers_and_request_validation_work_without_inference_dependencies():
    module_directory = str(Path(__file__).resolve().parent)
    script = f"""
import builtins
import sys
sys.path.insert(0, {module_directory!r})
original_import = builtins.__import__
def without_inference(name, *args, **kwargs):
    if name.split('.')[0] in {{'torch', 'transformers', 'qwen_vl_utils'}}:
        raise ImportError('Inference dependency requested: ' + name)
    return original_import(name, *args, **kwargs)
builtins.__import__ = without_inference
import qwen_course_map_worker as worker
import extract_anchor_pixels_qwen
import extract_route_parameters_qwen
import analyze_course_map_alignment_qwen
assert worker.extract_json_object('{{"isCourseMap":false}}') == {{'isCourseMap': False}}
assert worker.build_image_content('map.png')['image'] == 'map.png'
try:
    worker.handle_request({{'operation': 'unsupported'}})
except ValueError as error:
    assert 'Unsupported' in str(error)
else:
    raise AssertionError('Unknown operation was accepted')
try:
    worker._load_bundle('unused-model', 'cpu', None)
except ImportError as error:
    assert 'Inference dependency requested' in str(error)
else:
    raise AssertionError('Inference must still require its dependencies')
"""
    result = subprocess.run([sys.executable, "-I", "-c", script], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
