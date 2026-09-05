import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../RunDetail.jsx"), 'utf8');
const handlerStart = source.indexOf('async function handleResync()');
const handlerEnd = source.indexOf('\n  async function handleShare', handlerStart);
const handler = source.slice(handlerStart, handlerEnd);

assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'Run Detail should keep a dedicated Strava resync handler.');
assert.match(handler, /apiFetch\('\/api\/strava\/sync'\)/, 'Resync should trigger the authenticated Strava sync endpoint.');
assert.match(handler, /await pollRunDetailStravaSyncCompletion\(\)/, 'Resync should wait for the background sync to finish before refreshing the detail data.');
assert.match(source, /async function pollRunDetailStravaSyncCompletion\(\)/, 'Run Detail should poll the sync-status endpoint for manual resync completion.');
assert.match(source, /apiJson\('\/api\/auth\/strava\/sync-status'\)/, 'Manual resync polling should use the authenticated sync-status endpoint.');
assert.match(source, /invalidateResourceCache\('\/api\/activities\?limit=30'\)/, 'Completed resync should invalidate the cached recent-activities window before reloading the selected run.');
assert.match(source, /const \[matchedRun, activities\] = await Promise\.all\(/, 'Completed resync should refresh the selected run and the recent-run window in parallel.');
assert.match(source, /apiJson\(`\/api\/activities\?id=\$\{id\}`\)/, 'Completed resync should reload the selected run through the single-activity endpoint instead of the full history.');
assert.match(source, /<button type="button" className="run-detail-action-btn"/, 'The resync control should remain a non-submit button.');

console.log('[PASS] Run Detail Strava resync guard passed.');
