import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'RacesDetail.jsx'), 'utf8');

assert.doesNotMatch(
  pageSource,
  /className="race-detail-course-footnote"/,
  'Race detail should remove the bottom course footnote text block.',
);

assert.match(
  pageSource,
  /className="race-detail-course-axis"/,
  'Removing the footnote should preserve the elevation axis.',
);

console.log('[PASS] Race detail course footnote removal guardrails passed.');
