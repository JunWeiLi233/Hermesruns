import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const kineticStyleSource = readFileSync(
  path.join(here, '../styles/admin-kinetic-editorial.css'),
  'utf8',
);
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

// DV-2026-08-15-10 — the console's inline actions (run pipeline / AI scan /
// Strava sync / add shoe / add catalog / logout) used to render as hard-cornered
// full-width bars. They must stay compact circular pills.
const pillBlock = kineticStyleSource.match(
  /\.dashboard-body\.admin-command-page \.btn-inline-md\s*\{([^}]*)\}/
)?.[1];
assert.ok(pillBlock, 'Admin command page should pin .btn-inline-md to a circular pill block.');
assert.match(pillBlock, /width:\s*auto/, 'Inline admin buttons should hug their content.');
assert.match(pillBlock, /border-radius:\s*999px/, 'Inline admin buttons should be circular pills.');
assert.match(pillBlock, /justify-content:\s*center/, 'Pill content should be centered.');

// The course-map workbench grid used to stretch each action button to a full
// grid cell; the rows must wrap as flex instead.
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-coursemap-publish-canvas__secondary-row,\s*\.dashboard-body\.admin-command-page \.admin-coursemap-action-group__buttons\s*\{[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/,
  'Course-map action rows should wrap buttons instead of stretching them.',
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-coursemap-publish-canvas__secondary-row > \.btn-inline-md,\s*\.dashboard-body\.admin-command-page \.admin-coursemap-action-group__buttons > \.btn-inline-md\s*\{[^}]*width:\s*auto/,
  'Course-map action buttons should not be forced to full grid-cell width.',
);

// The stage-header grid stretched its pills to the full header height; the row
// must center them instead.
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-track-hub-stage__actions\s*\{[^}]*align-items:\s*center/,
  'Stage-header action pills should be vertically centered, not stretched.',
);

// The decision-dock primary CTA (AI scan / publish) was a full-dock bar; it
// must hug its content as a compact pill, and the dock must keep verdict and
// pill on one row (verdict left, pill right) instead of dropping the pill to
// its own far-edge row when the ≤1360px column collapse kicks in.
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-coursemap-publish-canvas__primary\s*\{[^}]*width:\s*auto[^}]*min-height:\s*44px/,
  'Decision-dock primary CTA should be a compact pill, not a full-width bar.',
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-coursemap-publish-canvas__decision-dock\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*space-between/,
  'Decision dock should lay out verdict and pill on one centered row.',
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.admin-coursemap-publish-canvas__decision-dock \.admin-coursemap-publish-canvas__primary\s*\{[^}]*flex:\s*0 0 auto[^}]*margin-left:\s*auto/,
  'Dock pill should hug right without stretching or dropping to its own row.',
);

// The console actions from this round keep their labels and the pill class.
for (const label of [
  'dashboard.course_maps_run_pipeline',
  'dashboard.course_maps_source_scan',
  'dashboard.jobs_deck_trigger_sync',
  'dashboard.btn_add_shoe',
  'dashboard.btn_add_catalog',
  'dashboard.nav_logout',
]) {
  assert.ok(dashboardSource.includes(label), `Dashboard should still render ${label}.`);
}
const primaryInlineCount = dashboardSource.match(/className="btn-primary btn-inline-md/g)?.length ?? 0;
assert.ok(
  primaryInlineCount >= 4,
  `Expected the pipeline / shoes / jobs / logout primary actions to keep btn-inline-md (found ${primaryInlineCount}).`
);
