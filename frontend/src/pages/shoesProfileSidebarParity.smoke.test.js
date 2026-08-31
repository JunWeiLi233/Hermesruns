import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const readPage = (name) => readFileSync(path.join(here, name), 'utf8');
const sharedNavSource = readFileSync(path.join(here, '../utils/runnerShellNav.js'), 'utf8');
const profileSource = readPage('ProfileDashboard.jsx');
const shoesSource = readPage('Shoes.jsx');
const sidebarSources = [
  'AddShoes.jsx',
  'AnalysisInsightDetail.jsx',
  'ProfileDashboard.jsx',
  'RacesDetail.jsx',
  'ShoeCatalog.jsx',
].map(readPage);

const sharedSidebarHooks = [
  'runner-shell-sidebar',
  'runner-shell-brand runner-dashboard-brand',
  'runner-shell-side-nav',
  'runner-shell-side-link',
  'runner-shell-sidebar-footer',
  'runner-shell-workout-btn runner-dashboard-workout-btn',
];

for (const hook of sharedSidebarHooks) {
  assert.ok(profileSource.includes(hook), `Profile sidebar should include ${hook}`);
  assert.ok(shoesSource.includes(hook), `Shoes sidebar should include ${hook}`);
}

assert.ok(
  shoesSource.includes('getRunnerShellNavItems({') && shoesSource.includes("activeKey: 'shoes'"),
  'Shoes should keep the shared numbered runner navigation with Shoes marked active.',
);

assert.ok(
  shoesSource.includes("t('analysis.stitch_brand_subtitle_profile')"),
  'Shoes should use the same sidebar identity line as Profile.',
);

for (const source of sidebarSources) {
  assert.match(source, /key:\s*'shoes'[^\n]*icon:\s*'shoe_outline'/, 'Every page-specific sidebar should use the pictured shoe logo.');
  assert.doesNotMatch(source, /key:\s*'shoes'[^\n]*icon:\s*'straighten'/, 'Page-specific sidebars should not use the generic measurement icon.');
}

assert.match(sharedNavSource, /key:\s*'shoes'[^\n]*icon:\s*'shoe_outline'/, 'The shared sidebar should use the pictured shoe logo.');
assert.doesNotMatch(sharedNavSource, /key:\s*'shoes'[^\n]*icon:\s*'straighten'/, 'The shared sidebar should not use the generic measurement icon.');

console.log('[PASS] Shoes keeps Profile sidebar parity.');
