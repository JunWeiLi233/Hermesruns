import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-track-hub-sidebar__panel/,
  'Dashboard should regroup the course-map rail into explicit sidebar panels instead of one uninterrupted utility stack.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-stage__telemetry-grid/,
  'Dashboard should render a dedicated telemetry grid inside the dominant map stage footer.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-stage__compare-grid/,
  'Dashboard should promote the course-map main stage into a side-by-side compare grid.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-panel--live[\s\S]*preview=\{liveCourseMapPreview\}/,
  'Dashboard should show the current live website map in the compare stage.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-panel--pending[\s\S]*preview=\{pendingCourseMapPreview\}/,
  'Dashboard should show the pending candidate map in the compare stage.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-workspace-stack/,
  'Dashboard should stack the publish decision, operations band, and review comparison inside one unified track-hub workspace column.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-publish-layout--bridge/,
  'Dashboard should promote the course-map footer into a dedicated command-bridge layout rather than leaving all three panels at equal weight.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-footer-panel--publish/,
  'Dashboard should mark the publish canvas as the dominant command-bridge panel.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-footer-publish-body/,
  'Dashboard should group publish details and output metrics inside a dedicated publish-body wrapper so the command bridge does not rely on a fragile nested subgrid.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-footer-panel--ops/,
  'Dashboard should keep a dedicated operations lane inside the denser command deck.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-review-grid/,
  'Dashboard should expose the pending-vs-live comparison as a track-hub review grid rather than a generic review pair.',
);

assert.match(
  dashboardSource,
  /admin-command-shell--coursemaps/,
  'Dashboard should give the course-map tab its own widened shell modifier so this workspace can fill the available admin canvas.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-sidebar__panel\s*\{/,
  'Dashboard styles should define the new sidebar panel treatment for the course-map track hub.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-map-stage__telemetry-grid\s*\{/,
  'Dashboard styles should define the map-stage telemetry grid for the course-map track hub.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-map-stage__compare-grid\s*\{/,
  'Dashboard styles should define the side-by-side compare grid for the dominant course-map stage.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-map-panel__frame\s*\{[\s\S]*min-height:\s*320px/s,
  'Dashboard styles should give each live/pending compare panel a dedicated map frame with a stable visible height.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-review-grid\s*\{/,
  'Dashboard styles should define the dedicated review grid for the new course-map track hub.',
);

assert.match(
  styleSource,
  /\.admin-command-shell--coursemaps \.admin-track-hub-workspace-stack\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/,
  'Dashboard styles should force the course-map workspace stack to span the full stage width instead of auto-placing into a single parent grid column.',
);

assert.match(
  styleSource,
  /\.admin-coursemap-publish-layout--bridge\s*\{/,
  'Dashboard styles should define the command-bridge grid for the denser course-map workspace deck.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-footer-panel--publish\s*\{/,
  'Dashboard styles should define the dominant publish panel behavior for the command-bridge layout.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-footer-publish-body\s*\{/,
  'Dashboard styles should define a stable publish-body layout for the course-map command bridge.',
);

assert.match(
  styleSource,
  /\.admin-coursemap-publish-layout--bridge \.admin-track-hub-review-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/,
  'Dashboard styles should keep the review grid single-column inside the simplified command bridge to avoid narrow-card overflow.',
);

assert.doesNotMatch(
  styleSource,
  /\.admin-coursemap-publish-layout--bridge \.admin-coursemap-publish-canvas\s*\{[\s\S]*grid-template-areas:\s*"header output"/,
  'Dashboard should not keep the old nested publish subgrid that squeezed the command bridge into brittle header/output columns.',
);

assert.match(
  styleSource,
  /\.admin-command-page \.dashboard-container\.admin-command-shell--coursemaps\s*\{/,
  'Dashboard styles should widen the admin shell specifically for the course-map track hub.',
);

console.log('[PASS] Dashboard course-map track-hub refactor guardrails passed.');
