import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rewardBadgesSource = readFileSync(path.join(here, 'rewardBadges.jsx'), 'utf8');

assert.match(
  rewardBadgesSource,
  /if \(sortedWeeks\[0\] !== currentWeek\) return 0;/,
  'Weekly reward streaks should reset when the most recent run is not in the current week.',
);

assert.doesNotMatch(
  rewardBadgesSource,
  /diffWeeksFromCurrent > 1/,
  'Reward streak logic should not keep a stale weekly streak alive after an idle week.',
);

console.log('[PASS] Reward badges weekly streak smoke test passed.');
