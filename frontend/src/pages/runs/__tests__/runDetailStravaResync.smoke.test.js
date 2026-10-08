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
assert.match(source, /run\.provider === 'STRAVA' && \(\s*<button type="button" className="run-detail-v2__btn" disabled=\{syncDisabled\} onClick=\{handleResync\}>[\s\S]*?\{syncBtnText \|\| t\('run_detail\.resync_strava'\)\}/, 'The v2 Strava resync control should remain a non-submit button wired to its handler, disabled state, and localized status.');

const refreshStart = source.indexOf('async function refreshRunFromActivities()');
const pollStart = source.indexOf('async function pollRunDetailStravaSyncCompletion()');
assert.ok(refreshStart >= 0 && pollStart > refreshStart && handlerStart > pollStart, 'Resync should retain its refresh and completion-polling helpers.');
const refresh = source.slice(refreshStart, pollStart);
const poll = source.slice(pollStart, handlerStart);

assert.match(handler, /setSyncDisabled\(true\);\s*setSyncBtnText\(t\('run_detail\.syncing'\)\)/, 'Resync should disable repeated requests and show progress before starting.');
assert.match(handler, /if \(!res\.ok\)[\s\S]*?setSyncBtnText\(t\('run_detail\.sync_failed'\)\)/, 'A rejected sync request should retain failure feedback.');
assert.match(handler, /syncStatus\?\.status === 'FAILED'[\s\S]*?setSyncBtnText\(t\('run_detail\.sync_failed'\)\)/, 'A failed background sync should retain failure feedback.');
assert.match(handler, /finally\s*\{[\s\S]*?setSyncDisabled\(false\);\s*setSyncBtnText\(''\)/, 'Resync should re-enable its control after completion or failure.');
assert.match(poll, /while \(Date\.now\(\) < deadlineMs\)\s*\{\s*await waitWhileDocumentHidden\(\)/, 'Completion polling should remain bounded and pause while the page is hidden.');
assert.match(poll, /if \(syncStatus\?\.status === 'COMPLETED'\)\s*\{\s*await refreshRunFromActivities\(\)/, 'Only successful completion should refresh the run and recent-history window.');
assert.match(refresh, /invalidateResourceCache\('\/api\/activities\?limit=30'\)[\s\S]*?const \[matchedRun, activities\] = await Promise\.all\(/, 'The actual completion refresh should invalidate cache before parallel reloads.');
assert.match(refresh, /setRun\(matchedRun\);[\s\S]*?sessionStorage\.setItem\('hermes_selected_run', JSON\.stringify\(matchedRun\)\)/, 'The refreshed activity should update both the displayed run and selected-run session cache.');
assert.match(refresh, /setRecentRuns\(activities\.filter\([\s\S]*?String\(activity\.id\) !== String\(id\)/, 'The refreshed comparison window should exclude the selected run.');

console.log('[PASS] Run Detail Strava resync guard passed.');
