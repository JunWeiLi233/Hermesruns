import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRunDetailPath } from './runRoute.js';

assert.equal(buildRunDetailPath(1680), '/runs/1680');
assert.equal(buildRunDetailPath('1680'), '/runs/1680');
assert.equal(buildRunDetailPath(null), '/runs/');

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
assert.match(appSource, /<Route path="\/runs\/:id"/, 'The router should mount run details at /runs/:runId.');
assert.equal(appSource.includes('path="/run/:id"'), false, 'The router must not mount run details under /run/:runId.');

for (const page of [
  "../pages/runs/Runs.jsx",
  "../pages/runs/RunDetail.jsx",
  "../pages/analysis/AnalysisInsightDetail.jsx",
  "../pages/profile/ProfileDashboard.jsx",
]) {
  const source = readFileSync(path.join(here, page), 'utf8');
  assert.match(source, /buildRunDetailPath/, page + ' should use the canonical run-detail route helper.');
  assert.equal(source.includes('/run/' + '$' + '{'), false, page + ' must use the shared run-detail URL builder.');
  assert.equal(source.includes('/runs/' + '$' + '{'), false, page + ' must not build run-detail URLs directly under /runs/:runId.');
}

console.log('[PASS] Run detail route guard passed.');
