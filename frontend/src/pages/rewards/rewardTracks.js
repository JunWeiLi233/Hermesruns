const REWARD_TRACKS = [
  { key: 'distance', color: '#a0392a', ids: ['first-run', '5k', '10k', 'half-marathon', '25k', 'marathon', 'ultra-marathon'], prefixes: ['single-run-'] },
  { key: 'volume', color: '#c98a12', ids: ['lifetime-100', 'long-run', 'marathon-week', 'lifetime-500', 'hundred-runs', 'lifetime-1000'], prefixes: ['lifetime-distance-', 'run-count-'] },
  { key: 'consistency', color: '#d9573f', ids: ['streak-7', 'weeks-4', 'streak-30'], prefixes: ['day-streak-', 'week-streak-'] },
  { key: 'explore', color: '#2a7c8c', ids: ['city-one', 'park', 'bridge', 'city', 'city-three', 'world-major'], prefixes: ['elevation-'], themes: ['trail', 'track', 'hill', 'commute', 'waterfront'] },
  { key: 'moments', color: '#6d4f9a', ids: ['early-bird', 'night-owl', 'weekend-warrior', 'newyear', 'spring', 'summer', 'autumn', 'winter', 'christmas'], prefixes: [] },
];

export const REWARD_RING_RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * REWARD_RING_RADIUS;

export function rewardProgress(reward) {
  const value = Number(reward?.progress);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function buildRewardTracks(allRewards) {
  const byId = new Map(allRewards.map((reward) => [reward.id, reward]));
  const assigned = new Set(REWARD_TRACKS.flatMap((track) => track.ids));
  const extras = allRewards.filter((reward) => !assigned.has(reward.id));
  return REWARD_TRACKS.map((track) => {
    const extraItems = extras.filter((reward) => {
      const owner = REWARD_TRACKS.find((candidate) => candidate.prefixes.some((prefix) => reward.id.startsWith(prefix))
        || candidate.themes?.some((theme) => reward.id === `theme-${theme}`));
      return (owner?.key || 'moments') === track.key;
    });
    const items = [...track.ids.map((id) => byId.get(id)).filter(Boolean), ...extraItems];
    const currentIndex = items.findIndex((item) => !item.earned);
    const current = currentIndex >= 0 ? items[currentIndex] : null;
    // Only the earned prefix advances the line; independent later badges can be earned too.
    const fill = !current ? 1 : items.length > 1
      ? Math.max(0, currentIndex - 1 + rewardProgress(current)) / (items.length - 1) : 0;
    return { ...track, items, earned: items.filter((item) => item.earned).length, current, fill };
  }).filter((track) => track.items.length > 0);
}

export function buildRewardRingSegments(tracks) {
  const flat = tracks.flatMap((track) => track.items.map((item) => ({ item, color: track.color })));
  const segment = flat.length ? CIRCUMFERENCE / flat.length : 0;
  const gap = flat.length > 1 ? Math.min(2.2, segment * .3) : 0;
  return flat.map(({ item, color }, index) => ({
    id: item.id, color: item.earned ? color : null,
    dash: `${Math.max(0, segment - gap).toFixed(2)} ${(CIRCUMFERENCE - segment + gap).toFixed(2)}`,
    offset: (-index * segment).toFixed(2),
  }));
}
