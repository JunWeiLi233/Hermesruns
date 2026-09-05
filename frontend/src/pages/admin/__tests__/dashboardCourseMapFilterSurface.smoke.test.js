import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const monitoringCss = readFileSync(path.join(here, "../../../styles/admin-monitoring-dashboard.css"), 'utf8');

assert.match(
  dashboardSource,
  /admin-track-hub-sidebar__search[\s\S]*?courseMapQuery\.search[\s\S]*?courseMapQuery\.status/,
  'Course Maps should keep the search and status controls together in the queue filter group.',
);

const lightFilterSurface = monitoringCss.match(
  /body\.theme-light \.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-sidebar__search :is\(input, select\)\s*\{([^}]*)\}/,
);
assert.ok(lightFilterSurface, 'Course Maps filter controls should have a dedicated light-theme surface rule.');
assert.match(
  lightFilterSurface[1],
  /background:\s*#eef0f1\s*!important;/,
  'Course Maps search and status controls should use the requested light-grey background.',
);

console.log('[PASS] Dashboard course-map filter surface guard passed.');
