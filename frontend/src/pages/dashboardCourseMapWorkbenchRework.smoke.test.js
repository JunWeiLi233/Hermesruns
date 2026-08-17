import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

// DV-2026-08-15-31 rework: one rail + one stacked stage — the single-race
// iteration flow without the old nested workbench wrappers.
assert.match(
  dashboardSource,
  /admin-coursemap-rework__rail[\s\S]*?admin-coursemap-rail__virtual-list[\s\S]*?<Pagination pageData=\{courseMapsPage\}/,
  'Dashboard should keep search, the race list, and pagination in the left rail.',
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
