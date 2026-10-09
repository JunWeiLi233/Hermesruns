import assert from 'node:assert/strict';
import { buildRewardTracks, buildRewardRingSegments } from '../rewardTracks.js';

const badge = (id, earned = false, progress = 0) => ({ id, earned, progress });
const rewards = [badge('first-run', true, 1), badge('5k', false, .4), badge('10k', true, 1),
  badge('single-run-3', true, 1), badge('lifetime-distance-50'), badge('day-streak-3'),
  badge('elevation-500'), badge('brand-new'), badge('early-bird')];
const tracks = buildRewardTracks(rewards);
const items = tracks.flatMap((track) => track.items);
assert.deepEqual(new Set(items.map((item) => item.id)), new Set(rewards.map((item) => item.id)));
assert.equal(items.length, rewards.length, 'No badge may disappear or be duplicated.');
assert.equal(tracks.find((track) => track.key === 'distance').items.some((item) => item.id === 'single-run-3'), true);
assert.equal(tracks.find((track) => track.key === 'volume').items.some((item) => item.id === 'lifetime-distance-50'), true);
assert.equal(tracks.find((track) => track.key === 'consistency').items.some((item) => item.id === 'day-streak-3'), true);
assert.equal(tracks.find((track) => track.key === 'explore').items.some((item) => item.id === 'elevation-500'), true);
assert.equal(tracks.find((track) => track.key === 'moments').items.some((item) => item.id === 'brand-new'), true);
const distance = tracks.find((track) => track.key === 'distance');
assert.equal(distance.current.id, '5k');
assert.equal(distance.fill, .4 / 3, 'An earned badge beyond the first locked rung must not overfill the ladder.');
assert.ok(tracks.every((track) => track.fill >= 0 && track.fill <= 1));
assert.equal(buildRewardTracks([badge('first-run')])[0].fill, 0);
assert.equal(buildRewardTracks([badge('first-run', true, 1)])[0].fill, 1);
assert.equal(buildRewardTracks([badge('first-run', true, 1), badge('5k', true, 1)])[0].fill, 1);
assert.equal(buildRewardTracks([badge('first-run', false, NaN)])[0].fill, 0);
assert.deepEqual(buildRewardTracks([]), []);
const segments = buildRewardRingSegments(tracks);
assert.equal(segments.length, rewards.length);
assert.equal(segments.filter((segment) => segment.color).length, rewards.filter((item) => item.earned).length);
assert.ok(segments.every((segment) => !`${segment.dash} ${segment.offset}`.includes('NaN')));
assert.deepEqual(buildRewardRingSegments([]), []);
console.log('[PASS] Reward tracks preserve the catalog, honest ladder fill, and ring segments.');
