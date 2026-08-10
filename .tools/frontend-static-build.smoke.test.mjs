import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const buildSource = readFileSync(path.join(here, '../frontend/scripts/run-vite-build.mjs'), 'utf8');

assert.match(
  buildSource,
  /copyDirectory\(buildAssetsDir, backendAssetsDir\)/,
  'Frontend publishing should retain immutable hashed assets from prior builds.',
);

assert.doesNotMatch(
  buildSource,
  /emptyDirectory\(backendAssetsDir\)/,
  'Frontend publishing must not delete hashed assets that an older cached index can still reference.',
);

console.log('[PASS] Frontend static publish keeps cached hashed assets available.');
