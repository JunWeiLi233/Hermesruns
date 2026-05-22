import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, 'RacesDetail.jsx'), 'utf8');
const racesDetailStyles = readFileSync(path.join(here, '..', 'styles', 'style.css'), 'utf8');

assert.match(
  racesDetailSource,
  /previewImageUrl|payload\.imageUrl|payload\.sourceImageUrl/,
  'RacesDetail should normalize the backend preview image aliases so the course-map overlay can render on the runner-facing detail page.',
);

assert.match(
  racesDetailSource,
  /deriveRaceMapTrust\(\{\s*[\s\S]*imageUrl:\s*courseMapData\.(?:previewImageUrl|imageUrl)[\s\S]*overlayBounds:\s*courseMapData\.viewportBounds/,
  'RacesDetail should pass the aligned course-map image and bounds into the trust gate instead of hard-disabling overlays.',
);

assert.match(
  racesDetailSource,
  /const hasAlignedRoute = mapTrust\.trustedRouteGeometry && courseMapData\.routeAvailable && routeMapPoints\.length > 1;/,
  'RacesDetail should only render the AI route line when the frontend trust gate considers the route geometry trustworthy enough for the runner-facing basemap.',
);

assert.match(
  racesDetailSource,
  /const hasTrustedCourseMapOverlay = hasAlignedRoute && mapTrust\.trustedOverlay;/,
  'RacesDetail should require stricter overlay trust before painting the transparent course-map image above the real basemap.',
);

assert.match(
  racesDetailSource,
  /const hasCityLevelCourseMap = mapTrust\.cityLevelMatch && courseMapData\.routeAvailable && !hasAlignedRoute;/,
  'RacesDetail should preserve a city-level course-map state for stylized maps that are useful but not precise enough to draw as route geometry.',
);

assert.match(
  racesDetailSource,
  /hasCityLevelCourseMap[\s\S]*detail_map_detected_badge[\s\S]*detail_map_detected_source/,
  'RacesDetail should label city-level course-map matches as detected images instead of presenting them as cleanly aligned routes.',
);

assert.doesNotMatch(
  racesDetailSource,
  /L\.imageOverlay\(courseMapData\.imageUrl,/,
  'RacesDetail should not paint the raw course-map image over the runner-facing Leaflet card when the goal is a clearly real draggable map.',
);

assert.match(
  racesDetailSource,
  /L\.imageOverlay\(courseMapData\.overlayImageUrl,[\s\S]*pane:\s*'race-detail-course-image'/,
  'RacesDetail should paint only the generated transparent course-map overlay in its own pane beneath the extracted route.',
);

assert.doesNotMatch(
  racesDetailSource,
  /const shouldShowStaticMapFallback = !routeMapReady && Boolean\(staticMapFallback\)/,
  'RacesDetail should not keep a DOM static-map fallback gate once the race-detail card is meant to stay Leaflet-driven.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-static-fallback"/,
  'RacesDetail should not render a static tile-image fallback layer when the user asked for a real Leaflet map card.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-route-overlay"/,
  'RacesDetail should not rely on a DOM route-overlay fallback once the route belongs to the live Leaflet map itself.',
);

assert.match(
  racesDetailSource,
  /className="race-detail-lower-stack"/,
  'RacesDetail should replace the old side-by-side lower grid with a stacked map-first layout.',
);

assert.match(
  racesDetailSource,
  /className="race-detail-map-canvas"[\s\S]*role="region"/,
  'RacesDetail should expose the live Leaflet stage as a described map region instead of a static image so the lower block reads like a real interactive map.',
);

assert.match(
  racesDetailSource,
  /className=\{`race-detail-map-stage/,
  'RacesDetail should render the lower map as a dedicated full-width map stage.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-hud"/,
  'RacesDetail should not render the older floating HUD once the user asks to remove it from the map stage.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className=\{`race-detail-map-card/,
  'RacesDetail should stop expressing the lower map surface through the older card contract once the full-width map stage is introduced.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-copy"/,
  'RacesDetail should remove the top map-copy overlay block when the user wants the map surface cleared.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-actions"/,
  'RacesDetail should remove the bottom map-actions overlay block when the user wants the map surface cleared.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-hero-map"/,
  'RacesDetail should not keep the Leaflet stage mounted in the hero background when the requested layout moves the map card below.',
);

assert.match(
  racesDetailSource,
  /let hasAppliedInitialViewport = false;/,
  'RacesDetail should track its one-time auto-framing pass so the map can stop snapping users back onto the route after Leaflet mounts.',
);

assert.match(
  racesDetailSource,
  /applyRouteMapViewport\(\{\s*force:\s*true\s*\}\);/,
  'RacesDetail should perform an explicit initial viewport framing pass and then preserve subsequent user pan and zoom movement.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-lower-stack\s*\{/,
  'Race detail styles should define the stacked lower layout that keeps the map stage as the sole lower content block.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-lower-stack\s*\{[\s\S]*grid-template-columns:\s*1fr;/,
  'Race detail styles should let the lower stack collapse to a single column so the map owns the full row.',
);

assert.doesNotMatch(
  racesDetailStyles,
  /\.race-detail-lower-stack\s*\{[\s\S]*1\.85fr/,
  'Race detail styles should not keep the older desktop split-grid columns once the map stage becomes the dominant block.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-map-stage\s*\{/,
  'Race detail styles should define a dedicated full-width map-stage block.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-readiness-card"/,
  'RacesDetail should not render the older readiness card once the user asks for a map-only lower section.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-map-stage\s*\{[\s\S]*(?:min-height|height):\s*clamp\(/,
  'Race detail styles should give the map stage a taller immersive height once it owns the full row.',
);

assert.match(
  racesDetailStyles,
  /\.race-detail-map-leaflet\.is-mounted\s*\{[\s\S]*opacity:\s*1;/,
  'Race detail map styles should reveal the mounted Leaflet layer immediately so the world map stays visibly interactive while tiles finish painting.',
);

assert.doesNotMatch(
  racesDetailSource,
  /className="race-detail-map-photo-fallback"/,
  'RacesDetail should not keep the hero-image photo fallback inside the first map grid once the tile-map fallback is active.',
);

console.log('[PASS] Race detail course-map overlay guardrails passed.');
