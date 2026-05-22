import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /async function acceptCourseMapLive\(raceId\)[\s\S]*loadCourseMapDetail\(raceId/,
  'Dashboard should refresh the selected course-map detail after accepting a live publish so the visible race status flips from pending to live immediately.',
);

console.log('[PASS] Dashboard course-map publish status refresh guard passed.');
