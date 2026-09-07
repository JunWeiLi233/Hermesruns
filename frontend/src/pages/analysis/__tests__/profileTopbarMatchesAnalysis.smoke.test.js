import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/analysis-summary.css'), 'utf8');

assert.match(
  styleSource,
  /#root \.analysis-page-shell > \.runner-shell-main > \.runner-shell-topbar\s*\{[\s\S]*?height:\s*88px\s*!important;[\s\S]*?position:\s*fixed\s*!important;[\s\S]*?padding:\s*0 42px\s*!important;[\s\S]*?background:\s*#f5f5f7\s*!important;/,
  'Analysis should retain its own 88px fixed topbar treatment.',
);

assert.match(
  styleSource,
  /#root \.analysis-page-shell \.runner-shell-topbar-actions\s*\{[\s\S]*?flex:\s*0 0 auto\s*!important;[\s\S]*?min-width:\s*max-content\s*!important;/,
  'Analysis topbar actions should reserve space for all controls.',
);

console.log('[PASS] Analysis topbar isolation guard passed.');
