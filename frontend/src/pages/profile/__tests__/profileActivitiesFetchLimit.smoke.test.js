import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../ProfileDashboard.jsx'), 'utf8');

assert.match(src, /const PROFILE_ACTIVITIES_FETCH_LIMIT = DASHBOARD_CACHE_RUN_LIMIT/);
assert.equal(
  (src.match(/apiJson\(`\/api\/activities\?limit=\$\{PROFILE_ACTIVITIES_FETCH_LIMIT\}`\)/g) || []).length,
  2,
);
assert.doesNotMatch(src, /apiJson\('\/api\/activities'\)/);
console.log('profileActivitiesFetchLimit.smoke.test.js OK');
