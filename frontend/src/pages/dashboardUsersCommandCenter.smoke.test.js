import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.generated.css'), 'utf8');
const adminMonitoringStyleSource = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');
const translationsSource = [
  readFileSync(path.join(here, '../i18n/locales/en/components.js'), 'utf8'),
  readFileSync(path.join(here, '../i18n/locales/zh-CN/components.js'), 'utf8'),
].join('\n');

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
  adminMonitoringStyleSource,
  /\.admin-command-route--users,[\s\S]*padding:\s*clamp\(18px,\s*2\.4vw,\s*32px\)\s+clamp\(18px,\s*2\.8vw,\s*40px\)/,
  'The users route should keep an intentional responsive inset around its command deck.',
);

assert.match(
  adminMonitoringStyleSource,
  /\.admin-command-route--users \.admin-users-command-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.16fr\)\s+minmax\(280px,\s*0\.84fr\)/,
  'The users route should use the compact profile-style split command card.',
);

assert.match(
  adminMonitoringStyleSource,
  /\.admin-command-route--users \.admin-users-command-kpis\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  'The users route should keep its operational signals in a four-card profile grid.',
);

assert.match(
  translationsSource,
  /users_command_title/,
  'Dashboard translations should include the users command-center copy keys.',
);

console.log('[PASS] Dashboard users command-center guardrails passed.');
