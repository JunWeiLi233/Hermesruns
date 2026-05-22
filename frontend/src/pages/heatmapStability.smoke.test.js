import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const heatmapSource = readFileSync(path.join(here, 'Heatmap.jsx'), 'utf8');

assert.match(
  heatmapSource,
  /const points = useMemo\([\s\S]*?normalizePointSpeedRatios\(Array\.isArray\(heatmap\?\.points\) \? heatmap\.points : \[\]\)[\s\S]*?\[heatmap\?\.points\][\s\S]*?\);/,
  'Heatmap should memoize its normalized GPS point collection so viewport updates do not rebuild the map instance and cause flashing.',
);

assert.match(
  heatmapSource,
  /const \{ isAuthenticated, authHydrated \} = useAuth\(\);/,
  'Heatmap should read auth hydration state before deciding whether to redirect to login.',
);

assert.match(
  heatmapSource,
  /if \(!authHydrated\) \{\s*return;\s*\}\s*if \(!isAuthenticated\) \{\s*navigate\('\/login'\);/,
  'Heatmap should wait for URL/local token hydration before redirecting to login.',
);

assert.match(
  heatmapSource,
  /if \(!authHydrated \|\| !isAuthenticated\) return undefined;/,
  'Heatmap should not request heatmap data until auth hydration has completed.',
);

assert.match(
  heatmapSource,
  /}, \[bounds, heatmapState, points\]\);/,
  'Heatmap map-mount effect should depend on the memoized points collection rather than a fresh array built every render.',
);

assert.match(
  heatmapSource,
  /function buildVisibleGpsDots\(points, zoom\) \{[\s\S]*?visibleDots/,
  'Heatmap should build a sampled GPS-dot overlay for visible points on top of the heat layer.',
);

assert.match(
  heatmapSource,
  /L\.circleMarker\(\[point\.latitude, point\.longitude\],[\s\S]*?getGpsDotStyle\(point\.visualSpeedRatio, zoom\)[\s\S]*?renderer: canvasRenderer[\s\S]*?\)\.addTo\(routeDotsLayer\);/,
  'Heatmap should render visible GPS samples as Leaflet circle markers.',
);

assert.match(
  heatmapSource,
  /function getGpsDotStyle\(speedRatio, zoom\) \{[\s\S]*?radius[\s\S]*?fillOpacity[\s\S]*?weight/,
  'Heatmap should derive visible dot styling from speed ratio and zoom.',
);

assert.doesNotMatch(
  heatmapSource,
  /L\.polyline\(route\.latLngs,/,
  'Heatmap should not render the visible overlay as route polylines after restoring the dot version.',
);

console.log('[PASS] Heatmap stability regression guardrails passed.');
