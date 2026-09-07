import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/_split/schedule.css'), 'utf8');

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\.schedule-plan-hero h1\s*\{[\s\S]*?font-size:\s*clamp\(1\.8rem,\s*9vw,\s*2\.25rem\);/,
  'The mobile Schedule title should stay readable without consuming most of the first fold.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\.schedule-plan-hero-summary\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
  'The mobile Schedule summary should use a compact two-column grid.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\.schedule-plan-bottom-grid,[\s\S]*?\.schedule-plan-route-content\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/,
  'Schedule lower-page rails and route content should stay within the mobile canvas.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?#root \.schedule-plan-page \.schedule-plan-bottom-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important;\s*\}/,
  'The mobile Schedule bottom grid should override later important desktop tracks with one shrinkable column.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\.schedule-plan-route-card\s*\{[\s\S]*?min-width:\s*min\(100%,\s*280px\);/,
  'The mobile route card should retain a useful map width while staying bounded by its container.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*640px\)[\s\S]*?\.schedule-plan-watch-btn\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?width:\s*100%;[\s\S]*?box-sizing:\s*border-box;/,
  'The mobile route action should remain a full-width, contained touch target.',
);

console.log('[PASS] Schedule mobile containment guard passed.');
