import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

// DV-2026-08-15-31 rework: the hero is a clean card (kicker/title/intro/meta
// chips) — no decorative stats block or atmosphere layer.
assert.match(
  dashboardSource,
  /admin-coursemap-rework__hero[\s\S]*?course_maps_title[\s\S]*?admin-coursemap-rework__hero-meta/,
  'Course maps should expose the clean rework hero with kicker, title, intro, and meta chips.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__grid/,
  'Course maps should render the two-column rail + stage grid.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__rail admin-track-hub-sidebar/,
  'Course maps should render a left-side race-selection rail.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__stage/,
  'Course maps should render the stacked stage column for the selected race.',
);

assert.doesNotMatch(
  dashboardSource,
  /admin-track-hub-hero__atmosphere/,
  'The decorative hero atmosphere layer should stay removed.',
);

console.log('[PASS] Dashboard course-maps hero guard passed.');
