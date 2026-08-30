import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const gridCardsWhiteSource = readFileSync(path.join(here, '../styles/grid-cards-white.css'), 'utf8');
const lightThemeSource = readFileSync(path.join(here, '../styles/_split/light-theme-overrides.css'), 'utf8');

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-stat-card,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-coach-card,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-course-card,[^{]*\{\s*background:\s*#fff;/,
  'Race detail stat and outer card surfaces should use a pure white light-theme background.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-stat-card\.is-accent,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-coach-card\s*\{\s*background:\s*#fff;/,
  'Race detail accent stat and coach cards should use the same pure white light-theme background.',
);

assert.match(
  gridCardsWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.race-detail-page \.race-detail-count-card\s*\{\s*background:\s*#fff !important;\s*background-image:\s*none !important;/,
  'Race detail countdown tiles should use a pure white light-theme background.',
);

assert.match(
  gridCardsWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.race-detail-page \.race-detail-elevation-chart\s*\{\s*background:\s*#fff !important;\s*(?:background-color:\s*#fff !important;\s*)?background-image:\s*none !important;/,
  'Race detail elevation chart grid should use a pure white light-theme background.',
);

assert.match(
  lightThemeSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-elevation-chart\s*\{[\s\S]*?background:\s*#fff !important;[\s\S]*?background-color:\s*#fff !important;[\s\S]*?background-image:\s*none !important;/,
  'The active light-theme elevation chart placeholder should use a solid white background.',
);

assert.match(
  gridCardsWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.race-detail-page \.race-detail-course-card\s*\{\s*background:\s*#fff !important;\s*background-image:\s*none !important;/,
  'Race detail course grid container should use a pure white light-theme background.',
);

assert.match(
  gridCardsWhiteSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) #root \.race-detail-page :is\(\.race-detail-stat-card, \.race-detail-coach-card\)\s*\{\s*background:\s*#fff !important;\s*background-image:\s*none !important;/,
  'Race detail stat and coach cards should use pure white light-theme backgrounds.',
);

assert.match(
  lightThemeSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-stat-card,\s*body:is\(\.theme-light, \.theme-high-contrast-light\) \.race-detail-coach-card\s*\{\s*background:\s*#fff !important;\s*background-image:\s*none !important;/,
  'The active race-detail theme cascade should force the three command cards to solid white.',
);

console.log('[PASS] Race detail white-card surface guardrails passed.');
