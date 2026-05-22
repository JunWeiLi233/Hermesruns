import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scheduleSource = readFileSync(path.join(here, 'Schedule.jsx'), 'utf8');
// Translations are split into locale files; check both
const enSource = readFileSync(path.join(here, '../i18n/locales/en.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN.js'), 'utf8');

assert.match(
  scheduleSource,
  /apiJson\('\/api\/route\/plan\/recent'\)/,
  'Schedule should load recent RoutePlanner recommendations without changing the existing coach route fetch.',
);

assert.match(
  scheduleSource,
  /const plannedRouteRecommendation = useMemo/,
  'Schedule should derive a planner-backed route recommendation for the planned-route card.',
);

assert.match(
  scheduleSource,
  /routeRecommendationSource === 'planner'/,
  'Schedule should distinguish planner-backed recommendations from existing route-history fallback copy.',
);

assert.match(
  scheduleSource,
  /schedule-plan-route-insight/,
  'Schedule planned-route card should show route-planning insights such as elevation preference and safety.',
);

// Leaflet map contract — SVG is replaced with a real Leaflet container
assert.match(
  scheduleSource,
  /schedule-plan-route-leaflet-map/,
  'Schedule should render a Leaflet map container (not just an SVG sketch) for the route card.',
);

assert.match(
  scheduleSource,
  /import\('leaflet'\)/,
  'Schedule should dynamically import leaflet for the route map.',
);

// Auto-plan from recent runs
assert.match(
  scheduleSource,
  /\/api\/route\/plan/,
  'Schedule should POST to /api/route/plan to auto-generate a route.',
);

assert.match(
  scheduleSource,
  /didAutoPlanRef/,
  'Schedule should guard the auto-plan call with a ref so it only fires once per page load.',
);

for (const key of [
  'route_planner_title',
  'route_planner_source',
  'route_planner_safety',
  'route_planner_accuracy',
  'route_elevation_flat',
  'route_elevation_rolling',
  'route_elevation_hilly',
]) {
  assert.match(
    enSource,
    new RegExp(`"${key}":`),
    `en translations should include ${key}.`,
  );
  assert.match(
    zhSource,
    new RegExp(`"${key}":`),
    `zh-CN translations should include ${key}.`,
  );
}

console.log('[PASS] Schedule route planner guard passed.');
