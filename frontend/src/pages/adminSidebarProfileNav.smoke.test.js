import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, 'Dashboard.jsx'), 'utf8');
const kineticStyleSource = readFileSync(
  path.join(here, '../styles/admin-kinetic-editorial.css'),
  'utf8',
);

// The admin sidebar must keep the Profile-page navigation design: single-label
// pill links (icon + label + tiny index), the runner brand-copy block, and the
// gradient footer CTA — not the old kinetic two-line rows.
assert.match(
  dashboardSource,
  /ops-sidebar-brand-copy[\s\S]*?HermesLogo[\s\S]*?sidebar_brand_sub/,
  'Sidebar brand should use the profile-style brand-copy block (logo + uppercase subtitle).',
);

assert.match(
  dashboardSource,
  /ops-sidebar-link-label">\{t\(tab\.labelKey\)\}/,
  'Nav items should render one label per pill like the profile sidebar.',
);

assert.doesNotMatch(
  dashboardSource,
  /admin-command-sidebar__nav-copy/,
  'The old kinetic two-line nav copy should not come back.',
);

assert.match(
  dashboardSource,
  /admin-command-sidebar__nav-index" aria-hidden="true"/,
  'Nav pills keep the profile-style tiny index number as a presentational span.',
);

assert.match(
  dashboardSource,
  /link--logout ops-sidebar-cta"/,
  'The footer logout should carry the gradient CTA treatment.',
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \{\s*--admin-nav-ink:/,
  'Admin nav tokens should be defined on the admin page scope.',
);

assert.match(
  kineticStyleSource,
  /body\.theme-midnight \.dashboard-body\.admin-command-page,\s*\nbody\.theme-high-contrast \.dashboard-body\.admin-command-page \{\s*--admin-nav-ink: #fff7ef;/,
  'Midnight/high-contrast must redefine the nav tokens so pills stay readable on dark.',
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-sidebar-link\.is-active \{[^}]*radial-gradient\(circle at 100% 0%, var\(--admin-nav-active-soft\)/s,
  'Active pills should keep the profile radial-gradient treatment.',
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-sidebar-cta \{[^}]*linear-gradient\(135deg, #c94e3d, #a0392a\)/s,
  'Footer CTA should keep the profile gradient pill.',
);

console.log('[PASS] Admin sidebar profile-nav guardrails passed.');
