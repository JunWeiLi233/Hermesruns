import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./recommendation-evidence.css', import.meta.url), 'utf8');
const palettes = [...css.matchAll(/([^{}]+)\{([^{}]*--evidence-ink:[^{}]+)\}/g)];
assert.equal(palettes.length, 2, 'Recommendation evidence has complete light and dark palettes.');
assert.match(palettes[1][1], /body:is\(\.theme-midnight, \.theme-high-contrast\) \.recommendation-evidence/, 'The palette follows the application midnight and high-contrast themes.');
assert.match(css, /background:\s*var\(--evidence-surface\)/, 'The evidence surface follows its text palette.');

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const [, selector, rules] of palettes) {
  const token = name => {
    const found = new RegExp(`--evidence-${name}:\\s*(#[a-f\\d]{6});`, 'i').exec(rules);
    assert.ok(found, `${selector.trim()} defines its ${name} colour.`);
    return luminance(found[1]);
  };
  const surface = token('surface');
  for (const name of ['ink', 'secondary', 'muted', 'warning']) {
    const [light, dark] = [token(name), surface].sort((a, b) => b - a);
    assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `Recommendation ${name} text meets AA contrast on its own surface.`);
  }
}
