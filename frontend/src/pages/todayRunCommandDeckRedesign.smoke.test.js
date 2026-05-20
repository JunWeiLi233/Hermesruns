import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'TodayRun.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/style.css'), 'utf8');

assert.match(
  pageSource,
  /today-run-plan-page today-run-command-page/,
  'Today Run should expose the command-page class used by the redesigned command deck.',
);

assert.match(
  pageSource,
  /today-run-plan-hero today-run-command-hero/,
  'Today Run hero should opt into the redesigned command hero layer.',
);

assert.match(
  pageSource,
  /today-run-plan-hero-panel today-run-command-readiness-panel/,
  'Today Run readiness panel should opt into the redesigned command readiness treatment.',
);

assert.match(
  pageSource,
  /today-run-plan-grid today-run-command-grid/,
  'Today Run lower plan grid should opt into the redesigned command grid.',
);

assert.match(
  styleSource,
  /\/\* Today Run command deck redesign final override \*\//,
  'Today Run should include the final command deck redesign override block.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.runner-shell-canvas\.today-run-command-canvas\s*\{[\s\S]*width:\s*min\(1560px,[\s\S]*max-width:\s*none !important;/,
  'Today Run command canvas should use a wide editorial workspace instead of a cramped default shell.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-coaching-strip-inner\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*1\.3fr\)\s*repeat\(4,\s*minmax\(140px,\s*0\.8fr\)\) !important;/,
  'Today Run coaching strip should become a command-decision rail.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-command-hero\s*\{[\s\S]*min-height:\s*clamp\(640px,\s*62vw,\s*840px\);[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.06fr\)\s*minmax\(380px,\s*0\.94fr\) !important;/,
  'Today Run hero should use the large two-column command deck composition.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-command-readiness-panel::before\s*\{[\s\S]*conic-gradient/,
  'Today Run readiness panel should render the conic readiness instrument.',
);

assert.match(
  styleSource,
  /\.today-run-command-page \.today-run-plan-step-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(210px,\s*1fr\)\)/,
  'Today Run workout blueprint should become a responsive phase grid.',
);

assert.match(
  styleSource,
  /body:is\(\.theme-light, \.theme-high-contrast-light\) \.today-run-command-page\s*\{[\s\S]*linear-gradient\(180deg,\s*#fbf7f1/,
  'Today Run command deck should keep a dedicated light-mode gallery treatment.',
);

console.log('[PASS] Today Run command deck redesign guard passed.');
