import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import RewardIllustration from '../../../components/RewardIllustration';
import { getRewardArtwork } from '../../../utils/rewardArtwork';
import { buildRewardShowcase } from '../../../utils/rewardBadges';
import { EXTRA_REWARD_DEFINITIONS } from '../../../utils/rewardCatalog';

afterEach(cleanup);

it('gives the entire real catalog themed artwork without changing its data', () => {
  const rewards = buildRewardShowcase([], 'en').allRewards;
  const before = JSON.stringify(rewards);
  const { container } = render(<div>{rewards.map((reward) => <RewardIllustration key={reward.id} reward={reward} />)}</div>);
  const illustrations = [...container.querySelectorAll('.reward-illustration')];
  expect(illustrations).toHaveLength(131);
  expect(new Set(illustrations.map((svg) => svg.dataset.rewardScene)).size).toBeGreaterThanOrEqual(20);
  expect(illustrations.every((svg) => svg.dataset.rewardScene !== 'fallback')).toBe(true);
  expect(JSON.stringify(rewards)).toBe(before);
  expect(container.querySelector('image, filter, linearGradient, radialGradient, animate')).toBeNull();
});

it('uses reward identity to distinguish seasons, weather, and training themes sharing an icon', () => {
  const scenes = (ids, icon) => ids.map((id) => getRewardArtwork({ id, icon }).scene);
  expect(new Set(scenes(['spring', 'summer', 'autumn', 'winter'], 'park')).size).toBe(4);
  expect(scenes(['newyear', 'christmas', 'streak-30'], 'calendar')).toEqual(['fresh-start', 'holiday-run', 'training-block']);
  expect(scenes(['theme-tempo', 'theme-intervals'], 'bolt')).toEqual(['tempo', 'intervals']);
  expect(scenes(['theme-snow', 'theme-long'], 'summit')).toEqual(['snow-route', 'route']);
  expect(scenes(['early-bird', 'night-owl', 'theme-recovery', 'theme-rain'], '')).toEqual(['dawn', 'headlamp', 'recovery-kit', 'rain-shell']);
});

it('uses the original HermesRuns passport collection rather than reference-image vignettes', () => {
  const rewards = buildRewardShowcase([], 'en').allRewards;
  const { container } = render(<div>{rewards.map((reward) => <RewardIllustration key={reward.id} reward={reward} />)}</div>);
  for (const svg of container.querySelectorAll('.reward-illustration')) {
    expect(svg).toHaveAttribute('data-reward-collection', 'runner-passport');
    expect(svg.querySelector('.reward-passport-registration')).toBeInTheDocument();
  }
  expect(getRewardArtwork({ id: '5k' }).scene).toBe('bib');
  expect(getRewardArtwork({ id: 'lifetime-1000' }).scene).toBe('atlas');
  expect(getRewardArtwork({ id: 'streak-7' }).scene).toBe('footsteps');
  expect(getRewardArtwork({ id: 'summer' }).scene).toBe('summer-kit');
  expect(getRewardArtwork({ id: 'theme-waterfront' }).scene).toBe('waterfront-route');
  const oldPalette = ['#101114', '#3268e8', '#8db4ff', '#ffcf00'];
  expect(rewards.every((reward) => !oldPalette.includes(getRewardArtwork(reward).background))).toBe(true);
  const paintedColors = [...container.querySelectorAll('[fill],[stroke]')].flatMap((shape) => [shape.getAttribute('fill'), shape.getAttribute('stroke')]);
  expect(paintedColors.some((color) => oldPalette.includes(color))).toBe(false);
});

it('places precise distance marks on pinned race bibs instead of medal capsules', () => {
  const rewards = [{ id: '5k' }, { id: 'marathon' }, { id: 'single-run-21-1' }];
  const { container } = render(<div>{rewards.map((reward) => <RewardIllustration key={reward.id} reward={reward} />)}</div>);
  const bibs = [...container.querySelectorAll('.reward-passport-bib')];
  expect(bibs).toHaveLength(3);
  expect(bibs.map((bib) => bib.querySelector('text').textContent)).toEqual(['5', '42.195', '21.1']);
  expect(container.querySelector('.reward-illustration-mark')).toBeNull();
});

it('keeps numeric milestone marks tied to actual catalog thresholds', () => {
  const thresholds = EXTRA_REWARD_DEFINITIONS.filter((reward) => !reward.id.startsWith('theme-'));
  for (const reward of thresholds) {
    expect(getRewardArtwork(reward).mark).toBe(String(reward.threshold));
  }
  expect(getRewardArtwork({ id: 'half-marathon', icon: 'medal' }).mark).toBe('21.1');
  expect(getRewardArtwork({ id: 'marathon', icon: 'medal' }).mark).toBe('42.195');
  expect(getRewardArtwork({ id: 'long-run', icon: 'summit' }).mark).toBe('15');
});

it('provides unique, stable circular clips when the same reward appears twice', () => {
  const reward = { id: 'night-owl', icon: 'moon' };
  const view = render(<><RewardIllustration reward={reward} /><RewardIllustration reward={reward} /></>);
  const ids = [...view.container.querySelectorAll('clipPath')].map((clip) => clip.id);
  expect(new Set(ids).size).toBe(2);
  for (const svg of view.container.querySelectorAll('svg')) {
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg.querySelector('g')).toHaveAttribute('clip-path', `url(#${svg.querySelector('clipPath').id})`);
  }
  view.rerender(<><RewardIllustration reward={reward} /><RewardIllustration reward={reward} /></>);
  expect([...view.container.querySelectorAll('clipPath')].map((clip) => clip.id)).toEqual(ids);
});

it('provides safe artwork for a future or missing reward without throwing', () => {
  expect(getRewardArtwork({ id: 'future-reward', icon: 'shoe' }).scene).toBe('shoe');
  expect(getRewardArtwork({ id: 'future-reward', icon: 'unknown' }).scene).toBe('fallback');
  const { container } = render(<RewardIllustration />);
  expect(container.querySelector('svg')).toHaveAttribute('data-reward-scene', 'fallback');
});
