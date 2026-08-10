import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /const showAllCourseMapArchives = useCallback\(\(\) => \{[\s\S]*setCourseMapQueueCollapsed\(false\);[\s\S]*setCourseMapQuery\(\{ search: '', status: '', page: 0 \}\);[\s\S]*\}, \[\]\);/,
  'The course-map archive action should reopen the queue and clear search, status, and pagination filters.',
);

assert.match(
  dashboardSource,
  /className="btn-secondary btn-inline-md admin-track-hub-sidebar__archives"[\s\S]*onClick=\{showAllCourseMapArchives\}[\s\S]*course_maps_sidebar_archives/,
  'The View all archives button should invoke the explicit archive action instead of an inline partial reset.',
);

console.log('[PASS] Dashboard course-map archive action guard passed.');
