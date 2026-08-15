import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const analysisSource = readFileSync(path.join(here, 'Analysis.jsx'), 'utf8');

assert.doesNotMatch(
  analysisSource,
  /data-testid="analysis-heat-context"/,
  'Analysis should no longer render the removed heat-adaptation panel.',
);

assert.doesNotMatch(
  analysisSource,
  /apiJson\('\/api\/v1\/weather\/context'/,
  'Analysis should not request weather context for a removed panel.',
);

assert.doesNotMatch(
  analysisSource,
  /analysis-heat-context/,
  'Analysis should not retain heat-adaptation panel markup after removal.',
);

console.log('Analysis heat-adaptation panel removal guard passed.');
