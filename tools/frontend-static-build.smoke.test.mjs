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

assert.match(
  buildSource,
  /function isLockedDirectoryRenameError\(error\)/,
  'Frontend publishing should recognize Windows directory-lock errors during the live static swap.',
);

assert.match(
  buildSource,
  /failedOperation\.code = lastError\?\.code/,
  'Retried filesystem errors should retain their OS error code for lock-aware recovery.',
);

assert.match(
  buildSource,
  /Live static directory swap is locked; falling back to an in-place file sync\./,
  'Frontend publishing should fall back to an in-place sync when Windows blocks the live directory rename.',
);

console.log('[PASS] Frontend static publish keeps cached hashed assets available.');
