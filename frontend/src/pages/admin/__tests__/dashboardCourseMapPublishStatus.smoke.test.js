import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';

const dashboardSource = readDashboardSources();

assert.match(
  dashboardSource,
  /async function acceptCourseMapLive\(raceId\)[\s\S]*loadCourseMapDetail\(raceId/,
  'Dashboard should refresh the selected course-map detail after accepting a live publish so the visible race status flips from pending to live immediately.',
);

console.log('[PASS] Dashboard course-map publish status refresh guard passed.');
