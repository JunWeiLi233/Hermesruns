import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDetailSource = readFileSync(path.join(here, 'RunDetail.jsx'), 'utf8');
const lightThemeStyles = readFileSync(path.join(here, '../styles/_split/light-theme-overrides.css'), 'utf8');

assert.match(
  runDetailSource,
  /className=\{`shoe-run-option\$\{/,
  'Run detail should render selectable shoes with the shared shoe-run-option class.',
);

assert.match(
  lightThemeStyles,
  /body\.theme-light \.run-detail-dropdown \.shoe-run-option,[\s\S]*?\{\s*background:\s*#eef0f1;/,
  'Shoe selection options should use a light-grey surface in the light theme.',
);

console.log('[PASS] Shoe selection option light-surface guardrail passed.');
