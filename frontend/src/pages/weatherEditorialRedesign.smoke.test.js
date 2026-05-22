import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
const weatherSource = readFileSync(path.join(here, 'WeatherEngine.jsx'), 'utf8');
const navSource = readFileSync(path.join(here, '../utils/runnerShellNav.js'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  appSource,
  /path="\/weather"/,
  'App routes should expose the runner weather page at /weather.',
);

assert.match(
  appSource,
  /path="\/weather-engine"[\s\S]*Navigate to="\/weather"/,
  'Legacy /weather-engine traffic should redirect to /weather.',
);

assert.doesNotMatch(
  navSource,
  /route:\s*'\/weather-engine'/,
  'Shared runner shell nav should no longer point at /weather-engine.',
);

assert.match(
  navSource,
  /route:\s*'\/weather'/,
  'Shared runner shell nav should point at /weather.',
);

assert.match(
  weatherSource,
  /weather-engine-hero-shell/,
  'Weather page should render the new cinematic hero shell.',
);

assert.match(
  weatherSource,
  /weather-engine-forecast-panel/,
  'Weather page should render the horizontal forecast pipeline panel.',
);

assert.match(
  weatherSource,
  /weather-engine-card--judgment/,
  'Weather page should render the coach judgment companion card.',
);

assert.match(
  weatherSource,
  /function toFiniteNumber\(value\)/,
  'Weather page should normalize numeric API values before deciding whether live forecast can load.',
);

assert.match(
  weatherSource,
  /const latitude = toFiniteNumber\(weatherContext\?\.latitude\);[\s\S]*const longitude = toFiniteNumber\(weatherContext\?\.longitude\);/,
  'Weather page should accept numeric-string coordinates from the backend context response.',
);

assert.match(
  weatherSource,
  /WEATHER_PAGE_REQUEST_TIMEOUT_MS\s*=\s*6000/,
  'Weather page hydration should use a bounded timeout so backend stalls cannot leave the route loading forever.',
);

assert.match(
  weatherSource,
  /apiJson\('\/api\/profile\/me', \{ signal: controller\.signal \}\)[\s\S]*apiJson\('\/api\/v1\/weather\/context', \{ signal: controller\.signal \}\)/,
  'Weather page should attach the timeout abort signal to its initial profile and weather context requests.',
);

assert.match(
  weatherSource,
  /WEATHER_FORECAST_REQUEST_TIMEOUT_MS\s*=\s*6500/,
  'Weather page forecast fetch should use a bounded timeout so external Open-Meteo stalls fall back cleanly.',
);

assert.match(
  weatherSource,
  /const timeoutId = window\.setTimeout\(\(\) => controller\.abort\(\), WEATHER_FORECAST_REQUEST_TIMEOUT_MS\);[\s\S]*fetch\(url, \{ signal: controller\.signal \}\)[\s\S]*if \(!disposed\) \{[\s\S]*setForecastState\('error'\);/,
  'Weather page should turn forecast timeout failures into the existing fallback state instead of staying in loading.',
);

assert.doesNotMatch(
  weatherSource,
  /Number\.isFinite\(weatherContext\.latitude\)|Number\.isFinite\(weatherContext\.longitude\)/,
  'Weather page should not reject valid coordinate strings by checking raw context fields.',
);

assert.match(
  weatherSource,
  /typeof profile\?\.displayName === 'string'[\s\S]*typeof profile\?\.email === 'string'/,
  'Weather page should only call profile string helpers on string fields.',
);

assert.match(
  styleSource,
  /\.weather-engine-hero-shell\s*\{/,
  'Styles should define the cinematic weather hero shell.',
);

assert.match(
  styleSource,
  /\.weather-engine-forecast-panel\s*\{/,
  'Styles should define the forecast pipeline panel.',
);

assert.match(
  styleSource,
  /\.weather-engine-card--judgment\s*\{/,
  'Styles should define the coach judgment card.',
);

assert.match(
  styleSource,
  /\.weather-engine-hud-head\s*\{[\s\S]*color:\s*rgba\(232,\s*226,\s*220,\s*0\.82\);/m,
  'Dark mode should give the Weather HUD headings a darker, clearer label color.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.weather-engine-hud-head\s*\{[\s\S]*color:\s*rgba\(89,\s*92,\s*93,\s*0\.92\);/m,
  'Light mode should also darken the Weather HUD headings for better readability.',
);

console.log('[PASS] Weather editorial redesign guardrails passed.');
