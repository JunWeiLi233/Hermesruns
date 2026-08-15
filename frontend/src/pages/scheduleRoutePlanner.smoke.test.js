import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scheduleSource = readFileSync(path.join(here, 'Schedule.jsx'), 'utf8');
const scheduleCss = readFileSync(path.join(here, '../styles/_split/schedule.css'), 'utf8');
// Translations are split into locale files; check both
const enSource = readFileSync(path.join(here, '../i18n/locales/en/pages.js'), 'utf8');
const zhSource = readFileSync(path.join(here, '../i18n/locales/zh-CN/pages.js'), 'utf8');

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

assert.match(
  scheduleSource,
  /const routeWaypoints = \(Array\.isArray\(routeRecommendation\?\.waypoints\) \? routeRecommendation\.waypoints : \[\]\)\s*\.map\(normalizeRouteWaypoint\)\s*\.filter\(Boolean\)/,
  'Schedule should normalize coach-route GPS waypoints before mounting the OpenStreetMap background.',
);

assert.match(
  scheduleSource,
  /const routeSketch = routeRecommendation\?\.preview \|\| null/,
  'Schedule should retain the history-derived route sketch when full geographic waypoints are unavailable.',
);

assert.match(
  scheduleSource,
  /className="schedule-plan-route-map-svg"/,
  'Schedule should render the history-derived route sketch instead of leaving the fallback map surface blank.',
);

assert.match(
  scheduleCss,
  /\.schedule-plan-route-card\.is-route-fallback \.schedule-plan-route-map-svg\s*\{[\s\S]*?width:\s*min\(58%, 560px\)/,
  'History route sketches should occupy the unused side of the fallback panel without covering its labels.',
);

assert.match(
  scheduleCss,
  /\.schedule-plan-route-map-svg\s*\{[\s\S]*?z-index:\s*2/,
  'History route sketches should stay visible above themed fallback-panel backgrounds.',
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

assert.match(
  scheduleSource,
  /isRouteRecommendationUsable\(newRoute, targetDistanceKm\)/,
  'Schedule should only promote a generated route after it passes the street-loop quality guard.',
);

assert.match(
  scheduleSource,
  /requireStreetGraph: false/,
  'Schedule should reject a badly distance-matched recent-run fallback instead of presenting it as the planned route.',
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
