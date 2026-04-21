import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  dashboardSource,
  /admin-coursemap-publish-layout/,
  'Dashboard should expose a dedicated publish layout instead of collapsing recommendation and evidence into one cramped summary strip.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-publish-canvas/,
  'Dashboard should render a dominant publish canvas for the selected race.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-evidence-stack/,
  'Dashboard should render a separate evidence stack instead of four narrow cards in one row.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-ops-band/,
  'Dashboard should group source acquisition and extraction actions into one operations band.',
);

assert.match(
  dashboardSource,
  /getCourseMapRaceId\(courseMapDetail\)\s*===\s*selectedCourseMapId\s*\?\s*courseMapDetail/,
  'Dashboard should only prefer loaded course-map detail when it belongs to the currently selected race, so switching rows can render immediately without stale detail blocking the workspace.',
);

assert.doesNotMatch(
  dashboardSource,
  /async function openCourseMapWorkspace[\s\S]*await loadCourseMapDetail\(raceId\);/,
  'Dashboard should not wait on the course-map detail request before updating the selected workspace row.',
);

assert.match(
  styleSource,
  /\.admin-coursemap-publish-layout/,
  'Dashboard styles should define the new publish layout grid.',
);

assert.match(
  styleSource,
  /\.admin-coursemap-evidence-card/,
  'Dashboard styles should define a reusable evidence-card family.',
);

console.log('[PASS] Dashboard course-map workspace redesign guardrails passed.');
