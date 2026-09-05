import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const kineticStyleSource = readFileSync(
  path.join(here, "../../../styles/admin-kinetic-editorial.css"),
  'utf8',
);

// DV-2026-08-15-27 — the accounts table caps at 5 rows per page and pages
// with circular arrow buttons (neutral prev, red-accent next).
assert.ok(
  dashboardSource.includes('const USERS_TABLE_PAGE_SIZE = 5;'),
  'Users table should pin a 5-row page size constant.'
);
assert.match(
  dashboardSource,
  /size: String\(USERS_TABLE_PAGE_SIZE\)/,
  'loadUsers should send the 5-row page size to the backend.'
);

assert.match(
  dashboardSource,
  /pagination-row pagination-row--arrows[\s\S]*?pagination-arrow[\s\S]*?pagination-arrow--next/,
  'Pagination should render prev/next arrow buttons with the arrow variant.'
);
assert.match(
  dashboardSource,
  /aria-label=\{t\('dashboard\.pagination_prev'\)\}/,
  'Arrow buttons should keep accessible labels.'
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.pagination-arrow\s*\{[^}]*border-radius:\s*999px/,
  'Arrow pager buttons should be circular.'
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.pagination-arrow--next\s*\{[^}]*linear-gradient\(135deg, #c94e3d, #a0392a\)/,
  'Next arrow should carry the red accent gradient.'
);
