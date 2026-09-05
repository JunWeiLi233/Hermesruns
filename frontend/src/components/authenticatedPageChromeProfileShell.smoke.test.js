import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(path.join(here, 'AuthenticatedPageChrome.jsx'), 'utf8');
const garminSource = readFileSync(path.join(here, "../pages/settings/GarminImportSettings.jsx"), 'utf8');
const importDataSource = readFileSync(path.join(here, "../pages/settings/ImportDataSettings.jsx"), 'utf8');

for (const snippet of [
  "import RunnerShellTopNav from './RunnerShellTopNav';",
  "import TopbarNotifications from './TopbarNotifications';",
  "import { getRunnerShellNavItems } from '../utils/runnerShellNav';",
  'runner-shell-page',
  'runner-shell-sidebar',
  'runner-shell-side-nav',
  'runner-shell-topbar',
  'runner-shell-canvas',
  "navigate('/today-run')",
]) {
  assert.ok(componentSource.includes(snippet), `Authenticated page chrome should include the Profile shell ${snippet}.`);
}

assert.doesNotMatch(componentSource, /import LanguageSwitcher/, 'Authenticated page chrome should not retain the floating language switcher.');
assert.doesNotMatch(componentSource, /from '\.\/TopNav'/, 'Authenticated page chrome should not retain the legacy horizontal TopNav.');
assert.doesNotMatch(componentSource, /<TopNav\b/, 'Authenticated page chrome should not render the legacy horizontal TopNav.');
assert.match(garminSource, /<AuthenticatedPageChrome\b/, 'Garmin import should keep using the shared Profile shell.');
assert.match(importDataSource, /<AuthenticatedPageChrome\b/, 'Manual import should keep using the shared Profile shell.');

console.log('[PASS] Authenticated page chrome Profile-shell guardrails passed.');
