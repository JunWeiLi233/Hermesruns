import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Rewards from './Rewards';
import en from '../../i18n/locales/en.js';
import { apiJson } from '../../api';

const account = vi.hoisted(() => ({ token: 'account-a', email: 'a@fixture.test', isAuthenticated: true }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => account }));
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key, values = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy);
} }) }));
vi.mock('../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../components/TopbarNotifications', () => ({ default: () => null }));

const page = () => <MemoryRouter initialEntries={['/rewards']}><Rewards /></MemoryRouter>;
const findText = text => screen.findByText(text, {}, { timeout: 5000 });
const story = earned => ({
  mode: 'open', currentChapterId: null, currentPanel: 'shelf',
  chapters: ['lantern', 'seed-library', 'last-ferry'].map(chapterId => {
    const completed = earned && chapterId === 'lantern';
    const instant = '2026-10-11T00:30:00Z';
    return { chapterId, status: completed ? 'COMPLETED' : 'NOT_STARTED', branch: completed ? 'left' : null,
      startedAt: completed ? instant : null, completedAt: completed ? instant : null,
      postcardId: completed ? 'postcard-lantern' : null, earnedAt: completed ? instant : null };
  }),
});
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  Object.assign(account, { token: 'account-a', email: 'a@fixture.test', isAuthenticated: true });
  apiJson.mockImplementation(async url => {
    if (url === '/api/profile/me') return { displayName: account.token, timeZone: account.token === 'account-a' ? 'UTC' : 'America/New_York' };
    if (url === '/api/activities') return [];
    if (url === '/api/stories/me') return story(account.token === 'account-b');
    throw new Error(`Unexpected read: ${url}`);
  });
});
afterEach(cleanup);
function switchAccount(mounted) {
  Object.assign(account, { token: 'account-b', email: 'b@fixture.test' });
  mounted.rerender(page());
}

it('reloads the current owner calendar during an authenticated same-route account switch', async () => {
  const mounted = render(page());
  await findText('0 of 3 postcards collected');
  switchAccount(mounted);
  await findText('Earned Oct 10, 2026');
  expect(screen.queryByText('Earned Oct 11, 2026')).not.toBeInTheDocument();
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/profile/me')).toHaveLength(2);
});

it('removes the previous owner view while the new profile is loading', async () => {
  const pendingProfile = deferred();
  const original = apiJson.getMockImplementation();
  apiJson.mockImplementation((url, options) => account.token === 'account-b' && url === '/api/profile/me'
    ? pendingProfile.promise : original(url, options));
  const mounted = render(page());
  await findText(/account-a ·/);
  switchAccount(mounted);
  expect(screen.queryByText(/account-a ·/)).not.toBeInTheDocument();
  expect(screen.queryByText('0 of 3 postcards collected')).not.toBeInTheDocument();
  await act(async () => pendingProfile.resolve({ displayName: 'account-b', timeZone: 'America/New_York' }));
  await findText('Earned Oct 10, 2026');
});

it('aborts the previous owner load and ignores its late response', async () => {
  const pendingProfile = deferred();
  let oldSignal;
  const original = apiJson.getMockImplementation();
  apiJson.mockImplementation((url, options) => {
    if (account.token === 'account-a' && url === '/api/profile/me') {
      oldSignal = options?.signal;
      return pendingProfile.promise;
    }
    return original(url, options);
  });
  const mounted = render(page());
  await waitFor(() => expect(apiJson.mock.calls.some(([url]) => url === '/api/profile/me')).toBe(true));
  switchAccount(mounted);
  await findText('Earned Oct 10, 2026');
  expect(oldSignal.aborted).toBe(true);
  await act(async () => pendingProfile.resolve({ displayName: 'stale-account-a', timeZone: 'UTC' }));
  expect(screen.queryByText(/stale-account-a/)).not.toBeInTheDocument();
  expect(screen.getByText('Earned Oct 10, 2026')).toBeInTheDocument();
});
