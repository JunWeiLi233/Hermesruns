import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import translations from '../i18n/translations.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

const appSource = readFileSync(path.join(srcRoot, 'App.jsx'), 'utf8');
const navSource = readFileSync(path.join(srcRoot, 'utils', 'runnerShellNav.js'), 'utf8');
const territorySource = readFileSync(path.join(here, 'Territory.jsx'), 'utf8');

assert.match(
  appSource,
  /const Territory = React\.lazy\(\(\) => import\('\.\/pages\/Territory'\)\);/,
  'App should lazy-load the Territory page from source.',
);

assert.match(
  appSource,
  /<Route path="\/territory" element={<UserOnlyRoute><Territory \/><\/UserOnlyRoute>} \/>/,
  'App should register /territory as an authenticated user route.',
);

assert.match(
  navSource,
  /key: 'territory'[\s\S]*route: '\/territory'[\s\S]*icon: 'crown'/,
  'Runner shell navigation should expose a dedicated Territory entry.',
);

assert.match(
  territorySource,
  /getRunnerShellNavItems\(\{ t, lang, activeKey: 'territory' \}\)/,
  'Territory page should highlight the dedicated Territory nav item.',
);

assert.equal(
  translations.en?.profile?.dashboard_nav_territory,
  'Territory',
  'English locale should include the Territory nav label.',
);

assert.ok(
  translations['zh-CN']?.profile?.dashboard_nav_territory,
  'Chinese locale should include the Territory nav label.',
);

console.log('[PASS] Territory route contract smoke test passed.');
