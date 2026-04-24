import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const previewSource = readFileSync(path.join(here, '../components/AdminCourseMapPreview.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /function getCourseMapViewportFallback\(item\)/,
  'Dashboard should derive a viewport fallback for course-map rail cards from race-level location data.'
);

assert.match(
  dashboardSource,
  /admin-coursemap-rail__preview[\s\S]*forceLiveMap=\{true\}[\s\S]*fallbackCenter=\{getCourseMapViewportFallback\(item\)\}/,
  'Dashboard rail cards should force live Leaflet rendering and pass a race-level fallback center into AdminCourseMapPreview.'
);

assert.match(
  previewSource,
  /forceLiveMap = false[\s\S]*fallbackCenter = null/,
  'AdminCourseMapPreview should accept explicit forceLiveMap and fallbackCenter props for compact rail-card maps.'
);

assert.match(
  previewSource,
  /const hasFallbackCenter = Boolean\(fallbackLatLng\);[\s\S]*const shouldRenderMap = !mapFailed && \(hasAlignedOverlay \|\| hasAlignedRoute \|\| \(forceLiveMap && hasFallbackCenter\)\)/,
  'AdminCourseMapPreview should allow a live Leaflet map even when only fallback center data exists.'
);

assert.match(
  previewSource,
  /map\.setView\(fallbackLatLng,\s*11[\s\S]*L\.circleMarker\(fallbackLatLng/,
  'AdminCourseMapPreview should center and mark the fallback city-level viewport when no aligned route is available.'
);

console.log('[PASS] Dashboard course-map rail Leaflet fallback guardrails passed.');
