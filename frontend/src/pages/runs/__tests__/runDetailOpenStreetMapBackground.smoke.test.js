import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDetailSource = readFileSync(path.join(here, "../RunDetail.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/run-detail-profile-minimal.css"), 'utf8');

assert.match(
  runDetailSource,
  /runner-shell-page runner-dashboard-page runs-dashboard-page run-detail-runner-page\$\{points\.length > 0 \? ' has-route-map-page-background' : ''\}/,
  'Route-backed Run Detail should mark the authenticated shell as using a page-level map background.',
);

assert.match(
  runDetailSource,
  /points\.length > 0 && \(\s*<div className="run-detail-map-background">[\s\S]*?id="route-map"/,
  'Route-backed Run Detail should render the Leaflet map as a shell-level background layer.',
);

assert.match(
  runDetailSource,
  /L\.tileLayer\('https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png'/,
  'Run Detail should keep OpenStreetMap as the map tile source.',
);

assert.match(
  runDetailSource,
  /const routeRevealHeight = isCompactMapLayout\s*\?[\s\S]*?const bottomPadding = Math\.max\(24, mapHeight - routeRevealHeight \+ 24\)[\s\S]*?paddingTopLeft:\s*\[24, 24\][\s\S]*?paddingBottomRight:\s*\[24, bottomPadding\]/,
  'The route should be fitted into the top map reveal instead of being centered in the full-page background.',
);

assert.match(
  runDetailSource,
  /L\.map\(mapRef\.current,\s*\{\s*zoomControl:\s*true,\s*scrollWheelZoom:\s*true,\s*dragging:\s*true\s*\}\)/,
  'The route map should support mouse dragging and wheel zooming.',
);

assert.match(
  runDetailSource,
  /const \[isMapExpanded, setIsMapExpanded\] = useState\(false\)[\s\S]*?map\.on\('click', \(\) => setIsMapExpanded\(\(current\) => !current\)\)/,
  'A map click should toggle the full-map mode in both directions.',
);

assert.match(
  runDetailSource,
  /run-detail-runner-page\$\{points\.length > 0 \? ' has-route-map-page-background' : ''\}\$\{isMapExpanded \? ' is-route-map-expanded' : ''\}/,
  'The route shell should expose the full-map state to CSS.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.run-detail-map-background\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*0;/,
  'The OpenStreetMap layer should remain a full-page background behind the Run Detail content.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.runner-shell-canvas\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/,
  'Run Detail content should remain above the map background.',
);

assert.match(
  styleSource,
  /\.run-detail-map-background::after\s*\{[\s\S]*?z-index:\s*350;/,
  'The map wash should remain below the route overlay so the running route stays visible.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.runner-shell-canvas\s*\{[\s\S]*?pointer-events:\s*none;/,
  'The transparent Run Detail canvas should let mouse gestures reach the background map.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.runner-shell-canvas\s+\.run-detail-shell\s*>\s*\*\s*\{[\s\S]*?pointer-events:\s*auto;/,
  'Overview and detail sections should remain interactive above the map.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.is-route-map-expanded\s*\{[\s\S]*?overflow:\s*hidden;/,
  'Full-map mode should lock the page to the map viewport.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.is-route-map-expanded\s+\.run-detail-map-background\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*10;/,
  'Full-map mode should promote OpenStreetMap to the full viewport.',
);

assert.match(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.is-route-map-expanded\s+\.runner-shell-canvas\s*\{[\s\S]*?display:\s*none;/,
  'Full-map mode should remove the content grids until the next map click.',
);

assert.match(
  styleSource,
  /\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\.run-detail-profile-minimal\.has-route-map-background\s+\.run-detail-shell\s*\{[\s\S]*?padding-top:\s*clamp\(444px,\s*calc\(58vh \+ 24px\),\s*704px\)\s*!important;/,
  'The overview card should sit below the desktop route-map stage.',
);

assert.match(
  styleSource,
  /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*?\.run-detail-runner-page\s+\.run-detail-page\.run-detail-profile-cockpit\.run-detail-profile-minimal\.has-route-map-background\s+\.run-detail-shell\s*\{[\s\S]*?padding-top:\s*clamp\(344px,\s*calc\(82vw \+ 24px\),\s*484px\)\s*!important;/,
  'The overview card should sit below the shorter narrow-screen route-map stage.',
);

assert.doesNotMatch(
  styleSource,
  /\.runner-shell-page\.run-detail-runner-page\.has-route-map-page-background\s+\.run-detail-map-background\s*\{[^}]*height:\s*clamp\(/,
  'The page background should not be constrained to a fixed-height map stage.',
);

console.log('[PASS] Run Detail OpenStreetMap background guardrails passed.');
