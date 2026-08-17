import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, './WeatherEngine.jsx'), 'utf8');

// Geolocation must never gate the weather page's first paint: the page waits
// only on the profile call, paints from the server-side location, and refines
// with device coordinates in the background when they resolve.
assert.match(
  source,
  /const profileData = await apiJson\('\/api\/profile\/me'[\s\S]*?const contextPromise = apiJson\('\/api\/v1\/weather\/context'/,
  'Weather page should kick profile and context together without geolocation.',
);
assert.doesNotMatch(
  source,
  /Promise\.all\(\[\s*apiJson\('\/api\/profile\/me'[\s\S]*?getBrowserCoordinates\(\),\s*\]\)/,
  'The first paint must not await geolocation.',
);
assert.match(
  source,
  /getBrowserCoordinates\(\)\.then\(\(browserCoordinates\) =>[\s\S]*?applyForecast\(browserCoordinates\)/,
  'Device coordinates should refine the forecast in the background.',
);
assert.match(
  source,
  /WEATHER_GEOLOCATION_TIMEOUT_MS = 3500/,
  'Geolocation refinement timeout should stay short (3.5s).',
);
