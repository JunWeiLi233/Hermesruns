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
  previewSource,
  /previewImageUrl[\s\S]*sourceImageUrl/,
  'Admin course-map preview rendering should prefer the backend-provided previewImageUrl before falling back to raw source aliases.'
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
  /applyPreviewViewport[\s\S]*invalidateSize[\s\S]*applyPreviewViewport[\s\S]*tileLayer\.redraw\?/,
  'Admin course-map preview should refit bounds and redraw tiles after Leaflet measures the real preview size, or the map can stay stuck on a blank stale viewport.'
);

console.log('[PASS] Dashboard course-map preview guardrails passed.');
