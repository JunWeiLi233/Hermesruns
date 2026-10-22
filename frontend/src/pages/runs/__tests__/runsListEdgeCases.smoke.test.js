// BUG-007, BUG-008, BUG-009, BUG-011: the Runs list and runs it should not mishandle (the behaviour is exercised in the browser by
// e2e/specs/22-f01-runs-list.spec.ts; this pins the pieces that make it so).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relative) => readFileSync(path.join(srcRoot, relative), 'utf8');
const runs = read('pages/runs/Runs.jsx');
assert.match(read('utils/timeZone.js'), /if \(!key\) return new Date\(NaN\)/);
const en = read('i18n/locales/en/pages.js');
const zh = read('i18n/locales/zh-CN/pages.js');

// A run whose file had no timestamps has no start time: not 1 January 1970 (that was "December 1969" for a runner west of Greenwich).
assert.match(runs, /const runDate = \(r\) => getActivityCalendarDate\(r\);/, 'a run with no start time has an invalid date');
assert.doesNotMatch(runs, /r\.startTime \|\| r\.startDate \|\| 0/, 'no run is dated to the Unix epoch');
assert.match(runs, /const UNDATED_KEY = 'undated';/);
assert.match(runs, /t\('runs\.undated_group'\)/, 'runs with no date are listed under a name of their own');
assert.match(runs, /groups\.sort\(\(a, b\) => Number\(a\.key === UNDATED_KEY\) - Number\(b\.key === UNDATED_KEY\)\)/, 'and after every month');
assert.match(runs, /const hasTime = movingTimeSeconds > 0;/);
assert.match(runs, /const paceText = hasTime && distanceKm > 0 \? formatPace\(distanceKm, movingTimeSeconds, lang\) : '--';/, 'no time means no pace, not 0:00');

// Sorting by pace: the real distance, and a run with no moving time has no pace and goes last.
assert.doesNotMatch(runs, /Math\.max\(0\.1, Number\(a\.distanceKm/, 'a 60 m run is not stretched to 100 m before its pace is worked out');
assert.match(runs, /return km > 0 && seconds > 0 \? seconds \/ km : Number\.POSITIVE_INFINITY;/);

// The line above the title is about the connection, and says so when there are runs but no Strava link.
assert.match(runs, /t\(allRuns\.length > 0 \? 'runs\.status_files_only' : 'runs\.awaiting_status_disconnected'\)/);

// One run is "1 run".
assert.match(runs, /t\(group\.count === 1 \? 'runs\.count_label_one' : 'runs\.count_label', \{ count: group\.count \}\)/);

for (const [name, source] of [['en', en], ['zh-CN', zh]]) {
  for (const key of ['count_label_one', 'undated_group', 'status_files_only']) {
    assert.match(source, new RegExp(`"${key}":`), `${name} has runs.${key}`);
  }
}
assert.match(en, /"count_label_one": "\{count\} run",/);

console.log('runs list edge cases: ok');
