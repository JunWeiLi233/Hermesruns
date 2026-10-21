import json

from PIL import Image

import extract_anchor_pixels_qwen as extractor


LABELS = ['Start', 'Asakusa', 'Ginza', 'Finish']


def payload(points):
    return {'anchors': [dict(label=label, x=x, y=y) for label, (x, y) in zip(LABELS, points)]}


def args_for(tmp_path):
    image = tmp_path / 'official-map.png'
    Image.new('RGB', (1000, 1000), 'white').save(image)
    args = ['--image', str(image), '--model-id', 'test-model']
    for label in LABELS:
        args += ['--anchor', label]
    return args


def test_retries_collinear_example_coordinates_before_returning_anchors(tmp_path, monkeypatch, capsys):
    answers = iter([
        payload([(123, 456), (234, 567), (345, 678), (456, 789)]),
        payload([(100, 200), (800, 200), (700, 700), (400, 500)]),
    ])
    prompts = []

    def invoke(**kwargs):
        prompts.append(kwargs['prompt'])
        return next(answers)

    monkeypatch.setattr(extractor, 'invoke_qwen_json', invoke)
    assert extractor.main(args_for(tmp_path)) == 0
    result = json.loads(capsys.readouterr().out)
    assert result['anchors'][0] == {'label': 'Start', 'x': 100, 'y': 200}
    assert len(prompts) == 2


def test_does_not_emit_unusable_anchors_when_retry_remains_collinear(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(extractor, 'invoke_qwen_json', lambda **kwargs: payload([(100, 100), (200, 200), (300, 300), (400, 400)]))
    assert extractor.main(args_for(tmp_path)) == 1
    captured = capsys.readouterr()
    assert not captured.out
    assert 'non-collinear' in captured.err


def test_rejects_coordinates_outside_the_original_image(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(extractor, 'invoke_qwen_json', lambda **kwargs: payload([(100, 200), (1500, 200), (700, 700), (400, 500)]))
    assert extractor.main(args_for(tmp_path)) == 1
    assert 'bounds' in capsys.readouterr().err
