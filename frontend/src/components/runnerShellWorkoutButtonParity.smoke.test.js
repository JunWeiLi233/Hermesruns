import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');
const read = (relativePath) => readFileSync(path.join(srcRoot, relativePath), 'utf8');
const unifiedStylePath = 'styles/runner-shell-workout-button.css';
const pageFiles = [
  'pages/AddShoes.jsx',
  'pages/Analysis.jsx',
  'pages/MuscleTraining.jsx',
  'pages/ProfileDashboard.jsx',
  'pages/Races.jsx',
  'pages/Rewards.jsx',
  'pages/Runs.jsx',
  'pages/Schedule.jsx',
  'pages/Settings.jsx',
  'pages/Shoes.jsx',
  'pages/ShoeCatalog.jsx',
  'pages/TodayRun.jsx',
  'pages/WeatherEngine.jsx',
];

const indexSource = read('index.css');
const unifiedStyleSource = existsSync(path.join(srcRoot, unifiedStylePath))
  ? read(unifiedStylePath)
  : '';

assert.match(
  indexSource,
  /@import '\.\/styles\/runner-shell-workout-button\.css';/,
  'The shared workout button parity layer should load from the main stylesheet.',
);
const parityImport = "@import './styles/runner-shell-workout-button.css';";
assert(
  indexSource.slice(indexSource.lastIndexOf(parityImport) + parityImport.length).indexOf('@import') === -1,
  'The shared workout button parity layer should load after every page-specific stylesheet.',
);

assert.match(
  unifiedStyleSource,
  /#root\s+\.runner-dashboard-page\s+\.runner-shell-sidebar-footer\s*>\s*\.runner-shell-workout-btn[\s\S]*background:\s*linear-gradient\(110deg,\s*#b64635\s+0%,\s*#ed715f\s+100%\)\s*!important;[\s\S]*color:\s*#fff\s*!important;/,
  'Every expanded runner workout button should use the Image 1 coral gradient and white foreground.',
);

assert.match(
  unifiedStyleSource,
  /#root\s+\.runner-dashboard-page\.is-sidebar-collapsed\s+\.runner-shell-sidebar-footer\s*>\s*\.runner-shell-workout-btn[\s\S]*width:\s*52px\s*!important;[\s\S]*height:\s*60px\s*!important;/,
  'Collapsed runner rails should keep the centered arrow button geometry.',
);

for (const relativePath of pageFiles) {
  const source = read(relativePath);
  assert.match(
    source,
    /runner-shell-workout-btn runner-dashboard-workout-btn/,
    `${relativePath} should render the shared workout button hook.`,
  );
  assert.doesNotMatch(
    source,
    /runner-dashboard-workout-glyph[^>]*>\s*\+/,
    `${relativePath} should use the shared arrow glyph rather than a page-specific plus glyph.`,
  );
}

console.log('[PASS] Runner workout button parity guardrails passed.');
