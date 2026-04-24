import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const runsSource = readFileSync(path.join(here, 'Runs.jsx'), 'utf8');

assert.match(
  runsSource,
  /function RoutePreviewThumb\(\{ preview, provider, runName \}\)/,
  'Runs route thumbnails should consume a preview model instead of requiring the full raw point list every time.',
);

assert.match(
  runsSource,
  /run\.routePreview/,
  'Runs page should use the server-provided cached route preview from the activities feed.',
);

assert.match(
  runsSource,
  /const routePreviewRuns = visibleRuns\.filter\(\(run\) => !run\.routePreview\);/,
  'Runs page should only fall back to point fetches for visible runs that still lack a cached preview.',
);

assert.doesNotMatch(
  runsSource,
  /RoutePreviewThumb points=\{routePreviewPoints\[run\.id\] \|\| \[\]\}/,
  'Runs page should not keep rendering thumbnails only from raw point-array fallback state when a cached preview exists.',
);

console.log('[PASS] Runs route preview cache guardrails passed.');
