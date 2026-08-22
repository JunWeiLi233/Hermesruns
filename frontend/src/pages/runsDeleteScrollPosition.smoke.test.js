import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./Runs.jsx', import.meta.url), 'utf8');

const visibleCountReset = source.match(
  /useEffect\(\(\) => \{\s*setVisibleRunsCount\(RECENT_RUNS_INITIAL_VISIBLE_COUNT\);\s*\}, \[([^\]]*)\]\);/,
);

assert.ok(visibleCountReset, 'Runs must keep an explicit visible-history reset for filter and sort changes');
assert.doesNotMatch(
  visibleCountReset[1],
  /allRuns\.length/,
  'deleting a run must not collapse the expanded history back to the initial three cards',
);

assert.match(
  source,
  /const deleteScrollPosition = captureRunsScrollPosition\(window\);/,
  'the delete flow must snapshot the current Runs viewport before mutating the list',
);
assert.match(
  source,
  /setDeleteTarget\(null\);\s*restoreRunsScrollPosition\(window, deleteScrollPosition\);/,
  'the delete flow must restore the Runs viewport after closing the confirmation modal',
);

console.log('runs delete scroll-position smoke test passed');
