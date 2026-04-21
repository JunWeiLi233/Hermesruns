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
