import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

// DV-2026-08-15-31 rework: the review flow stacks as one card column —
// head/progress, map comparison, signals, decision, actions, timeline.
assert.match(
  dashboardSource,
  /admin-coursemap-rework__stack[\s\S]*?admin-coursemap-rework__card--head[\s\S]*?admin-coursemap-rework__card--compare[\s\S]*?admin-coursemap-rework__card--signals[\s\S]*?admin-coursemap-rework__card--decision[\s\S]*?admin-coursemap-rework__card--actions/,
  'Dashboard should stack the review head, comparison, signals, decision, and actions as one card column.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__card--compare[\s\S]*?admin-track-hub-map-stage__compare-grid[\s\S]*?admin-track-hub-map-panel--live[\s\S]*?admin-track-hub-map-panel--pending/,
  'Dashboard should keep the live/pending comparison inside the rework compare card.',
);

assert.match(
  dashboardSource,
  /admin-coursemap-rework__card--decision[\s\S]*?admin-coursemap-publish-canvas__decision-dock[\s\S]*?runRecommendedCourseMapAction/,
  'Dashboard should keep the recommended-action decision dock inside the rework decision card.',
);

console.log('[PASS] Dashboard course-maps rework stack guard passed.');

// DV-2026-08-15-32 — course-maps buttons: soft filled neutral pills (no hard
// border) for secondary actions; later !important sweeps must not repaint.
const kineticCss = readFileSync(path.join(here, '../styles/admin-kinetic-editorial.css'), 'utf8');
assert.match(
  kineticCss,
  /\.admin-command-page \.admin-coursemap-rework \.btn-secondary\.btn-inline-md,\s*\.admin-command-page \.admin-coursemap-rework \.admin-track-hub-sidebar \.btn-secondary\.btn-inline-md\s*\{[^}]*border:\s*0 !important[^}]*background:\s*color-mix\([^}]*!important/,
  'Course-maps secondary buttons should be soft filled pills with important overrides.',
);
