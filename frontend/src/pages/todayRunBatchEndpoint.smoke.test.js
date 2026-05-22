import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'TodayRun.jsx'), 'utf8');

assert.match(
  pageSource,
  /apiJson\('\/api\/today\/dashboard'\)/,
  'Today Run should request the new batch endpoint first.',
);

assert.match(
  pageSource,
  /apiJson\('\/api\/profile\/me'\)[\s\S]*apiJson\('\/api\/shoes'\)/s,
  'Today Run should keep the individual endpoint fallback path.',
);

console.log('[PASS] Today Run batch endpoint guard passed.');
