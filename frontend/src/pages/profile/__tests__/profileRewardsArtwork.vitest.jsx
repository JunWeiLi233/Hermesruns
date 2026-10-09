import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ProfileDashboard from '../ProfileDashboard';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import { buildRewardShowcase } from '../../../utils/rewardBadges';
import { getRewardArtwork } from '../../../utils/rewardArtwork';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

const state = vi.hoisted(() => ({ lang: 'en' }));
function translate(key, values = {}) {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'preview@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: translate }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  state.lang = 'en';
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  activities = Array.from({ length: 35 }, (_, index) => ({
    id: index + 1, startTime: new Date(2026, 9, 8 - index, 6).toISOString(),
    name: 'Morning park run Shanghai', distanceKm: index === 0 ? 22 : 10,
    movingTimeSeconds: 3000, elevationGainM: 40,
  }));
  cachedApiJson.mockImplementation(async (url) => url === '/api/profile/dashboard'
    ? { profile: { displayName: 'Alex', email: 'preview@example.test' }, activities, shoes: [], races: [] }
    : activities);
  apiJson.mockResolvedValue(null);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.useRealTimers(); });

async function openDashboard() {
  const view = render(<MemoryRouter initialEntries={['/profile']}><Routes>
    <Route path="/profile" element={<ProfileDashboard />} />
    <Route path="/rewards" element={<h1>Rewards destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: translate('profile.dashboard_redesign.rewards_title') });
  return view.container.querySelector('.hd-rewards');
}

function expectPassport(svg, reward) {
  expect(svg).not.toBeNull();
  expect(svg).toHaveAttribute('data-reward-collection', 'runner-passport');
  expect(svg).toHaveAttribute('data-reward-scene', getRewardArtwork(reward).scene);
  expect(svg).toHaveAttribute('viewBox', '0 0 100 100');
  expect(svg).toHaveAttribute('aria-hidden', 'true');
  expect(svg).toHaveAttribute('focusable', 'false');
  expect(svg.querySelector('clipPath circle')).toBeInTheDocument();
  expect(svg.querySelector('image, filter, animate')).toBeNull();
}

it('uses the same passport artwork as Rewards for each earned dashboard badge', async () => {
  const card = await openDashboard();
  const expected = buildRewardShowcase(activities, 'en').earnedRewards.slice(0, 8);
  const badges = [...card.querySelectorAll('.hd-rewards-badge')];
  expect(badges).toHaveLength(expected.length);
  badges.forEach((badge, index) => {
    expectPassport(badge.querySelector('.reward-illustration'), expected[index]);
    expect(badge.querySelector('strong')).toHaveTextContent(expected[index].title);
    expect(badge.querySelector('.hd-rewards-badge-info span')).toHaveTextContent(expected[index].subtitle);
  });
  expect(badges[0]).toHaveClass('is-latest');
});

it('updates the next-award artwork without changing its progress or target', async () => {
  const card = await openDashboard();
  const next = buildRewardShowcase(activities, 'en').upcomingRewards[0];
  expectPassport(card.querySelector('.hd-rewards-next .reward-illustration'), next);
  expect(card.querySelector('.hd-rewards-next-title')).toHaveTextContent(next.title);
  expect(card.querySelector('.hd-rewards-next-hint')).toHaveTextContent(next.hint || next.subtitle);
  expect(card.querySelector('.hd-rewards-next-pct')).toHaveTextContent(`${Math.round(next.progress * 100)}%`);
  expect(card.querySelector('.hd-rewards-next-fill')).toHaveStyle({ transform: `scaleX(${Math.round(next.progress * 100) / 100})` });
});

it('preserves completion totals and the view-all navigation', async () => {
  const card = await openDashboard();
  const showcase = buildRewardShowcase(activities, 'en');
  expect(card.querySelector('.hd-rewards-ring-center strong')).toHaveTextContent(String(showcase.earnedRewards.length));
  expect(card.querySelector('.hd-rewards-ring-center span')).toHaveTextContent(`/ ${showcase.allRewards.length}`);
  expect(card.querySelector('.hd-rewards-progress-label strong')).toHaveTextContent(`${Math.round(showcase.earnedRewards.length / showcase.allRewards.length * 100)}%`);
  fireEvent.click(within(card).getByRole('button', { name: en.profile.dashboard_redesign.rewards_view_all }));
  expect(screen.getByRole('heading', { name: 'Rewards destination' })).toBeInTheDocument();
});

it('keeps translated award labels beside the shared artwork in Chinese', async () => {
  state.lang = 'zh-CN';
  const card = await openDashboard();
  const expected = buildRewardShowcase(activities, 'zh-CN').earnedRewards[0];
  expectPassport(card.querySelector('.hd-rewards-badge .reward-illustration'), expected);
  expect(card.querySelector('.hd-rewards-badge-info strong')).toHaveTextContent(expected.title);
  expect(card.textContent).not.toMatch(/profile\.dashboard_redesign|\{(?:count|pct|title)\}/);
});
