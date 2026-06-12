import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rewardBadgesSource = readFileSync(path.join(here, 'rewardBadges.jsx'), 'utf8');
const rewardsPageSource = readFileSync(path.join(here, '..', 'pages', 'Rewards.jsx'), 'utf8');

assert.match(
  rewardBadgesSource,
  /buildCatalogRewardEntries\(runs,\s*lang\)/,
  'buildRewardShowcase should include the 100 additional catalog rewards.',
);

assert.match(
  rewardsPageSource,
  /allRewards\.map\(\(reward\)/,
  'Rewards page should render the full badge catalog instead of only earned and top upcoming rewards.',
);

assert.match(
  rewardsPageSource,
  /rewards-progress-card-grid--catalog/,
  'Rewards page should give the full badge catalog its own grid treatment.',
);

console.log('[PASS] Rewards catalog integration smoke test passed.');
