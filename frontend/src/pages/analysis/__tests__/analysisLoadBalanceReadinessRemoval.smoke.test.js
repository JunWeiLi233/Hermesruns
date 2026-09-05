import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');

assert.doesNotMatch(
  detailSource,
  /className="analysis-load-profile-readiness"/,
  'Load Balance should not render the redundant header readiness block.',
);
assert.doesNotMatch(
  detailSource,
  /className="analysis-load-profile-ring"/,
  'Load Balance should not render the redundant header ACWR ring.',
);

console.log('[PASS] Load Balance header readiness removal guard passed.');
