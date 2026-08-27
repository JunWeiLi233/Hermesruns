import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const monitoringCss = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');

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

const decisionDockSurface = monitoringCss.match(
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-publish-canvas__decision-dock\s*\{([^}]*)\}/,
)?.[1];
assert.ok(decisionDockSurface, 'Course-map decision dock should have a dedicated light sub-card surface.');
assert.match(decisionDockSurface, /padding:\s*12px 14px/);
assert.match(decisionDockSurface, /border-radius:\s*18px/);
assert.match(decisionDockSurface, /linear-gradient\(180deg/);

const comparisonShellSurface = monitoringCss.match(
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rework__card--compare\s*\{([^}]*)\}/,
)?.[1];
assert.ok(comparisonShellSurface, 'Course-map comparison should have an explicit outer-shell reset.');
assert.match(comparisonShellSurface, /padding:\s*0\s*!important/);
assert.match(comparisonShellSurface, /border:\s*0\s*!important/);
assert.match(comparisonShellSurface, /background:\s*transparent\s*!important/);
assert.match(comparisonShellSurface, /box-shadow:\s*none\s*!important/);
assert.match(comparisonShellSurface, /backdrop-filter:\s*none\s*!important/);

const decisionOutputSpacing = monitoringCss.match(
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rework__card--decision\s*>\s*\.admin-track-hub-footer-output-grid\s*\{([^}]*)\}/,
)?.[1];
assert.ok(decisionOutputSpacing, 'Course-map decision output grids should have a dedicated separation from the decision dock.');
assert.match(decisionOutputSpacing, /margin-top:\s*14px/);

const mapBadgeAlignment = monitoringCss.match(
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-map-panel__head \.admin-track-hub-map-panel__badge\s*\{([^}]*)\}/,
)?.[1];
assert.ok(mapBadgeAlignment, 'Course-map confidence badges should have an explicit alignment override.');
assert.match(mapBadgeAlignment, /display:\s*inline-flex/);
assert.match(mapBadgeAlignment, /align-items:\s*center/);
assert.match(mapBadgeAlignment, /justify-content:\s*center/);
assert.match(mapBadgeAlignment, /text-align:\s*center/);

console.log('[PASS] Dashboard course-maps rework stack guard passed.');

// DV-2026-08-15-32 — course-maps buttons: soft filled neutral pills (no hard
// border) for secondary actions; later !important sweeps must not repaint.
const kineticCss = readFileSync(path.join(here, '../styles/admin-kinetic-editorial.css'), 'utf8');
assert.match(
  kineticCss,
  /\.admin-command-page \.admin-coursemap-rework \.btn-secondary\.btn-inline-md,\s*\.admin-command-page \.admin-coursemap-rework \.admin-track-hub-sidebar \.btn-secondary\.btn-inline-md\s*\{[^}]*border:\s*0 !important[^}]*background:\s*color-mix\([^}]*!important/,
  'Course-maps secondary buttons should be soft filled pills with important overrides.',
);

// The marathon switcher keeps the measured stage height while the outer
// virtualized list owns wheel scrolling; its scrollbar stays out of the rail.
const desktopCourseMapCss = monitoringCss.slice(monitoringCss.lastIndexOf('@media (min-width: 1181px)'));
const queueRailCss = desktopCourseMapCss.match(
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list\s*\{([^}]*)\}/,
);
assert.ok(queueRailCss, 'Course-map marathon switcher should keep a dedicated scroll surface.');
assert.match(queueRailCss[1], /height:\s*auto/);
assert.match(queueRailCss[1], /overflow-y:\s*auto/);
const queueRowWidthCss = monitoringCss.match(
  /\.admin-command-page \.admin-coursemap-rail__row\s*\{([^}]*)\}/,
);
assert.ok(queueRowWidthCss, 'Course-map marathon rows should span the full rail width.');
assert.match(queueRowWidthCss[1], /width:\s*100%/);
const queueCardWidthCss = monitoringCss.match(
  /\.admin-command-page \.admin-coursemap-rail__row\s*> \.admin-coursemap-rail__item\s*\{([^}]*)\}/,
);
assert.ok(queueCardWidthCss, 'Course-map marathon cards should be constrained by their row width.');
assert.match(queueCardWidthCss[1], /width:\s*100%/);
assert.match(queueCardWidthCss[1], /min-width:\s*0/);
const queueSearchSurface = monitoringCss.match(
  /body\.theme-light \.admin-command-page \.admin-command-route--courseMaps \.admin-track-hub-sidebar__search :is\(input, select\)\s*\{([^}]*)\}/,
)?.[1];
assert.ok(queueSearchSurface, 'Course-map queue search controls should have a dedicated light surface override.');
assert.match(queueSearchSurface, /border:\s*0\s*!important/);
assert.match(queueSearchSurface, /box-shadow:\s*none\s*!important/);
const queueListCss = monitoringCss.match(
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list\s*> div\s*\{([^}]*)\}/,
);
assert.ok(queueListCss, 'Course-map marathon switcher should constrain the inner list for wheel scrolling.');
assert.match(queueListCss[1], /scrollbar-width:\s*none/);
assert.match(queueListCss[1], /-ms-overflow-style:\s*none/);
assert.match(
  monitoringCss,
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list\s*> div::-webkit-scrollbar\s*\{[^}]*width:\s*0[^}]*height:\s*0/,
  'Course-map marathon switcher should hide the inner scrollbar while preserving wheel scrolling.',
);

assert.match(
  monitoringCss,
  /@media \(max-width:\s*1180px\)[\s\S]*?\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__virtual-list\s*\{[\s\S]*?height:\s*clamp\(280px,\s*58vh,\s*560px\)[\s\S]*?overflow:\s*hidden/,
  'Course-map marathon switcher should keep a bounded wheel-scroll surface on narrow screens.',
);

const queueCardWidth = monitoringCss.match(
  /\.admin-command-page \.admin-command-route--courseMaps \.admin-coursemap-rail__item\s*\{([^}]*)\}/,
);
assert.ok(queueCardWidth, 'Course-map marathon cards should have a dedicated route-level width rule.');
assert.match(queueCardWidth[1], /width:\s*100%/);
assert.match(queueCardWidth[1], /min-width:\s*0/);
assert.match(queueCardWidth[1], /box-sizing:\s*border-box/);
