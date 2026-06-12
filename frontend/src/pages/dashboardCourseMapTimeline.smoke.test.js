import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const stylesheetSource = readFileSync(path.join(here, '..', 'styles', 'style.css'), 'utf8');

assert.match(
  dashboardSource,
  /courseMapScanTimeline/,
  'Dashboard should have course-map scan timeline state.'
);

assert.match(
  dashboardSource,
  /loadCourseMapScanTimeline/,
  'Dashboard should fetch course-map scan timeline data.'
);

assert.match(
  dashboardSource,
  /\/api\/admin\/race-course-maps\/\$\{raceId\}\/scan-timeline/,
  'Dashboard should fetch scan timeline from the dedicated backend endpoint.'
);

assert.match(
  dashboardSource,
  /admin-jobs-detail__timeline-shell admin-coursemap-scan-timeline/,
  'Dashboard should render the scan timeline in its own stacked shell container.'
);

assert.doesNotMatch(
  dashboardSource,
  /admin-jobs-detail__timeline-shell admin-track-hub-workspace-stack/,
  'The scan timeline shell must not inherit the course-map workspace grid.'
);

assert.match(
  stylesheetSource,
  /admin-coursemap-scan-timeline[\s\S]*grid-column:\s*1\s*\/\s*-1/,
  'The scan timeline should span the course-map workspace instead of squeezing into a grid cell.'
);

assert.match(
  stylesheetSource,
  /admin-coursemap-scan-timeline[\s\S]*overflow-wrap:\s*anywhere/,
  'The scan timeline should wrap long AI scan details instead of compressing adjacent content.'
);

assert.match(
  dashboardSource,
  /admin-jobs-detail__timeline/,
  'Dashboard should render scan steps using the timeline list pattern.'
);

assert.match(
  dashboardSource,
  /getDashboardJobTimelineTone/,
  'Dashboard should apply timeline tone coloring to scan steps.'
);

assert.match(
  dashboardSource,
  /course_maps_scan_timeline_title/,
  'Dashboard should use i18n key for scan timeline title.'
);

assert.match(
  dashboardSource,
  /course_maps_timeline_no_steps/,
  'Dashboard should show an empty state when no scan steps exist.'
);

assert.match(
  dashboardSource,
  /course_maps_timeline_load_error/,
  'Dashboard should show an error state when timeline loading fails.'
);

console.log('[PASS] Dashboard course-map scan timeline guardrails passed.');
