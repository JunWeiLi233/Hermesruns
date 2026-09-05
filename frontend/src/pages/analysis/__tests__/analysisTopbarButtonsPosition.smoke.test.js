import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../styles/analysis-summary.css'), 'utf8');
const legacyStyleSource = readFileSync(path.join(here, '../../styles/style.css'), 'utf8');

assert.match(
  styleSource,
  /#root \.analysis-page-shell > \.runner-shell-main > \.runner-shell-topbar\s*\{(?=[\s\S]*?left:\s*var\(--runner-nav-collapsed-width,\s*96px\)\s*!important;)(?=[\s\S]*?right:\s*0\s*!important;)(?=[\s\S]*?width:\s*auto\s*!important;)/,
  'The Analysis topbar should size between its fixed left and right edges without overflowing the viewport.',
);

assert.match(
  styleSource,
  /#root \.analysis-page-shell \.runner-shell-topbar-actions\s*\{[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?min-width:\s*max-content\s*!important;/,
  'The Analysis topbar action group should reserve space for all three controls.',
);

assert.match(
  legacyStyleSource,
  /#root \.analysis-page-shell > \.runner-shell-main > \.runner-shell-topbar\s*\{(?=[\s\S]*?left:\s*var\(--runner-nav-collapsed-width,\s*96px\)\s*!important;)(?=[\s\S]*?right:\s*0\s*!important;)(?=[\s\S]*?width:\s*auto\s*!important;)/,
  'The legacy Analysis topbar should size between its fixed left and right edges.',
);

assert.match(
  legacyStyleSource,
  /#root \.analysis-page-shell \.runner-shell-topbar-actions\s*\{[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?min-width:\s*max-content\s*!important;/,
  'The legacy Analysis action group should reserve space for all three controls.',
);

console.log('[PASS] Analysis topbar button positioning guard passed.');
