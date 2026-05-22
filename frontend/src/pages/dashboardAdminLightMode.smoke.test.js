import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-command-topbar\s*\{/,
  'Admin portal should define a theme-light treatment for the shared admin topbar shell.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-command-sidebar\s*\{/,
  'Admin portal should define a theme-light treatment for the shared admin sidebar shell.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-hud__hero\s*\{/,
  'Admin overview should define a theme-light treatment for the HUD hero.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-hud__metric\s*\{/,
  'Admin overview metrics should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-track-card\s*\{/,
  'Admin overview track card should define a theme-light treatment instead of staying in the dark palette.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-card--table,/,
  'Admin overview table card should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-card--gallery,/,
  'Admin overview gallery card should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-overview-card--audit\s*\{/,
  'Admin overview audit card should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-track-hub-hero\s*\{/,
  'Admin course-map workspace should define a theme-light treatment for the track hub hero.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-track-hub-footer-verdict\s*\{/,
  'Admin course-map workspace should define a theme-light treatment for the footer verdict bar instead of leaving it in the dark palette.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-coursemap-rail__item\s*\{/,
  'Admin course-map rail items should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-shoe-workbench--stitch \.admin-shoe-workbench__queue,/,
  'Admin shoe workbench should define a theme-light treatment instead of staying in the dark-only palette.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-shoe-stitch-hero\s*\{/,
  'Admin shoe stitch hero should define a theme-light treatment.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-settings-studio__hero\s*\{/,
  'Admin settings should define a theme-light treatment for its control-room hero.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-users-command-hero\s*\{/,
  'Admin users command center should define a theme-light treatment for its roster hero.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-users-command-console,/,
  'Admin users command center should define a theme-light treatment for its console and roster surfaces.',
);

assert.match(
  styleSource,
  /body\.theme-light \.admin-command-page \.admin-users-roster-board__table-wrap\.data-table-wrap\s*\{/,
  'Admin users roster board should define a theme-light treatment for the table shell.',
);

console.log('[PASS] Dashboard admin light-mode guardrails passed.');
