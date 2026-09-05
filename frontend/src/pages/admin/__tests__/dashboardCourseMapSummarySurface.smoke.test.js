import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';

const dashboardSource = readDashboardSources();

assert.match(
  dashboardSource,
  /const courseMapDisplaySummary = courseMapDisplayPreview\?\.summary \|\| '';/,
  'Dashboard should derive a visible course-map summary from the currently displayed preview.',
);

assert.match(
  dashboardSource,
  /courseMapDisplaySummary \? \(\s*<p className="admin-coursemap-rework__summary">\{courseMapLocalizedSummary\}<\/p>/,
  'Dashboard should surface the active course-map summary in the rework decision card.',
);

console.log('[PASS] Dashboard course-map summary surface guard passed.');
