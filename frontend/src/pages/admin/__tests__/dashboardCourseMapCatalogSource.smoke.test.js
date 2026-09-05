import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';

const dashboardSource = readDashboardSources();

assert.match(
  dashboardSource,
  /from ['"]\.\.\/\.\.\/utils\/courseMapCatalogQueue\.js['"]/,
  'Dashboard should import the shared course-map catalog queue helper so the admin queue stays aligned with the races-page marathon inventory.',
);

assert.match(
  dashboardSource,
  /mergeCourseMapQueueItems\(/,
  'Dashboard should build the admin course-map queue through the shared merge helper instead of open-coding the queue order inline.',
);

assert.match(
  dashboardSource,
  /buildCourseMapAdminDetailFallback\(/,
  'Dashboard should synthesize an empty admin detail shell for catalog-only marathon queue entries.',
);

assert.match(
  dashboardSource,
  /hasCourseMapBackendRecord\(/,
  'Dashboard should check whether a selected course-map race already exists in backend state before requesting the detail endpoint.',
);

assert.doesNotMatch(
  dashboardSource,
  /const marathonCatalogCourseMapItems = useMemo/,
  'Dashboard should not keep a private marathonCatalogCourseMapItems selector once the shared course-map catalog helper exists.',
);

console.log('[PASS] Dashboard course-map catalog source guard passed.');
