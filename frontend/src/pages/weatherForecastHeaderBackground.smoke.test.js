import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const weatherSource = readFileSync(path.join(here, 'WeatherEngine.jsx'), 'utf8');
const weatherBaseStyleSource = readFileSync(path.join(here, '../styles/_split/weather.css'), 'utf8');
const liquidGlassStyleSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

assert.match(
  weatherSource,
  /className="weather-engine-forecast-panel"[\s\S]*className="weather-engine-panel-head"[\s\S]*className="weather-engine-forecast-strip"/,
  'Weather should keep the forecast header separate from the hourly forecast strip.',
);

assert.match(
  weatherBaseStyleSource,
  /\.weather-engine-forecast-panel\s*\{[\s\S]*?background:\s*rgba\(24, 27, 28, 0\.72\);/,
  'The forecast panel should retain its original surface behind the compact header.',
);

assert.match(
  liquidGlassStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-shell-page\.weather-engine-page \.weather-engine-forecast-panel\s*\{[\s\S]*?border:\s*1px solid var\(--runner-profile-line\) !important;[\s\S]*?background:\s*#fff !important;[\s\S]*?box-shadow:\s*var\(--runner-profile-shadow\) !important;/,
  'The light forecast panel should use a solid white profile-aligned surface.',
);

assert.match(
  liquidGlassStyleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.runner-shell-page\.weather-engine-page \.weather-engine-forecast-strip\s*\{[\s\S]*?background:\s*#fff !important;[\s\S]*?background-image:\s*none !important;/,
  'The light hourly forecast row should use the same solid white surface as its panel.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.weather-engine-page \.weather-engine-panel-head > div\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
  'The forecast title wrapper should not render as a nested glass strip.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.weather-engine-page \.weather-engine-forecast-panel :is\(\s*\.weather-engine-panel-head,\s*\.weather-engine-card-kicker\s*\)\s*\{[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
  'Forecast header text should not render on nested panel or card background strips.',
);

console.log('[PASS] Weather forecast strip background guardrails passed.');
