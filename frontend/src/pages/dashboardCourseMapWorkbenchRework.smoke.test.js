import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const monitoringStyleSource = readFileSync(
  path.join(here, '../styles/admin-monitoring-dashboard.css'),
  'utf8',
);

// DV-2026-08-15-31 rework: one rail + one stacked stage — the single-race
// iteration flow without the old nested workbench wrappers.
assert.match(
  dashboardSource,
  /admin-coursemap-rework__rail[\s\S]*?admin-coursemap-rail__virtual-list[\s\S]*?<Pagination pageData=\{courseMapsPage\}/,
  'Dashboard should keep search, the race list, and pagination in the left rail.',
);

assert.doesNotMatch(
  dashboardSource,
  /style=\{\{\s*height:\s*Math\.min\(courseMapQueueItems\.length \* 160, 640\)/,
  'The course-map queue should not clamp its list height before the final race card.',
);

assert.match(
  monitoringStyleSource,
  /\.admin-command-page \.admin-coursemap-rail__virtual-list\s*\{[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/,
  'The course-map queue rail should flow through every race instead of creating a clipped inner viewport.',
);

assert.match(
  monitoringStyleSource,
  /@media \(min-width: 1181px\)[\s\S]*?\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rework__grid\s*\{[\s\S]*?align-items:\s*stretch;/,
  'The desktop course-map columns should share the stage height through the scan timeline.',
);

assert.match(
  monitoringStyleSource,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-sidebar__panel--queue\s*\{[\s\S]*?height:\s*var\(--course-map-stage-height, 100%\);[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/,
  'The queue panel should use the measured workbench stage height instead of growing beyond it.',
);

assert.match(
  dashboardSource,
  /const courseMapStageContentRef = useRef\(null\);[\s\S]*?courseMapStageContentRef\.current[\s\S]*?ResizeObserver/,
  'Dashboard should measure the selected-race stage content before sizing the desktop queue.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-sidebar__panel--queue[\s\S]*?--course-map-stage-height[\s\S]*?ref=\{courseMapStageContentRef\}[\s\S]*?admin-coursemap-rework__stack/,
  'Dashboard should apply the measured stage height to the queue and observe the natural stage content.',
);

assert.match(
  monitoringStyleSource,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-sidebar__queue-body\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto;/,
  'The queue body should reserve its remaining height for the scrollable race list.',
);

assert.match(
  monitoringStyleSource,
  /@media \(min-width: 1181px\)[\s\S]*?\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list\s*\{[\s\S]*?height:\s*auto;[\s\S]*?overflow-y:\s*auto;/,
  'The bounded desktop queue should own scrolling around the full virtualized list content.',
);

assert.doesNotMatch(
  monitoringStyleSource,
  /@media \(min-width: 1181px\)[\s\S]*?\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list > div\s*\{[\s\S]*?height:\s*100%\s*!important;/,
  'The desktop queue should not resize the virtualized content root to the viewport and lose its scrollable content height.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__stage[\s\S]*?selectedCourseMapId && \(/,
  'Dashboard should give the selected race the dedicated stacked stage column.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__card--actions[\s\S]*?courseMapSecondaryActions\.map[\s\S]*?scanCourseMapSources/,
  'Dashboard should consolidate secondary actions and the source scan into one actions card.',
);

console.log('[PASS] Dashboard course-maps workbench rework guard passed.');
