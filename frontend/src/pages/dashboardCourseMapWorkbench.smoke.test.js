import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-coursemap-workbench/,
  'Dashboard should render the course-map workspace as a dedicated single-race workbench instead of separate generic list and review sections.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-workbench__rail/,
  'Dashboard should keep the race selector inside a left-side workbench rail for faster one-race iteration.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-workbench__stage/,
  'Dashboard should give the selected race a dedicated workbench stage area for the iteration flow.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-action-group/,
  'Dashboard should group course-map actions by operator intent so upload, analyze, and publish are easier to run repeatedly.',
);

assert.match(
  dashboardSource,
  /courseMapRecommendation/,
  'Dashboard should compute a recommended next step for the selected course-map race instead of making admins infer the next action from scattered badges.',
);

assert.match(
  styleSource,
  /\.admin-coursemap-workbench\s*\{/,
  'Dashboard styles should define the dedicated course-map workbench layout.',
);

console.log('[PASS] Dashboard course-map workbench guardrails passed.');
