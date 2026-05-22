import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-track-hub-hero/,
  'Course maps should expose the transplanted race-track hub hero instead of only a utility header bar.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-grid/,
  'Course maps should render the two-column track hub grid from the supplied reference.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-sidebar/,
  'Course maps should render a left-side course management workspace.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-stage/,
  'Course maps should render a right-side course intelligence stage.',
);

assert.match(
  dashboardSource,
  /admin-track-hub-map-stage/,
  'Course maps should render the dominant map/source stage within the course intelligence area.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-hero\s*\{/,
  'Course map styles should define the new hero shell.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-grid\s*\{/,
  'Course map styles should define the new workspace grid.',
);

assert.match(
  styleSource,
  /\.admin-track-hub-map-stage\s*\{/,
  'Course map styles should define the dominant map stage.',
);

console.log('[PASS] Dashboard course hub redesign guardrails passed.');
