import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.doesNotMatch(
  dashboardSource,
  /async function triggerCourseMapScan\s*\(/,
  'Dashboard should not keep the legacy scan-for-candidates action once course maps are manual-upload only.',
);

assert.doesNotMatch(
  dashboardSource,
  /course_maps_scan/,
  'Dashboard should not render the legacy course-map scan label after removing candidate discovery.',
);

assert.match(
  dashboardSource,
  /course_maps_upload/,
  'Dashboard should keep the explicit upload action for manual course-map curation.',
);

assert.match(
  dashboardSource,
  /course_maps_reanalyze/,
  'Dashboard should keep the reanalyze action for already uploaded pending maps.',
);

console.log('[PASS] Dashboard course-map manual-only guardrails passed.');
