import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, '../../../styles/_split/analysis.css'), 'utf8');
const typographyBlock = styleSource.slice(styleSource.indexOf('Analysis load-balance typography parity'));

assert.match(
  typographyBlock,
  /\.analysis-page-shell\.analysis-page-shell \.analysis-profile-reference-card\.is-load \.analysis-overview-card-kicker--load\s*\{[^}]*font-family:\s*"Manrope",\s*var\(--font-display\)\s*!important;/,
  'The 负荷平衡 label should use the same Manrope display family as the VO2max title.',
);

console.log('[PASS] Analysis load-balance font family guard passed.');
