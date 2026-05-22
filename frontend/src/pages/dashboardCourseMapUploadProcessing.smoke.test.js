import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const translationsSource = readFileSync(path.join(here, '../i18n/translations.js'), 'utf8');

assert.match(
  dashboardSource,
  /const \{ jobId \} = await apiJson\(`\/api\/admin\/race-course-maps\/\$\{raceId\}\/pending\/upload`[\s\S]*setCourseMapAction\(\{ raceId, type: 'processing' \}\);[\s\S]*const job = await waitForAdminJob\(jobId\);/,
  'Dashboard should switch from upload state to processing state after the upload job is queued.',
);

assert.match(
  translationsSource,
  /"course_maps_status_running_processing":/,
  'Dashboard translations should include the upload processing status key.',
);

assert.doesNotMatch(
  translationsSource,
  /"course_maps_status_running_processing": ".*Qwen/,
  'Upload processing copy should not claim Qwen is running before the explicit scan button is clicked.',
);

assert.match(
  translationsSource,
  /"course_maps_status_running_reanalyze": ".*(?:AI|Qwen)/,
  'Re-analysis copy should remain the explicit AI/Qwen scan path.',
);

console.log('[PASS] Dashboard course-map upload processing state guard passed.');
