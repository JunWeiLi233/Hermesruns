import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const finalCss = readFileSync(path.join(here, '../styles/grid-cards-white.css'), 'utf8');

assert.match(
  finalCss,
  /#root \.admin-command-page \.admin-command-route--shoes \.admin-shoe-rework__card--catalog > \.action-bar > input\.admin-shoe-filter\s*\{[\s\S]*?border:\s*0 !important[\s\S]*?box-shadow:\s*none !important/,
  'The dashboard/shoes catalog search input should not render a visible border strip.',
);

console.log('[PASS] Dashboard shoes search input has no visible border strip.');
