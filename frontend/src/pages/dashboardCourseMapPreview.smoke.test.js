import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const previewSource = readFileSync(path.join(here, '../components/AdminCourseMapPreview.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /AdminCourseMapPreview/,
  'Dashboard should use a dedicated aligned course-map preview renderer in the admin review workspace.'
);

assert.doesNotMatch(
  dashboardSource,
  /<div className="admin-review-preview">\s*<AdminCourseMapPreview/s,
  'Dashboard review panels should not wrap AdminCourseMapPreview in an extra admin-review-preview shell that can collapse the real preview stage.'
);

assert.match(
  dashboardSource,
  /admin-coursemap-rail__preview[\s\S]*preview=\{pending \|\| live\}/,
  'Dashboard should reuse the aligned course-map preview renderer inside the workbench rail cards, not collapse processed assets back to raw poster thumbnails.'
);

assert.match(
  dashboardSource,
  /routePoints|overlayBounds|elevationSamples/,
  'Dashboard should consume the richer AI alignment fields instead of collapsing course-map previews down to raw image URLs only.'
);

assert.match(
  dashboardSource,
  /const liveCourseMapPreview = useMemo\(\s*\(\) => getCourseMapCurrentLive\(selectedCourseMapItem\) \|\| getCourseMapLive\(selectedCourseMapItem\)/,
  'Dashboard live preview panel should prefer the current resolved live preview that matches the user-facing map, not only the raw stored live snapshot.'
);

assert.match(
  dashboardSource,
  /await Promise\.all\(\[loadCourseMaps\(\), loadQueues\(\)\]\)[\s\S]*await loadCourseMapDetail\(raceId, \{ forceFetch: true, fallbackItem: sourceItem \}\)/,
  'Dashboard should refresh the selected course-map detail after a pipeline job completes so the pending preview panel does not stay stale.'
);

assert.match(
  dashboardSource,
  /course_maps_status_running_refresh|course_maps_refreshing_preview/,
  'Dashboard should expose a visible refresh-state string while the selected course-map preview is being reloaded after a pipeline run.'
);

assert.match(
  previewSource,
  /previewImageUrl[\s\S]*sourceImageUrl/,
  'Admin course-map preview rendering should prefer the backend-provided previewImageUrl before falling back to raw source aliases.'
);

assert.match(
  previewSource,
  /isBrowserLoadableImageUrl[\s\S]*data:image\/[\s\S]*blob:[\s\S]*https:\/\//,
  'Admin course-map preview should only render browser-loadable image URLs so internal local-course-map references cannot trip CSP.'
);

assert.match(
  previewSource,
  /candidates\.find\(isBrowserLoadableImageUrl\)/,
  'Admin course-map preview should reject unsafe fallback image candidates instead of passing custom schemes to <img>.'
);

assert.match(
  previewSource,
  /mapFailed|setMapFailed/,
  'Admin course-map preview should track Leaflet preview failures instead of swallowing them into a permanent blank gray box.'
);

assert.match(
  previewSource,
  /admin-review-preview__image-layer|admin-review-preview__map-layer/,
  'Admin course-map preview should render image and map inside explicit overlay layers, not as side-by-side flex children.'
);

assert.match(
  previewSource,
  /getBackendBaseUrl[\s\S]*\/api\/maps\/tiles\/\{z\}\/\{x\}\/\{y\}\.png/,
  'Admin course-map preview should use the same-origin Hermes tile endpoint so the basemap still renders when direct third-party tile requests are blocked.'
);

assert.match(
  previewSource,
  /const fallbackTileUrl = useMemo\(\(\) => 'https:\/\/\{s\}\.tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png', \[\]\);/,
  'Admin course-map preview should keep a direct OpenStreetMap fallback basemap so the review grids do not stay grey when the proxy tile layer fails.'
);

assert.match(
  previewSource,
  /function attachTileLayer\(url\) \{[\s\S]*L\.tileLayer\(url,[\s\S]*layer\.on\('tileload'[\s\S]*tileLoadConfirmed = true[\s\S]*layer\.on\('tileerror'[\s\S]*switchToFallbackTiles\(\)/,
  'Admin course-map preview should track tileload/tileerror events and switch away from a blank proxy tile layer.'
);

assert.match(
  previewSource,
  /tileFallbackTimer = setTimeout\(\(\) => \{[\s\S]*if \(!tileLoadConfirmed && !switchedToFallbackTiles\) \{[\s\S]*switchToFallbackTiles\(\);[\s\S]*\}[\s\S]*\},\s*ADMIN_REVIEW_PREVIEW_TILE_FALLBACK_MS\);/,
  'Admin course-map preview should time out blank tile paints and recover to direct OpenStreetMap tiles.'
);

assert.match(
  previewSource,
  /map\.createPane\(name\)[\s\S]*createPreviewPane\('admin-review-preview__tile-pane',\s*180\)[\s\S]*createPreviewPane\('admin-review-preview__source-pane',\s*260\)[\s\S]*createPreviewPane\('admin-review-preview__route-shadow-pane',\s*420\)[\s\S]*createPreviewPane\('admin-review-preview__route-pane',\s*430\)[\s\S]*createPreviewPane\('admin-review-preview__marker-pane',\s*440\)/,
  'Admin course-map preview should create explicit Leaflet panes so OSM tiles remain the background and extracted routes render on top.'
);

assert.match(
  previewSource,
  /L\.tileLayer\(url,\s*\{[\s\S]*pane:\s*'admin-review-preview__tile-pane'/,
  'Admin course-map preview should pin the OpenStreetMap tile layer to the bottom pane.'
);

assert.match(
  previewSource,
  /L\.imageOverlay\(imageUrl,[\s\S]*pane:\s*'admin-review-preview__source-pane'[\s\S]*opacity:\s*0\.22/,
  'Admin course-map preview should keep any aligned source image as a faint reference above OSM, not as the dominant background.'
);

assert.match(
  previewSource,
  /L\.polyline\(polylinePoints,\s*\{[\s\S]*pane:\s*'admin-review-preview__route-shadow-pane'[\s\S]*L\.polyline\(polylinePoints,\s*\{[\s\S]*pane:\s*'admin-review-preview__route-pane'/,
  'Admin course-map preview should draw the extracted route in the top route pane with an outline for OSM readability.'
);

assert.match(
  previewSource,
  /applyPreviewViewport[\s\S]*invalidateSize[\s\S]*applyPreviewViewport[\s\S]*activeTileLayer\?\.redraw\?/,
  'Admin course-map preview should refit bounds and redraw tiles after Leaflet measures the real preview size, or the map can stay stuck on a blank stale viewport.'
);

console.log('[PASS] Dashboard course-map preview guardrails passed.');
