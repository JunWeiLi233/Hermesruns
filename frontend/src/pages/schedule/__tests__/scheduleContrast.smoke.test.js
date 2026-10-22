import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, "../../..");
const scheduleStyles = readFileSync(path.join(root, 'styles', 'style.generated.css'), 'utf8');
const calendarStyles = readFileSync(path.join(root, 'styles', 'schedule-v2.css'), 'utf8');

const luminance = hex => {
  const channels = hex.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const palettes = [...calendarStyles.matchAll(/--sc-faint:\s*(#[a-f\d]{6});[\s\S]*?--sc-fill:\s*(#[a-f\d]{6});/gi)];
assert.equal(palettes.length, 2, 'Validate both the light and dark calendar palettes.');
for (const palette of palettes) {
  const values = [luminance(palette[1]), luminance(palette[2])].sort((a, b) => b - a);
  assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, 'Small calendar tags must meet WCAG AA contrast on filled day cards.');
}

assert.match(
  scheduleStyles,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.runner-shell-page\.schedule-plan-page\.runner-dashboard-page\s+\.runner-shell-canvas\.schedule-plan-canvas\s+:is\(\.schedule-plan-hero\.schedule-plan-hero,\s*\.schedule-plan-next-card\.schedule-plan-next-card\)\s+:is\(h1,\s*h2,\s*h3,\s*h4,\s*strong,\s*label\)\s*\{[\s\S]*?color:\s*var\(--runner-minimal-ink,\s*var\(--text-strong\)\)\s*!important;/,
  'Schedule light-mode hero and next-session headings should keep dark readable text.',
);

assert.match(
  scheduleStyles,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.runner-shell-page\.schedule-plan-page\.runner-dashboard-page\s+\.runner-shell-canvas\.schedule-plan-canvas\s+:is\(\.schedule-plan-hero\.schedule-plan-hero,\s*\.schedule-plan-next-card\.schedule-plan-next-card\)\s+:is\(\.schedule-plan-kicker,\s*\.schedule-plan-hero-metrics span,\s*\.schedule-plan-hero-summary-chip span,\s*\.schedule-plan-next-content > span\)\s*\{[\s\S]*?color:\s*var\(--runner-minimal-muted,\s*rgba\(57,\s*67,\s*82,\s*0\.82\)\)\s*!important;/,
  'Schedule light-mode hero labels should keep readable muted text.',
);

console.log('[PASS] Schedule contrast smoke test passed.');
