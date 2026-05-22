import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');
const translationsSource = readFileSync(path.join(here, '../i18n/translations.js'), 'utf8');

assert.match(
  dashboardSource,
  /admin-users-command-hero/,
  'Dashboard users tab should expose a dedicated command-center hero.',
);

assert.match(
  dashboardSource,
  /admin-users-command-kpis/,
  'Dashboard users tab should expose a balanced roster-ops KPI band.',
);

assert.match(
  dashboardSource,
  /admin-users-roster-board/,
  'Dashboard users tab should render a dedicated roster board instead of only the legacy generic table card.',
);

assert.match(
  styleSource,
  /\.admin-users-command-hero\s*\{/,
  'Dashboard styles should define the users command-center hero.',
);

assert.match(
  styleSource,
  /\.admin-users-command-kpi\s*\{/,
  'Dashboard styles should define the roster KPI cards.',
);

assert.match(
  styleSource,
  /\.admin-users-roster-board\s*\{/,
  'Dashboard styles should define the premium roster board shell.',
);

assert.match(
  translationsSource,
  /users_command_title/,
  'Dashboard translations should include the users command-center copy keys.',
);

console.log('[PASS] Dashboard users command-center guardrails passed.');
