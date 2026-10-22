import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../../styles/training-log-v2.css', import.meta.url), 'utf8');
const block = (selector) => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Missing training log rule: ${selector}`);
  return css.slice(start, css.indexOf('}', start) + 1);
};
const token = (palette, name) => {
  const value = palette.match(new RegExp(`--tl-${name}:\\s*(#[a-f\\d]{3,6});`, 'i'))?.[1];
  assert.ok(value, `Missing training log colour: ${name}`);
  return value;
};
const rgb = (hex) => {
  const expanded = hex.length === 4 ? [...hex.slice(1)].map((digit) => digit + digit).join('') : hex.slice(1);
  return expanded.match(/../g).map((channel) => parseInt(channel, 16));
};
const mix = (front, back, alpha) => front.map((channel, index) => channel * alpha + back[index] * (1 - alpha));
const luminance = (colour) => {
  const channels = colour.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (front, back) => {
  const [high, low] = [luminance(front), luminance(back)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
};
const atLeastAA = (front, back, label) => assert.ok(contrast(front, back) >= 4.5, `${label}: ${contrast(front, back).toFixed(2)}:1 must meet 4.5:1.`);

// Runs' shell has an !important colour for every span/small. Embedded chips must
// keep their own selected/unselected foreground, including the nested tag name.
const count = block('#root .training-log-v2__chips small');
assert.match(count, /color:\s*inherit\s*!important/);
assert.match(block('#root .training-log-v2__chip-text'), /color:\s*inherit\s*!important/);
assert.match(block('#root .training-log-v2__type.is-race'), /color:\s*var\(--tl-on-accent\)\s*!important/);
const countOpacity = Number(count.match(/opacity:\s*([\d.]+)/)?.[1] ?? 1);

for (const [theme, selector, card] of [
  ['light', '#root .training-log-v2', '#fff'],
  ['midnight', 'body:is(.theme-midnight, .theme-high-contrast) #root .training-log-v2', '#242a34'],
]) {
  const palette = block(selector);
  const ink = rgb(token(palette, 'ink'));
  const accent = rgb(token(palette, 'accent'));
  const onAccent = rgb(token(palette, 'on-accent'));
  const fill = palette.match(/--tl-fill:\s*rgba\(([^)]+)\)/)?.[1].split(',').map(Number);
  assert.equal(fill?.length, 4, 'Filter fill must expose its composited RGBA colour.');
  const surface = mix(fill.slice(0, 3), rgb(card), fill[3]);
  atLeastAA(mix(ink, surface, countOpacity), surface, `${theme} unselected tag count`);
  atLeastAA(mix(onAccent, accent, countOpacity), accent, `${theme} selected tag count`);
  atLeastAA(onAccent, accent, `${theme} race chip and selected tag text`);

  // Filtering keeps the previous content and usable controls on screen. Its
  // busy state must not fade their text below AA while the next page arrives.
  for (const section of ['filters', 'view', 'weeks']) {
    const busy = block(`#root .training-log-v2__${section}[aria-busy="true"]`);
    const opacity = Number(busy.match(/opacity:\s*([\d.]+)/)?.[1] ?? 1);
    for (const text of ['muted', 'faint', 'accent']) {
      atLeastAA(mix(rgb(token(palette, text)), rgb(card), opacity), rgb(card), `${theme} busy ${section} ${text} text`);
    }
  }
}

console.log('[PASS] Training log chip/count foreground pairs meet AA in light and midnight.');
