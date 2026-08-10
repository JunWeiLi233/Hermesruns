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

assert.doesNotMatch(
  liquidGlassStyleSource,
  /\.runner-shell-page\.weather-engine-page \.weather-engine-(?:forecast-panel|panel-head)\s*\{[\s\S]*background:\s*transparent !important;/,
  'The page-level cascade should not flatten the restored forecast surface.',
);

console.log('[PASS] Weather forecast strip background guardrails passed.');
