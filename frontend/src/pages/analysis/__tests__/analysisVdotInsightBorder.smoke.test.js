import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../../styles/grid-cards-white.css'), 'utf8');

assert.match(
  styles,
  /#root \.analysis-page-shell \.analysis-overview-card--vdot-insight\s*\{[^}]*border:\s*0\s*!important;/,
  'The Analysis VDOT trend insight card should sit on the grid without an outer border.',
);

console.log('[PASS] Analysis VDOT insight border guard passed.');
