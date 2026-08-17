import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const kineticCss = readFileSync(path.join(here, '../styles/admin-kinetic-editorial.css'), 'utf8');

// DV-2026-08-15-33 — the shoes tab uses the Profile-style rework cards: hero
// with stat chips, controls card, workbench grid, catalog/saved cards, and
// the soft-pill button system.
assert.match(
  dashboardSource,
  /admin-shoe-rework__hero[\s\S]*?shoe_stitch_title[\s\S]*?admin-shoe-rework__hero-meta[\s\S]*?shoeRepositorySync\}%/,
  'Shoes hero should carry the title plus pending/live/records/sync stat chips.',
);
assert.match(
  dashboardSource,
  /admin-shoe-rework__card--controls[\s\S]*?admin-shoe-rework__inputs[\s\S]*?admin-shoe-rework__actions[\s\S]*?btn_add_shoe/,
  'Shoes controls card should hold search/filter inputs plus the save/export/add actions.',
);
assert.match(
  dashboardSource,
  /admin-shoe-rework__grid[\s\S]*?admin-shoe-workbench--stitch[\s\S]*?admin-shoe-rework__card--catalog[\s\S]*?catalog_title/,
  'Shoes workbench grid and catalog card should keep their data blocks inside the rework cards.',
);
assert.doesNotMatch(
  dashboardSource,
  /admin-shoe-stitch-hero__stats|admin-shoe-stitch-health-card/,
  'The old hero stats block and floating health card should stay removed.',
);

assert.match(
  kineticCss,
  /\.admin-command-page \.admin-shoe-rework \.btn-secondary\.btn-inline-md\s*\{[^}]*border:\s*0 !important[^}]*!important/,
  'Shoes rework secondary buttons should use the soft-pill system with important overrides.',
);

// DV-2026-08-15-34 — shoe feature-card actions are compact pills (the old
// full-width 14px-radius grid buttons are gone), covering the delete button.
assert.match(
  kineticCss,
  /\.admin-command-page \.admin-shoe-rework \.admin-shoe-stitch-feature-card__actions > button\s*\{[^}]*width:\s*auto !important[^}]*border-radius:\s*999px !important/,
  'Shoe feature-card action buttons should be compact auto-width pills.',
);
