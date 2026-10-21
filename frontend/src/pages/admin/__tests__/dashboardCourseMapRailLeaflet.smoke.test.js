import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const previewSource = readFileSync(path.join(here, "../../../components/AdminCourseMapPreview.jsx"), 'utf8');
const courseMapsSource = readFileSync(path.join(here, '../CourseMapsSection.jsx'), 'utf8');
const catalogRailSource = courseMapsSource.match(/<section\s+className="admin-ref-card admin-ref-review-rail"[\s\S]*?<\/section>/)?.[0];

assert.match(
  dashboardSource,
  /function getCourseMapViewportFallback\(item\)/,
  'Dashboard should derive a viewport fallback for course-map rail cards from race-level location data.'
);

assert.match(
  catalogRailSource || '',
  /courseMapQueueItems\.map\(\(item\)[\s\S]*<button[\s\S]*aria-pressed=[\s\S]*onClick=\{\(\) => courseMapQueueRowProps\.onSelect\(item\)\}/,
  'The catalog rail should offer selectable race rows and identify the current selection.'
);

assert.doesNotMatch(
  catalogRailSource || '',
  /AdminCourseMapPreview/,
  'Catalog rows should reserve Leaflet rendering for the selected workspace rather than mounting a map for every race.'
);

assert.match(
  courseMapsSource,
  /<AdminCourseMapPreview[\s\S]*preview=\{preview\}[\s\S]*forceLiveMap\s+fallbackCenter=\{getCourseMapViewportFallback\(\s*selectedCourseMapItem,?\s*\)\}/,
  'The selected pending/live preview should keep geographic Leaflet rendering and the race-level fallback center.'
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
  /const hasFallbackCenter = Boolean\(fallbackLatLng\);[\s\S]*const shouldRenderMap = renderMap && !mapFailed && \(hasAlignedRoute \|\| \(forceLiveMap && hasFallbackCenter\)\)/,
  'AdminCourseMapPreview should allow callers to opt out of Leaflet mounting while preserving live fallback behavior for workspace panels.'
);

assert.match(
  previewSource,
  /map\.setView\(fallbackLatLng,\s*11[\s\S]*L\.circleMarker\(fallbackLatLng/,
  'AdminCourseMapPreview should center and mark the fallback city-level viewport when no aligned route is available.'
);

console.log('[PASS] Dashboard course-map rail Leaflet fallback guardrails passed.');
