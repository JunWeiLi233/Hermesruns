import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'ProfileDashboard.jsx'), 'utf8');

assert.match(
  pageSource,
  /apiJson\('\/api\/profile\/dashboard'\)/,
  'Profile dashboard should request the new batch endpoint first.',
);

assert.match(
  pageSource,
  /apiJson\('\/api\/profile\/me'\)[\s\S]*apiJson\('\/api\/activities'\)/s,
  'Profile dashboard should keep the individual endpoint fallback path.',
);


assert.match(
  pageSource,
  /if \(dashboardData\.deferredEnrichment\)[\s\S]*loadProfileDashboardFallbackEnrichmentData\(\)/,
  'Profile dashboard should lazy-load optional batch enrichment when deferredEnrichment is true.',
);
console.log('[PASS] Profile dashboard batch endpoint guard passed.');
