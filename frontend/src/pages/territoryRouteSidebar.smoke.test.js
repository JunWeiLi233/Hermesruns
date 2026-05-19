import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
const navSource = readFileSync(path.join(here, '../utils/runnerShellNav.js'), 'utf8');
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');
const iconSource = readFileSync(path.join(here, '../components/AppIcon.jsx'), 'utf8');
const hardcodedSidebarPages = [
  'ProfileDashboard.jsx',
  'AddShoes.jsx',
  'AnalysisInsightDetail.jsx',
  'RacesDetail.jsx',
  'ShoeCatalog.jsx',
];

assert.match(
  appSource,
  /const Territory = React\.lazy\(\(\) => import\('\.\/pages\/Territory'\)\);/,
  'App should lazy-load the Territory page.',
);

assert.match(
  appSource,
  /path="\/territory"[\s\S]*<UserOnlyRoute><Territory \/><\/UserOnlyRoute>/,
  'App routes should expose Territory as an authenticated runner page.',
);

assert.match(
  navSource,
  /key:\s*'territory'[\s\S]*route:\s*'\/territory'[\s\S]*icon:\s*'territory'/,
  'Shared runner shell nav should include the Territory sidebar link.',
);

assert.match(
  territorySource,
  /territory-map-only/,
  'Territory should render as a map-only destination after the shared sidebar routes users to /territory.',
);

assert.doesNotMatch(
  territorySource,
  /runner-shell-side-nav|terr-overlay-filters|terr-overlay-legend|terr-below-grid/,
  'Territory itself should not reintroduce the full sidebar or non-title/non-navigation overlays inside the map-first page.',
);

assert.match(
  territorySource,
  /terr-map-utility-rail--navigation-only/,
  'Territory should keep a compact navigation-only rail for necessary route buttons.',
);

assert.match(
  territorySource,
  /terr-map-titlebar/,
  'Territory should keep the Heatmap-style title strip requested for the map page.',
);

assert.match(
  iconSource,
  /case 'territory':/,
  'AppIcon should render a dedicated Territory icon in the shared sidebar.',
);

for (const fileName of hardcodedSidebarPages) {
  const source = readFileSync(path.join(here, fileName), 'utf8');
  assert.match(
    source,
    /key:\s*'territory'/,
    `${fileName} should include a Territory nav key in its hardcoded runner sidebar.`,
  );
  assert.match(
    source,
    /route:\s*'\/territory'/,
    `${fileName} should route its hardcoded Territory sidebar link to /territory.`,
  );
  assert.match(
    source,
    /icon:\s*'territory'/,
    `${fileName} should use the Territory icon in its hardcoded runner sidebar.`,
  );
}

console.log('[PASS] Territory route/sidebar wiring guard passed.');
