import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const kineticStyleSource = readFileSync(
  path.join(here, '../styles/admin-kinetic-editorial.css'),
  'utf8',
);

// DV-2026-08-15-29 — the overview renders a queue-health card grid under the
// metric strip: one white stat card per queue count, tone dot for attention.
assert.match(
  dashboardSource,
  /ops-queue-grid[\s\S]*?queueCards\.slice\(0, 4\)[\s\S]*?ops-queue-card__value[\s\S]*?ops-queue-card__label/,
  'Overview should render a 4-card queue stat grid.'
);
assert.match(
  dashboardSource,
  /ops-queue-card\$\{card\.count > 0 \? ' is-attention' : ''\}/,
  'Queue cards should flag attention when a count is non-zero.'
);

assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-queue-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(170px, 1fr\)\)/,
  'Queue stat cards should lay out in a responsive auto-fit grid.'
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-queue-card\s*\{[^}]*border-radius:\s*18px[^}]*var\(--admin-profile-card/,
  'Queue cards should use the profile card surface tokens.'
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-queue-card\.is-attention \.ops-queue-card__dot\s*\{[^}]*#f07561/,
  'Attention cards should switch the tone dot to the coral accent.'
);

// DV-2026-08-16 — overview quick-nav tiles and metric cards ride the rework
// card system: 18px radius on the profile-card tokens, circular icon chips.
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-action-card\s*\{[^}]*var\(--admin-profile-card[^}]*border-radius:\s*18px/,
  'Quick-nav tiles should use the rework card surface and radius.',
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-action-card-icon\s*\{[^}]*border-radius:\s*999px/,
  'Quick-nav icon chips should be circular.',
);
assert.match(
  kineticStyleSource,
  /\.dashboard-body\.admin-command-page \.ops-metric-card\s*\{[^}]*var\(--admin-profile-card[^}]*border-radius:\s*18px/,
  'Metric toggle cards should use the rework card surface and radius.',
);
