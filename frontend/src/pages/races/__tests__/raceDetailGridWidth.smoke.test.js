import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styleSource = readFileSync(path.join(here, "../../../styles/_split/races.css"), 'utf8');

assert.match(
  styleSource,
  /\.race-detail-layout\s*\{[\s\S]*?width:\s*min\(100%,\s*1280px\);[\s\S]*?margin:\s*0 auto;/,
  'Race detail grids should use the wider desktop content frame.',
);
assert.match(
  styleSource,
  /@media \(max-width:\s*820px\)[\s\S]*?\.race-detail-layout\s*\{[\s\S]*?padding:\s*20px 16px 88px;/,
  'Race detail mobile spacing should remain unchanged while widening desktop grids.',
);

console.log('[PASS] Race detail grid width guardrails passed.');
