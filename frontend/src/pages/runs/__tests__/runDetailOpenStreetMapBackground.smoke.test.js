import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDetailSource = readFileSync(path.join(here, '../RunDetail.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../../../styles/run-detail-v2.css'), 'utf8');

const mapEffectStart = runDetailSource.indexOf('if (!mapRef.current || mapInstanceRef.current || !insights) return;');
const mapEffectEnd = runDetailSource.indexOf('}, [insights, points, t]);', mapEffectStart);
assert.ok(mapEffectStart >= 0 && mapEffectEnd > mapEffectStart, 'Leaflet should keep a route-scoped lifecycle.');
const mapLifecycle = runDetailSource.slice(mapEffectStart, mapEffectEnd);

assert.match(
  runDetailSource,
  /runner-shell-page runner-dashboard-page runs-dashboard-page run-detail-runner-page run-detail-v2-page\$\{isMapExpanded \? ' is-route-map-expanded' : ''\}/,
  'The shared runner shell should expose the v2 map expansion state to CSS.',
);

assert.match(
  runDetailSource,
  /<section id="run-detail-overview" className="run-detail-v2__hero">\s*<div className=\{\x60run-detail-v2__map\$\{points\.length > 0 \? '' : ' is-empty'\}\x60\}>\s*\{points\.length > 0 \? \([\s\S]*?<div className="run-detail-map-background run-detail-v2__map-canvas">\s*<div ref=\{mapRef\} id="route-map"/,
  'Route-backed Run Detail should mount Leaflet inside the dedicated hero map card.',
);
assert.equal((runDetailSource.match(/id="route-map"/g) || []).length, 1, 'Run Detail should mount only one route map.');

assert.match(
  mapLifecycle,
  /L\.tileLayer\('https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png',\s*\{\s*attribution: '&copy; OpenStreetMap contributors',\s*\}\)\.addTo\(map\)/,
  'Run Detail should retain OpenStreetMap tiles and attribution.',
);
assert.match(
  mapLifecycle,
  /L\.map\(mapRef\.current,\s*\{\s*zoomControl:\s*true,\s*scrollWheelZoom:\s*true,\s*dragging:\s*true\s*\}\)/,
  'The route map should retain zoom controls, wheel zoom, and mouse dragging.',
);
assert.match(
  mapLifecycle,
  /const line = L\.polyline\(points,[^\n]+\.addTo\(map\);[\s\S]*?if \(mapHeight < 64\) return;\s*map\.fitBounds\(line\.getBounds\(\),\s*\{ padding: \[32, 32\], animate: false \}\)/,
  'The real route polyline should fit within the visible card with padding once the map has a usable height.',
);
assert.match(
  mapLifecycle,
  /L\.circleMarker\(points\[0\],[\s\S]*?\.bindTooltip\(t\('run_detail\.start'\)\)\.addTo\(map\);[\s\S]*?L\.circleMarker\(points\[points\.length - 1\],[\s\S]*?\.bindTooltip\(t\('run_detail\.finish'\)\)\.addTo\(map\)/,
  'The route should retain localized start and finish markers.',
);
assert.match(
  mapLifecycle,
  /const resizeMap = \(\) => \{\s*map\.invalidateSize\(\{ pan: false \}\);\s*focusRouteAtTop\(\);\s*\};[\s\S]*?new ResizeObserver\(resizeMap\);[\s\S]*?resizeObserver\.observe\(mapRef\.current\);[\s\S]*?resizeMap\(\);\s*resizeTimeoutId = window\.setTimeout\(resizeMap, 0\)/,
  'Initial and observed geometry changes should resize Leaflet and refit the route.',
);
assert.match(
  mapLifecycle,
  /import\('leaflet'\)\.then\(\(L\) => \{\s*if \(disposed \|\| !mapRef\.current\) return;/,
  'An asynchronous Leaflet import should not mount after the route is disposed.',
);
assert.match(
  mapLifecycle,
  /return \(\) => \{\s*disposed = true;\s*resizeObserver\?\.disconnect\(\);\s*if \(resizeTimeoutId != null\) window\.clearTimeout\(resizeTimeoutId\);\s*if \(mapInstanceRef\.current\) \{\s*mapInstanceRef\.current\.remove\(\);\s*mapInstanceRef\.current = null;/,
  'Route changes and unmount should cancel resize work, disconnect observation, and remove the map instance.',
);

assert.match(
  runDetailSource,
  /<button type="button" className="run-detail-v2__map-expand" onClick=\{\(\) => setIsMapExpanded\(\(current\) => !current\)\} aria-pressed=\{isMapExpanded\}>[\s\S]*?\{isMapExpanded \? t\('run_detail\.map_collapse'\) : t\('run_detail\.map_expand'\)\}/,
  'The explicit map button should toggle both directions and expose its pressed state and localized action.',
);
assert.match(
  mapLifecycle,
  /map\.on\('click', \(\) => setIsMapExpanded\(\(current\) => !current\)\)/,
  'The existing map click handler should continue to toggle expansion.',
);
assert.match(
  runDetailSource,
  /const frameId = window\.requestAnimationFrame\(\(\) => \{\s*mapInstanceRef\.current\?\.invalidateSize\(\{ pan: false \}\);\s*\}\);\s*return \(\) => window\.cancelAnimationFrame\(frameId\);\s*\}, \[isMapExpanded\]\)/,
  'Expansion and collapse should invalidate map size and cancel pending animation work on cleanup.',
);
assert.match(
  runDetailSource,
  /if \(!isMapExpanded\) return undefined;[\s\S]*?const previousOverflow = document\.body\.style\.overflow;\s*document\.body\.style\.overflow = 'hidden';[\s\S]*?if \(event\.key === 'Escape'\) setIsMapExpanded\(false\);[\s\S]*?window\.addEventListener\('keydown', handleKeyDown\);[\s\S]*?document\.body\.style\.overflow = previousOverflow;\s*window\.removeEventListener\('keydown', handleKeyDown\)/,
  'Expanded maps should lock body scrolling, close on Escape, and restore scrolling and keyboard listeners.',
);

assert.match(
  styleSource,
  /#root \.run-detail-v2 \.run-detail-v2__map\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*480px;[^}]*overflow:\s*hidden;[^}]*isolation:\s*isolate;/,
  'The normal map should be a contained, interactive hero card.',
);
assert.match(
  styleSource,
  /\.run-detail-v2__map \.run-detail-map-background\.run-detail-v2__map-canvas\s*\{[^}]*position:\s*absolute !important;[^}]*inset:\s*0 !important;[^}]*width:\s*100% !important;[^}]*height:\s*100% !important;/,
  'Leaflet should fill its map card rather than the page canvas.',
);
assert.match(
  styleSource,
  /\.run-detail-v2__map \.run-detail-map-background::after\s*\{\s*content:\s*none !important;/,
  'The legacy map wash should not obscure the route in its dedicated card.',
);
assert.match(
  styleSource,
  /\.run-detail-v2__map-expand\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*500;[^}]*cursor:\s*pointer;/,
  'The expansion control should remain above the interactive map.',
);
assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-v2-page\.is-route-map-expanded \.runner-shell-canvas\s*\{\s*display:\s*block !important;/,
  'Expanded mode should keep the canvas mounted so the map and collapse button remain available.',
);
assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-v2-page\.is-route-map-expanded :is\(\.run-detail-v2, \.run-detail-v2__shell\)\s*\{[^}]*animation:\s*none !important;[^}]*transform:\s*none !important;/,
  'Expanded maps should escape the animated canvas containing block.',
);
assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-v2-page\.is-route-map-expanded \.run-detail-v2__map\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*60;[^}]*min-height:\s*0;[^}]*border-radius:\s*0;/,
  'Expansion should promote the whole map card and its button to the viewport.',
);
assert.match(
  runDetailSource,
  /\) : \(\s*<div className="run-detail-no-map">\{t\('run_detail\.no_map'\)\}<\/div>\s*\)\}\s*<\/div>\s*<div className="run-detail-v2__summary">/,
  'Activities without coordinates should retain a localized fallback alongside the same activity summary.',
);
assert.match(mapLifecycle, /if \(!points\.length\) return;/, 'No-route activities should not initialize Leaflet.');
assert.match(styleSource, /\.run-detail-v2__map\.is-empty\s*\{[^}]*place-items:\s*center;/, 'The no-route fallback should remain visible in the map card.');
assert.match(styleSource, /@media \(max-width: 1200px\)\s*\{[\s\S]*?\.run-detail-v2__map\s*\{\s*min-height: 380px;/, 'Tablet maps should use the compact card height.');
assert.match(styleSource, /@media \(max-width: 860px\)\s*\{[\s\S]*?\.run-detail-v2__map\s*\{\s*min-height: 300px;/, 'Narrow-screen maps should retain a usable card height.');

console.log('[PASS] Run Detail v2 OpenStreetMap card guardrails passed.');
