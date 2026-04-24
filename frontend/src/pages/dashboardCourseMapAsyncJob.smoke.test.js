import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /async function waitForAdminJob\(jobId, maxAttempts = 180\)/,
  'Dashboard should define a reusable admin background-job polling helper for course-map work.',
);

assert.match(
  dashboardSource,
  /apiJson\(`\/api\/admin\/jobs\/\$\{jobId\}`(?:, \{ signal: pollSignal \})?\)/,
  'Dashboard course-map polling should read generic admin job status instead of waiting on a blocking upload request.',
);

assert.match(
  dashboardSource,
  /AbortSignal\.timeout\([\s\S]*apiJson\(`\/api\/admin\/jobs\/\$\{jobId\}`, \{ signal: pollSignal \}\)/,
  'Dashboard course-map polling should put a timeout on each job-status request so a hung fetch cannot leave the re-analysis button spinning forever.',
);

assert.match(
  dashboardSource,
  /const \{ jobId \} = await apiJson\(`\/api\/admin\/race-course-maps\/\$\{raceId\}\/pending\/upload`[\s\S]*const job = await waitForAdminJob\(jobId\);/,
  'Dashboard course-map uploads should queue a background job and poll for completion.',
);

assert.match(
  dashboardSource,
  /const \{ jobId \} = await apiJson\(`\/api\/admin\/race-course-maps\/\$\{raceId\}\/pending\/reanalyze`[\s\S]*const job = await waitForAdminJob\(jobId\);/,
  'Dashboard course-map re-analysis should queue a background job and poll for completion.',
);

console.log('[PASS] Dashboard course-map async job flow passed.');
