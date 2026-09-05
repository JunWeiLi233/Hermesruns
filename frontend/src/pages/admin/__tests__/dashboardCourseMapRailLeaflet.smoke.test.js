import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const previewSource = readFileSync(path.join(here, "../../../components/AdminCourseMapPreview.jsx"), 'utf8');

assert.match(
  dashboardSource,
  /function getCourseMapViewportFallback\(item\)/,
  'Dashboard should derive a viewport fallback for course-map rail cards from race-level location data.'
);

assert.match(
  dashboardSource,
  /<List[\s\S]*rowComponent=\{CourseMapQueueRowComponent\}[\s\S]*rowHeight=\{160\}[\s\S]*rowProps=\{courseMapQueueRowProps\}/,
  'Dashboard course-map rail should virtualize the catalog-sized queue instead of mounting every race card at once.'
);

assert.match(
  dashboardSource,
  /function CourseMapQueueRowComponent[\s\S]*admin-coursemap-rail__preview[\s\S]*renderMap=\{false\}/,
  'Dashboard rail cards should use lightweight static previews and reserve interactive Leaflet rendering for the selected workspace.'
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-panel--live[\s\S]*forceLiveMap=\{true\}[\s\S]*fallbackCenter=\{getCourseMapViewportFallback\(selectedCourseMapItem\)\}/,
  'Dashboard selected course-map workspace should keep live Leaflet rendering and a race-level fallback center.'
);

assert.match(
  dashboardSource,
  /const selectedCourseMapItem = useMemo\([\s\S]*const queueItem = courseMapQueueItems\.find\(item => getCourseMapRaceId\(item\) === selectedCourseMapId\) \|\| null;[\s\S]*const detail = getCourseMapRaceId\(courseMapDetail\) === selectedCourseMapId \? courseMapDetail : null;[\s\S]*buildCourseMapWorkspaceSource\(\{ queueItem, detail \}\)/,
  'Dashboard selected course-map detail should preserve catalog lat/lng through buildCourseMapWorkspaceSource so the live/pending review grids can always render a city-level OSM fallback map.'
);

assert.match(
  previewSource,
  /forceLiveMap = false[\s\S]*fallbackCenter = null/,
  'AdminCourseMapPreview should accept explicit forceLiveMap and fallbackCenter props for compact rail-card maps.'
);

assert.match(
  previewSource,
  /const hasRenderableAlignment = hasAlignedOverlay \|\| hasAlignedRoute;[\s\S]*const hasFallbackCenter = Boolean\(fallbackLatLng\);[\s\S]*const shouldRenderMap = renderMap && !mapFailed && \(hasRenderableAlignment \|\| \(forceLiveMap && hasFallbackCenter\)\)/,
  'AdminCourseMapPreview should allow callers to opt out of Leaflet mounting while preserving live fallback behavior for workspace panels.'
);

assert.match(
  previewSource,
  /map\.setView\(fallbackLatLng,\s*11[\s\S]*L\.circleMarker\(fallbackLatLng/,
  'AdminCourseMapPreview should center and mark the fallback city-level viewport when no aligned route is available.'
);

console.log('[PASS] Dashboard course-map rail Leaflet fallback guardrails passed.');
