import assert from 'node:assert/strict';

import {
  EXTRA_REWARD_DEFINITIONS,
  buildCatalogRewardEntries,
  getCatalogRewardStats,
} from './rewardCatalog.js';

assert.equal(
  EXTRA_REWARD_DEFINITIONS.length,
  100,
  'Rewards page should define exactly 100 additional catalog rewards.',
);

assert.equal(
  new Set(EXTRA_REWARD_DEFINITIONS.map((reward) => reward.id)).size,
  EXTRA_REWARD_DEFINITIONS.length,
  'Additional catalog rewards should have unique IDs.',
);

const sampleRuns = Array.from({ length: 40 }, (_, index) => ({
  distanceKm: index % 5 === 0 ? 21.1 : 8 + (index % 7),
  startTime: new Date(2026, 0, index + 1, 6, 30).toISOString(),
  name: index % 3 === 0 ? 'Morning bridge hill tempo run' : 'Easy park trail run',
  elevationGainM: index * 12,
}));

const rewards = buildCatalogRewardEntries(sampleRuns, 'en');

assert.equal(
  rewards.length,
  100,
  'Materialized Rewards page catalog should expose all 100 additional rewards.',
);

for (const reward of rewards) {
  assert.equal(typeof reward.title, 'string', `${reward.id} should have a title.`);
  assert.ok(reward.title.length > 0, `${reward.id} title should not be empty.`);
  assert.equal(typeof reward.hint, 'string', `${reward.id} should have a hint.`);
  assert.ok(reward.hint.length > 0, `${reward.id} hint should not be empty.`);
  assert.equal(typeof reward.subtitle, 'string', `${reward.id} should have a subtitle.`);
  assert.ok(reward.progress >= 0 && reward.progress <= 1, `${reward.id} progress should stay within 0..1.`);
  assert.equal(typeof reward.earned, 'boolean', `${reward.id} should expose earned state.`);
}

assert.ok(
  rewards.some((reward) => reward.earned),
  'A representative running history should unlock at least one extra reward.',
);

const staleHistory = [
  { startTime: '2026-05-01T06:00:00.000Z', distanceKm: 10 },
  { startTime: '2026-04-30T06:00:00.000Z', distanceKm: 12 },
  { startTime: '2026-04-29T06:00:00.000Z', distanceKm: 8 },
];

const staleStats = getCatalogRewardStats(staleHistory);

assert.equal(
  staleStats.streakDays,
  0,
  'Catalog streak days should reset when the most recent run is not today.',
);

assert.equal(
  staleStats.streakWeeks,
  0,
  'Catalog streak weeks should reset when the most recent run is not in the current week.',
);

console.log('[PASS] Rewards catalog expansion coverage passed.');
