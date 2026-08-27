import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/admin-kinetic-editorial.css'), 'utf8');
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');

assert.match(
  dashboardSource,
  /className="btn-primary btn-inline-md admin-settings-studio__logout"[\s\S]*dashboard\.nav_logout/,
  'Dashboard settings should keep the scoped logout button hook and label.',
);

const logoutRule = styleSource.match(/\.dashboard-body\.admin-command-page \.admin-settings-studio__logout\s*\{([^}]*)\}/)?.[1];
assert.ok(logoutRule, 'Admin settings logout should have a dedicated surface rule.');
assert.match(logoutRule, /clip-path:\s*none\s*!important/, 'Logout should not use the global cut-corner clip.');
assert.match(logoutRule, /border-radius:\s*var\(--radius-md,\s*12px\)\s*!important/, 'Logout should use the rounded admin-login border radius.');

console.log('[PASS] Admin logout button surface guard passed.');
