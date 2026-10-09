import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Rewards from '../Rewards';
import { apiJson } from '../../../api';
import { buildRewardShowcase } from '../../../utils/rewardBadges';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

const state = vi.hoisted(() => ({ lang: 'en', authenticated: true }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: state.authenticated }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: (key, values = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  state.lang = 'en'; state.authenticated = true;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  activities = Array.from({ length: 35 }, (_, index) => ({
    id: index + 1, startTime: new Date(2026, 9, 8 - index, 6).toISOString(),
    name: 'Morning park run Shanghai', distanceKm: index === 0 ? 22 : 10,
    movingTimeSeconds: 3000, elevationGainM: 40,
  }));
  apiJson.mockImplementation(async (url) => url === '/api/profile/me' ? { displayName: 'Alex' } : activities);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function renderPage() {
  return render(<MemoryRouter initialEntries={['/rewards']}><Routes>
    <Route path="/rewards" element={<Rewards />} />
    <Route path="/today-run" element={<h1>Workout destination</h1>} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter>);
}
async function openPage() {
  const result = renderPage();
  await screen.findByRole('heading', { level: 1 });
  return result;
}

it('renders every real badge exactly once in the tracks and one ring segment per badge', async () => {
  const { container } = await openPage();
  const { allRewards, earnedRewards } = buildRewardShowcase(activities, 'en');
  const steps = [...container.querySelectorAll('.rewards-v2-step')];
  expect(steps).toHaveLength(allRewards.length);
  expect(new Set(steps.map((step) => step.dataset.rewardId)).size).toBe(allRewards.length);
  for (const reward of allRewards) {
    const step = steps.find((node) => node.dataset.rewardId === reward.id);
    expect(step).toHaveTextContent(reward.title);
    expect(step).toHaveClass(reward.earned ? 'is-earned' : 'is-locked');
    expect(step.querySelector('summary')).toBeInTheDocument();
    expect(step.querySelector('details p')).toHaveTextContent(reward.earned ? reward.subtitle : reward.hint);
  }
  expect(container.querySelectorAll('.rewards-v2-ring circle')).toHaveLength(allRewards.length);
  expect(container.querySelectorAll('.rewards-v2-ring circle.is-earned')).toHaveLength(earnedRewards.length);
  expect(container.querySelector('.rewards-v2-ring-center strong')).toHaveTextContent(String(earnedRewards.length));
  expect(container.querySelectorAll('.rewards-v2-track')).toHaveLength(5);
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
});

it('counts all close badges, not just the capped three-item upcoming list', async () => {
  const { allRewards, upcomingRewards } = buildRewardShowcase(activities, 'en');
  const expected = allRewards.filter((reward) => !reward.earned && reward.progress >= .5).length;
  expect(expected).toBeGreaterThan(upcomingRewards.length);
  const { container } = await openPage();
  expect(container.querySelector('.rewards-v2-hero-copy h1')).toHaveTextContent(`${expected} badges within reach.`);
});

it('uses circular illustrated artwork for every badge and the closest milestone', async () => {
  const { container } = await openPage();
  const { allRewards } = buildRewardShowcase(activities, 'en');
  const artwork = [...container.querySelectorAll('.rewards-v2-step .reward-illustration')];
  expect(artwork).toHaveLength(allRewards.length);
  expect(container.querySelector('.rewards-v2-closest .reward-illustration')).toBeInTheDocument();
  for (const svg of artwork) {
    expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg.dataset.rewardScene).not.toBe('fallback');
    expect(svg.querySelector('clipPath circle')).toBeInTheDocument();
    expect(svg.querySelector('linearGradient, radialGradient, filter, image')).toBeNull();
  }
});

it('shows the highest-progress locked badge and navigates to a workout', async () => {
  const { container } = await openPage();
  const expected = buildRewardShowcase(activities, 'en').allRewards.filter((reward) => !reward.earned)
    .sort((a, b) => b.progress - a.progress)[0];
  const closest = container.querySelector('.rewards-v2-closest');
  expect(closest).toHaveTextContent(expected.title);
  expect(within(closest).getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(Math.round(expected.progress * 100)));
  fireEvent.click(within(closest).getByRole('button'));
  expect(screen.getByRole('heading', { name: 'Workout destination' })).toBeInTheDocument();
});

it('matches the loading layout to the ring and tracks without mounting 131 placeholder cards', () => {
  apiJson.mockImplementation(() => new Promise(() => {}));
  const { container } = renderPage();
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  expect(container.querySelector('.page-skeleton__rewards-v2-ring')).toBeInTheDocument();
  expect(container.querySelectorAll('.page-skeleton__rewards-v2-track')).toHaveLength(5);
  expect(container.querySelectorAll('.page-skeleton__rewards-badge-card')).toHaveLength(0);
});

it('keeps zero-activity progress honest and readable', async () => {
  activities = [];
  const { container } = await openPage();
  expect(container.querySelector('.rewards-v2-ring-center strong')).toHaveTextContent('0');
  expect(container.querySelector('.rewards-v2-hero-copy h1')).toHaveTextContent(en.rewards.earned_empty_coach);
  expect(container.querySelectorAll('.rewards-v2-step.is-earned')).toHaveLength(0);
  expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '0');
});

it('preserves the retry state when loading fails', async () => {
  apiJson.mockRejectedValue(new Error('Unavailable'));
  const { container } = renderPage();
  await screen.findByText(en.rewards.error_title);
  expect(screen.getByRole('button', { name: en.rewards.retry })).toBeInTheDocument();
  expect(container.querySelector('.rewards-v2-ring')).not.toBeInTheDocument();
});

it('redirects signed-out users without loading private activity data', async () => {
  state.authenticated = false;
  renderPage();
  await screen.findByRole('heading', { name: 'Login destination' });
  expect(apiJson).not.toHaveBeenCalled();
});

it('renders Chinese labels and interpolations without introducing a language switcher', async () => {
  state.lang = 'zh-CN';
  const { container } = await openPage();
  expect(screen.getByRole('heading', { level: 2, name: '距离' })).toBeInTheDocument();
  expect(container.querySelector('.rewards-v2').textContent).not.toMatch(/rewards\.v2_|\{(?:count|pct|title|total)\}/);
  expect(container.querySelector('.rewards-v2-step')).toHaveTextContent('首跑印记');
});
