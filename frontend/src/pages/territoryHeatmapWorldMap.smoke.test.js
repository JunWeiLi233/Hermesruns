import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  territorySource,
  /territory-page territory-heatmap-outline territory-map-only runner-dashboard-page/,
  'Territory should opt into the Heatmap-style full-world-map shell.',
);

assert.match(
  territorySource,
  /basemaps\.cartocdn\.com\/dark_all/,
  'Territory should use the same CARTO dark_all base map as the Heatmap page.',
);

assert.match(
  territorySource,
  /className:\s*'territory-real-world-tile'/,
  'Territory Leaflet tiles should be explicitly marked as real-world map tiles.',
);

assert.match(
  territorySource,
  /territory-map-only/,
  'Territory should opt into the map-only shell when the page is meant to show only land.',
);

assert.match(
  territorySource,
  /className="terr-map-utility-rail terr-map-utility-rail--navigation-only"/,
  'Territory keeps the navigation rail in markup so routing remains available if the cinematic map chrome is re-enabled.',
);

assert.match(
  territorySource,
  /className="terr-map-topbar terr-map-titlebar"/,
  'Territory keeps the title strip in markup while map-only styling can hide it for a reference-style game board.',
);

assert.match(
  territorySource,
  /MAP_CHROME_COPY[\s\S]*recenter:[\s\S]*viewRuns:[\s\S]*settings:/,
  'Territory title strip should include bilingual labels for recenter, runs, and settings.',
);

assert.match(
  territorySource,
  /navItems\.map\(\(item\) => \([\s\S]*<button[\s\S]*onClick=\{\(\) => navigate\(item\.route\)\}/,
  'Territory navigation buttons should be route buttons backed by the shared runner nav model.',
);

assert.doesNotMatch(
  territorySource,
  /terr-overlay-filters|terr-overlay-legend|terr-below-grid|terr-pill--view-toggle/,
  'Territory map-only view should not render filters, legends, or secondary panels.',
);

assert.match(
  territorySource,
  /showPolygons[\s\S]*recenterSignal=\{recenterSignal\}/,
  'Territory map-only view should force the concrete backend land masks and preserve the recenter title action.',
);

assert.doesNotMatch(
  territorySource,
  /<section className="terr-brief"/,
  'Territory should not render the obsolete terr-brief overlay on the full-screen world map.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container[\s\S]*background: #05070a;[\s\S]*filter: none;/,
  'Territory full-screen map container should match the Heatmap dark-map base without extra container filtering.',
);

assert.match(
  styleSource,
  /\.territory-heatmap-outline \.leaflet-container \.territory-real-world-tile,[\s\S]*filter: none;[\s\S]*mix-blend-mode: normal;/,
  'Territory dark_all map tiles should not receive an extra Territory-specific darkening filter.',
);

assert.match(
  styleSource,
  /Territory full-bleed guard[\s\S]*\.territory-page\.territory-heatmap-outline\.runner-shell-page \.runner-shell-main,[\s\S]*margin: 0 !important;/,
  'Territory full-screen map should not inherit the hidden runner sidebar gutter.',
);

assert.match(
  styleSource,
  /\.territory-map-only \.terr-map-utility-rail--navigation-only[\s\S]*display: grid !important;/,
  'Territory map-only view should keep the full vertical navigation rail available like the Heatmap page.',
);

assert.match(
  styleSource,
  /\.territory-map-only \.terr-map-titlebar[\s\S]*display: grid !important;/,
  'Territory map-only view should keep the title/action strip available for recenter, runs, settings, and profile navigation.',
);

assert.doesNotMatch(
  styleSource,
  /\.territory-map-only \.runner-shell-sidebar,[\s\S]*\.territory-map-only \.runner-shell-topbar,[\s\S]*display: none !important;/,
  'Territory map-only view must not hide the shared top/sidebar navigation because that strands the user on the map.',
);

console.log('[PASS] Territory Heatmap world-map styling guard passed.');
