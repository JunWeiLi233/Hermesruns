import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function luminance(hex) {
  const expanded = hex.length === 4 ? `#${[...hex.slice(1)].map(value => value + value).join('')}` : hex;
  const channels = expanded.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

for (const [file, prefix] of [['comparison', 'cmp'], ['sport-totals', 'st'], ['periods', 'period'], ['authoring', 'wa']]) {
  const css = readFileSync(new URL(`./${file}.css`, import.meta.url), 'utf8');
  const palettes = [...css.matchAll(new RegExp(`--${prefix}-faint:\\s*(#[a-f\\d]{3,6});\\s*--${prefix}-surface:\\s*(#[a-f\\d]{3,6});`, 'gi'))];
  assert.equal(palettes.length, 2, `${file} must expose light and dark text/surface palettes.`);
  for (const [, text, surface] of palettes) {
    const values = [luminance(text), luminance(surface)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${file} small explanatory text and placeholders must meet WCAG AA contrast.`);
  }
}

// Hollow history points need their ring to remain visible on the owning surface.
const vo2 = readFileSync(new URL('../../../styles/vo2max-estimates-v2.css', import.meta.url), 'utf8');
const compact = readFileSync(new URL('../../../styles/analysis-redesign-v3.css', import.meta.url), 'utf8');
const rings = [...vo2.matchAll(/--ve-other:\s*(#[a-f\d]{6});/gi)].map(match => match[1]);
assert.equal(rings.length, 2, 'VO2 history exposes light and dark ring colours.');
for (const [index, ring] of rings.entries()) {
  const values = [luminance(ring), luminance(index === 0 ? '#ffffff' : '#242a34')].sort((a, b) => b - a);
  assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 3, 'Hollow VO2 history rings must meet graphical AA contrast.');
}
assert.doesNotMatch(compact, /--ve-other:\s*var\(--a2-chart-history\)/, 'Compact history must retain the accessible ring palette instead of its faint decorative line colour.');
