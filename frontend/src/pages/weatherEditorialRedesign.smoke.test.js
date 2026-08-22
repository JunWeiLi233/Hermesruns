import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
const weatherSource = readFileSync(path.join(here, 'WeatherEngine.jsx'), 'utf8');
const weatherLocationSource = readFileSync(path.join(here, '../utils/weatherLocation.js'), 'utf8');
const navSource = readFileSync(path.join(here, '../utils/runnerShellNav.js'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const weatherSplitStyleSource = readFileSync(path.join(here, '../styles/_split/weather.css'), 'utf8');
const liquidGlassSource = readFileSync(path.join(here, '../styles/all-pages-liquid-glass.css'), 'utf8');

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

assert.doesNotMatch(
  weatherSource,
  /<span className="weather-engine-card-kicker">\{wt\('heat_engine_title'\)\}<\/span>/,
  'Weather heat-adaptation card should not render the removed kicker badge.',
);

assert.doesNotMatch(
  weatherSource,
  /<span className="weather-engine-card-kicker">\{wt\('coach_title'\)\}<\/span>/,
  'Weather coach judgment card should not render the removed kicker badge.',
);

assert.match(
  weatherSource,
  /weather-engine-card--judgment[\s\S]*<h2>\{wt\('coach_title'\)\}<\/h2>/,
  'Removing the coach judgment kicker must preserve the card title and functionality.',
);

assert.match(
  weatherSource,
  /weather-engine-card--engine[\s\S]*<h2>\{wt\('heat_engine_title'\)\}<\/h2>/,
  'Removing the kicker badge must preserve the heat-adaptation card title and functionality.',
);

assert.match(
  weatherLocationSource,
  /export function toFiniteNumber\(value\)/,
  'Weather page should normalize numeric API values before deciding whether live forecast can load.',
);

assert.match(
  weatherLocationSource,
  /if \(value === null \|\| value === undefined \|\| \(typeof value === 'string' && value\.trim\(\) === ''\)\) \{\s*return null;/,
  'Weather page should keep null and blank provider values unavailable instead of coercing them to zero.',
);

assert.match(
  weatherSource,
  /const isColdAdvantage = dewPoint !== null && dewPoint <= 2 && penalty <= 0;/,
  'Weather coaching should not infer cold conditions when dew point data is missing.',
);

assert.match(
  weatherSource,
  /normalizeWeatherCoordinates[\s\S]*function getBrowserCoordinates\(\)[\s\S]*navigator\.geolocation\.getCurrentPosition/,
  'Weather page should prefer validated browser geolocation over a stale historical run location.',
);

assert.match(
  weatherSource,
  /WEATHER_PAGE_REQUEST_TIMEOUT_MS\s*=\s*10000/,
  'Weather page hydration should use a bounded timeout so backend stalls cannot leave the route loading forever.',
);

assert.match(
  weatherSource,
  /apiJson\('\/api\/profile\/me', \{ signal: (?:controller|contextController)\.signal \}\)[\s\S]*apiJson\(`\/api\/v1\/weather\/context\?\$\{contextParams\.toString\(\)\}`, \{ signal: (?:controller|contextController)\.signal \}\)/,
  'Weather page should attach the timeout abort signal to its profile and location-aware weather context requests.',
);

assert.match(
  weatherSource,
  /new URLSearchParams\(\{\s*latitude: String\(browserCoordinates\.latitude\),\s*longitude: String\(browserCoordinates\.longitude\),\s*\}\)/,
  'Weather page should send the browser location to the backend weather context endpoint.',
);

assert.match(
  weatherSource,
  /const fallbackCoordinates = normalizeWeatherCoordinates\(ctx\?\.latitude, ctx\?\.longitude\);[\s\S]*if \(fallbackCoordinates\) \{/,
  'Weather page should retain server coordinates as a fallback even when historical weather context is unavailable.',
);

assert.match(
  weatherLocationSource,
  /'dew_point_2m'/,
  'Global live weather requests should include dew point instead of depending on historical archive availability.',
);

assert.match(
  weatherLocationSource,
  /Omitting `models` activates Open-Meteo's documented auto\/Best Match selector\.[\s\S]*url\.searchParams\.set\('cell_selection', 'land'\)/,
  'Weather requests should use documented Best Match model selection with land-grid elevation matching.',
);

assert.doesNotMatch(
  weatherSource,
  /forecast_title:\s*'Forecast Pipeline \/\/ 12H'|weather-engine-card-kicker[^\n]*wt\(['"]forecast_title['"]\)/,
  'Weather forecast panels should not render the removed pipeline title.',
);

assert.doesNotMatch(
  weatherSource,
  /forecast_(?:copy|attribution):|wt\(['"]forecast_(?:copy|attribution)['"]\)/,
  'The forecast panel should not render the removed explanatory script or attribution block.',
);

assert.match(
  weatherSource,
  /function formatPenalty\(value, wt\) \{[\s\S]*const numeric = toFiniteNumber\(value\);[\s\S]*if \(numeric === null\) return '--';/,
  'Missing adaptation output should stay unknown instead of being displayed as no penalty.',
);

assert.match(
  weatherSource,
  /weatherContext\?\.available\s*\? formatPenalty\(weatherContext\.pacePenaltySecPerKm, wt\)\s*: '--'/,
  'An unavailable adaptation context should not expose its placeholder zero as a real pace result.',
);

assert.match(
  weatherSource,
  /if \(weatherContext && !weatherContext\.available\) return wt\('adaptation_message_unavailable'\);/,
  'Unavailable backend context messages should use localized accuracy copy instead of leaking provider text.',
);

assert.match(
  weatherSource,
  /weatherContext\?\.available[\s\S]*liveWeather \? wt\('adaptation_unavailable'\) : wt\('no_weather'\)[\s\S]*liveWeather \? wt\('adaptation_unavailable_copy'\) : wt\('weather_unavailable_copy'\)/,
  'The heat card should distinguish an unavailable historical baseline from unavailable live weather.',
);

assert.match(
  weatherSource,
  /if \(!weatherContext\?\.available && liveWeather\) \{[\s\S]*coach_decision_baseline_missing[\s\S]*coach_decision_note_baseline_missing/,
  'Coach guidance should not treat a missing adaptation penalty as zero when live weather is available.',
);

assert.match(
  weatherSource,
  /const heroStatus = liveWeather \? wt\('hero_status_ready'\) : wt\('hero_status_fallback'\);/,
  'Weather hero readiness should follow live forecast availability in every location.',
);

assert.match(
  weatherSource,
  /WEATHER_FORECAST_REQUEST_TIMEOUT_MS\s*=\s*15000/,
  'Weather page forecast proxy should use a bounded timeout with enough room for a cold provider connection.',
);

assert.match(
  weatherSource,
  /enableHighAccuracy:\s*false,[\s\S]*maximumAge:\s*5 \* 60 \* 1000/,
  'Weather page should prefer a fast cached browser location before falling back to run history.',
);

assert.match(
  weatherSource,
  /const forecastParams = new URLSearchParams\([\s\S]*apiJson\(\s*`\/api\/v1\/weather\/forecast\?\$\{forecastParams\.toString\(\)\}`,[\s\S]*signal: forecastController\.signal/,
  'Weather forecasts should use the authenticated same-origin backend proxy so browser blockers cannot intercept Open-Meteo.',
);

assert.doesNotMatch(
  weatherSource,
  /fetch\(url, \{ signal: forecastController\.signal \}\)/,
  'Weather page must not fetch Open-Meteo directly from the browser.',
);

assert.match(
  weatherSource,
  /const forecastTimeout = window\.setTimeout\(\s*\(\) => forecastController\.abort\(\),\s*WEATHER_FORECAST_REQUEST_TIMEOUT_MS,\s*\);[\s\S]*apiJson\(\s*`\/api\/v1\/weather\/forecast\?\$\{forecastParams\.toString\(\)\}`,[\s\S]*if \(!cancelled\) \{[\s\S]*setForecastState\('error'\);/,
  'Weather page should turn proxied forecast timeout failures into the existing fallback state instead of staying in loading.',
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
  /\.weather-engine-engine-icon > svg(?:,\s*\.weather-engine-judge-mark > svg)?\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*overflow:\s*visible;/,
  'The Weather heat-adaptation thermometer should render its complete SVG inside the icon tile.',
);

assert.match(
  weatherSplitStyleSource,
  /\.weather-engine-engine-icon > svg,\s*\.weather-engine-judge-mark > svg\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*overflow:\s*visible;/,
  'The heat-adaptation and coach-judgment icons should share the same SVG box so they sit on one horizontal level.',
);

assert.match(
  styleSource,
  /\.weather-engine-card-head--judgment\s*\{[^}]*align-items:\s*flex-start;/,
  'The heat-adaptation and coach-judgment card titles should share the same top alignment.',
);

assert.match(
  liquidGlassSource,
  /\.runner-shell-page\.weather-engine-page :is\([\s\S]*\.weather-engine-card-head,[\s\S]*\.weather-engine-card-head > div[\s\S]*background:\s*transparent\s*!important;/,
  'Weather card headings should stay on their parent card surface instead of rendering as a glass strip.',
);

assert.match(
  liquidGlassSource,
  /\.runner-shell-page\.weather-engine-page \.weather-engine-forecast-strip\s*\{[^}]*background:\s*var\(--runner-profile-card\)\s*!important;[^}]*background-image:\s*none\s*!important;/,
  'The forecast pipeline should retain its theme-aware paper grid background while avoiding a nested image layer.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\)\s+\.weather-engine-page \.weather-engine-data-pill\s*\{[^}]*background:\s*rgba\(44,\s*47,\s*48,\s*0\.06\)\s*!important;/,
  'Weather metric strips should use a neutral light-grey surface in light themes.',
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

assert.match(
  styleSource,
  /\.weather-engine-hud-card\s*\{[\s\S]*aspect-ratio:\s*auto;[\s\S]*min-height:\s*clamp\(208px,\s*20vw,\s*248px\);/m,
  'Weather HUD cards should grow with their content instead of clipping localized footer copy inside a square.',
);

assert.match(
  styleSource,
  /\.weather-engine-hud-icon\s*\{[\s\S]*width:\s*clamp\(72px,\s*10vw,\s*104px\);[\s\S]*height:\s*clamp\(72px,\s*10vw,\s*104px\);[\s\S]*flex:\s*0\s+0\s+auto;/m,
  'Weather HUD icons should have bounded dimensions so labels cannot collapse into vertical stacks.',
);

assert.match(
  styleSource,
  /\.weather-engine-hud-head\s*>\s*span\s*\{[\s\S]*white-space:\s*nowrap;/m,
  'Weather HUD labels should remain scan-friendly beside their icons.',
);

console.log('[PASS] Weather editorial redesign guardrails passed.');
