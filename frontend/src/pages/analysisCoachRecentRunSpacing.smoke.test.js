import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(path.join(here, '../styles/_split/analysis.css'), 'utf8');

assert.match(
  styles,
  /\.analysis-insight-detail-page\.is-coach-insight \.analysis-coach-command-session-list\s*\{[\s\S]*?gap:\s*10px;/,
  'Coach Insight recent runs should keep visible vertical spacing between session rows.',
);

console.log('[PASS] Coach recent-run spacing guard passed.');
