"""Encode responsive delivery candidates; original WebP sources stay intact.

Requires Pillow. Run from any directory with `python optimize-landing-images.py`.
Center crops match the page's existing object-fit: cover positioning.
"""
from pathlib import Path
import json
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/assets/landing-v3'
OUT = ROOT / 'src/assets/landing-v3-responsive'
OUT.mkdir(parents=True, exist_ok=True)
records = []

def encode(name, suffix, width, ratio=None):
    source = Image.open(SOURCE / f'{name}.webp').convert('RGB')
    height = round(width / ratio) if ratio else round(width * source.height / source.width)
    if ratio:
        image = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS)
    else:
        image = source.resize((width, height), Image.Resampling.LANCZOS)
    target = OUT / f'{name}-{suffix}-{width}.webp'
    image.save(target, 'WEBP', quality=72, method=6)
    records.append({'file': target.name, 'width': width, 'height': height, 'bytes': target.stat().st_size})

for name in ['goal-5k', 'goal-10k', 'goal-half', 'goal-marathon', 'goal-ultra']:
    for width in [320, 480, 576]:
        encode(name, 'card', width, 4 / 5)
for name in ['feature-adapt', 'feature-coach', 'feature-race']:
    for width in [480, 768, 960]:
        encode(name, 'cover', width, 4 / 5)
for width in [480, 768]:
    encode('cta-crowd', 'mobile', width, 5 / 7)
for width in [1280, 1920]:
    encode('cta-crowd', 'wide', width)

print(json.dumps({'encoder': 'Pillow WebP quality=72 method=6', 'candidates': records}, indent=2))
