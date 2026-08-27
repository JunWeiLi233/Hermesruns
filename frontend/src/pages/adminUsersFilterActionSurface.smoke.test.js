import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const adminCss = readFileSync(path.join(here, '../styles/_split/admin.css'), 'utf8');
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /className="admin-users-command-console__filters"[\s\S]*btn-secondary btn-inline-md[\s\S]*dashboard\.btn_refresh[\s\S]*dashboard\.btn_save_filter[\s\S]*dashboard\.btn_export_csv/,
  'The users filter toolbar should contain the three requested actions.',
);
assert.match(
  adminCss,
  /\.admin-command-page \.admin-command-route--users \.admin-users-command-console__filters > \.btn-secondary\.btn-inline-md\s*\{[\s\S]*?border:\s*1px solid #[0-9a-f]{6}\s*!important;[\s\S]*?background:\s*#[0-9a-f]{6}\s*!important;/i,
  'Users filter actions should have a visible border and light-grey surface.',
);

console.log('[PASS] Users filter actions use a bordered light-grey surface.');
