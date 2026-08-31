import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, relativePath), 'utf8');
const appSource = read('../styles/app.css');
const muscleTrainingSource = read('../styles/_split/muscle-training.css');
const actionListSource = read('../styles/muscle-training-action-list.css');

const baseListIndex = muscleTrainingSource.indexOf('.mt-top-action-list {');
const stretchBlockIndex = actionListSource.lastIndexOf(
  '@media (min-width: 961px) {\n  #root .runner-dashboard-page[data-muscle-theme]:has(.mt-top-workbench) .mt-top-actions-card',
);

assert.ok(
  appSource.indexOf("@import './muscle-training-action-list.css';") > appSource.indexOf("@import './all-pages-liquid-glass.css';"),
  'The final action-list rules must load after the shared surface rules.',
);
assert.ok(
  baseListIndex >= 0 && stretchBlockIndex >= 0,
  'The desktop action-list stretch block must be present after the base list.',
);
assert.match(
  actionListSource.slice(stretchBlockIndex, stretchBlockIndex + 760),
  /\.mt-top-actions-card\s*\{[\s\S]*height:\s*100% !important;[\s\S]*min-height:\s*0;[\s\S]*\.mt-top-action-list\s*\{[\s\S]*flex:\s*1 1 auto;[\s\S]*min-height:\s*0;[\s\S]*max-height:\s*none;[\s\S]*grid-auto-rows:\s*minmax\(86px,\s*1fr\);[\s\S]*align-content:\s*stretch;/,
  'Desktop action cards should fill their grid cell and distribute the list rows through the available height.',
);
assert.match(
  actionListSource.slice(stretchBlockIndex, stretchBlockIndex + 900),
  /\.mt-top-action-card\s*\{[\s\S]*height:\s*100%;[\s\S]*box-sizing:\s*border-box;/,
  'Desktop action rows should stretch to the grid tracks instead of staying content-sized.',
);

console.log('[PASS] Muscle Training top-action list stretch guardrails passed.');
