import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, "../../../styles/_split/muscle-training.css"), 'utf8');

assert.match(
  styleSource,
  /\.mt-top-actions-card\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*100%;/,
  'The top action card should stretch to the available workbench row height.',
);

assert.match(
  styleSource,
  /\.mt-top-action-list\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?max-height:\s*none;/,
  'The action list should fill the card instead of using a fixed max-height.',
);

assert.doesNotMatch(
  styleSource,
  /\.runner-dashboard-page:has\(\.mt-top-workbench\) \.mt-top-action-list\s*\{\s*max-height:\s*190px;/,
  'The compact workbench layer should not restore a fixed action-list cap.',
);

console.log('[PASS] Muscle Training action grid expansion guardrails passed.');
