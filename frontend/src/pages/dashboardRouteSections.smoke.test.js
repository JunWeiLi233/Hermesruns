import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(path.join(here, '../App.jsx'), 'utf8');
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  appSource,
  /path="\/dashboard\/\*"/,
  'App should route the admin surface through /dashboard/* so overview and section pages share one mounted shell.',
);

assert.match(
  dashboardSource,
  /\/dashboard\/settings/,
  'Dashboard should expose a dedicated /dashboard/settings route target for operator preferences.',
);

assert.match(
  dashboardSource,
  /\/dashboard\/users/,
  'Dashboard should expose a dedicated /dashboard/users route target instead of only tab state.',
);

assert.match(
  dashboardSource,
  /\/dashboard\/course-maps/,
  'Dashboard should expose a dedicated /dashboard/course-maps route target instead of only tab state.',
);

assert.match(
  dashboardSource,
  /useLocation/,
  'Dashboard should derive the active admin section from routing state.',
);

assert.doesNotMatch(
  dashboardSource,
  /useState\('overview'\)/,
  'Dashboard should not keep overview as a local tab default once the admin shell is route-driven.',
);

console.log('[PASS] Dashboard route sections guardrails passed.');
