import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import en from '../../i18n/locales/en.js';
import zhCN from '../../i18n/locales/zh-CN.js';

let account = { isAuthenticated: true, token: 'account-a', email: 'a@test' };
let language = 'en';
const messages = { en: en.stories, 'zh-CN': zhCN.stories };
const t = (key, params = {}) => Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), messages[language][key.replace('stories.', '')] || key);
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: language }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => account }));
vi.mock('../../api', () => ({ apiJson: vi.fn() }));
const ids = ['lantern', 'seed-library', 'last-ferry'];
const fresh = (mode = 'invitation') => ({ mode, currentChapterId: null, currentPanel: 'shelf', chapters: ids.map(chapterId => ({ chapterId, status: 'NOT_STARTED', branch: null, startedAt: null, completedAt: null, postcardId: null, earnedAt: null })) });
let saved;
const chooseState = (action, chapterId, branch) => {
  saved.mode = 'open'; saved.currentChapterId = chapterId;
  saved.currentPanel = action === 'complete' ? 'ending' : 'reading';
  const row = saved.chapters.find(x => x.chapterId === chapterId);
  row.startedAt ||= '2026-10-10T16:00:00Z';
  row.status = row.completedAt ? 'COMPLETED' : 'IN_PROGRESS';
  if (action === 'replay') row.branch = null;
  if (branch) row.branch = branch;
  if (action === 'complete') { row.status = 'COMPLETED'; row.completedAt ||= '2026-10-10T16:00:00Z'; row.earnedAt = row.completedAt; row.postcardId = `postcard-${chapterId}`; }
  return structuredClone(saved);
};
async function mount(props = {}) {
  expect(existsSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PocketStories.jsx')), 'Pocket stories component exists').toBe(true);
  const componentPath = './PocketStories.jsx';
  const { default: Component } = await import(/* @vite-ignore */ componentPath);
  return { ...render(<Component {...props} />), Component };
}
beforeEach(() => {
  account = { isAuthenticated: true, token: 'account-a', email: 'a@test' }; language = 'en'; saved = fresh();
  apiJson.mockReset().mockImplementation(async (url, options) => {
    if (!options?.method) return structuredClone(saved);
    const body = JSON.parse(options.body);
    if (url.endsWith('/preferences')) { saved.mode = body.mode; if (body.mode === 'invitation') saved.currentPanel = 'shelf'; return structuredClone(saved); }
    return chooseState(body.action, url.split('/').at(-1), body.branch);
  });
});
afterEach(cleanup);
async function openFirst() {
  await mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Open pocket stories' }));
  await screen.findByRole('heading', { name: 'Story postcard album' });
  fireEvent.click(screen.getAllByRole('button', { name: 'Read chapter' })[0]);
  await screen.findByRole('group', { name: 'Choose how this story ends' });
}

it('offers opt-in without runs and preserves a visible hide/restore control', async () => {
  await mount();
  expect(await screen.findByRole('button', { name: 'Open pocket stories' })).toBeInTheDocument();
  expect(screen.queryByRole('group')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hide pocket stories' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Restore pocket stories' }));
  expect(await screen.findByRole('heading', { name: 'Story postcard album' })).toBeInTheDocument();
  expect(apiJson.mock.calls.every(([url]) => url.startsWith('/api/stories/'))).toBe(true);
});
it('keyboard choice and completion show a finite ending, one postcard, next/replay/exit and focus', async () => {
  await openFirst();
  const user = userEvent.setup();
  const choice = screen.getByRole('radio', { name: 'Leave it above the bench for the next stranger' });
  choice.focus(); await user.keyboard(' ');
  await screen.findByText('Saved choice');
  const complete = screen.getByRole('button', { name: 'Finish chapter and save postcard' });
  complete.focus(); await user.keyboard('{Enter}');
  const heading = await screen.findByRole('heading', { name: 'The end' });
  expect(heading).toHaveFocus();
  expect(screen.getByText(/In the morning, a schoolchild/)).toBeInTheDocument();
  expect(screen.getByText('1 of 3 postcards collected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Read next chapter' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Replay chapter' }).length).toBeGreaterThan(0);
});
it('keeps a failed-save draft selected and shows no successful postcard until retry', async () => {
  await openFirst();
  apiJson.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('radio', { name: 'Send it to the sea with its maker’s daughter' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm');
  expect(screen.getByRole('radio', { name: 'Send it to the sea with its maker’s daughter' })).toBeChecked();
  expect(screen.getByText('Unsaved choice')).toBeInTheDocument();
  expect(screen.getByText('0 of 3 postcards collected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Finish chapter and save postcard' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry save' }));
  await screen.findByText('Saved choice');
  fireEvent.click(screen.getByRole('button', { name: 'Finish chapter and save postcard' }));
  expect(await screen.findByText('Postcard saved in your album.')).toBeInTheDocument();
});
it('recovers a committed response loss by fetching saved state without granting locally', async () => {
  await openFirst();
  fireEvent.click(screen.getByRole('radio', { name: 'Leave it above the bench for the next stranger' }));
  await screen.findByText('Saved choice');
  apiJson.mockImplementationOnce(async () => { chooseState('complete', 'lantern', 'left'); throw new Error('response lost'); });
  fireEvent.click(screen.getByRole('button', { name: 'Finish chapter and save postcard' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Postcard saved in your album.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check saved progress' }));
  expect(await screen.findByText('Postcard saved in your album.')).toBeInTheDocument();
  expect(screen.getByText('1 of 3 postcards collected')).toBeInTheDocument();
});
it('coalesces double completion while saving', async () => {
  await openFirst();
  fireEvent.click(screen.getByRole('radio', { name: 'Leave it above the bench for the next stranger' }));
  await screen.findByText('Saved choice');
  let finish;
  apiJson.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const button = screen.getByRole('button', { name: 'Finish chapter and save postcard' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(apiJson.mock.calls.filter(([, options]) => options?.body?.includes('complete'))).toHaveLength(1);
  await act(async () => finish(chooseState('complete', 'lantern', 'left')));
});
it('restores paused reading, finite exhaustion and original earned dates after reload', async () => {
  saved = fresh('open');
  chooseState('choose', 'lantern', 'right');
  const { unmount } = await mount();
  expect(await screen.findByRole('radio', { name: 'Send it to the sea with its maker’s daughter' })).toBeChecked();
  unmount();
  ids.forEach(id => chooseState('complete', id, 'right'));
  await mount();
  expect(await screen.findByText(/You have finished all three supplied chapters/)).toBeInTheDocument();
  expect(screen.getByText('3 of 3 postcards collected')).toBeInTheDocument();
  const album = screen.getByRole('region', { name: 'Story postcard album' });
  expect(within(album).getAllByText('Story chapter completed')).toHaveLength(3);
  expect(within(album).getAllByText(/Earned/)).toHaveLength(3);
});
it('discards drafts and ignores a late prior-account response during an account switch', async () => {
  await openFirst();
  let oldResponse;
  apiJson.mockImplementationOnce(() => new Promise(resolve => { oldResponse = resolve; }));
  fireEvent.click(screen.getByRole('radio', { name: 'Leave it above the bench for the next stranger' }));
  cleanup();
  account = { isAuthenticated: true, token: 'account-b', email: 'b@test' }; saved = fresh();
  await mount();
  expect(await screen.findByRole('button', { name: 'Open pocket stories' })).toBeInTheDocument();
  await act(async () => oldResponse({ ...fresh('open'), currentChapterId: 'lantern', currentPanel: 'ending' }));
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});
it('clears immediately on same-mounted account changes and on sign-out', async () => {
  saved = fresh('open'); chooseState('choose', 'lantern', 'right');
  const { rerender, Component } = await mount();
  await screen.findByRole('radio', { name: 'Send it to the sea with its maker’s daughter' });
  account = { isAuthenticated: true, token: 'account-b', email: 'b@test' }; saved = fresh();
  rerender(<Component />);
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Open pocket stories' });
  account = { isAuthenticated: false, token: null, email: null }; rerender(<Component />);
  expect(screen.queryByRole('heading', { name: 'Pocket stories' })).not.toBeInTheDocument();
});
it('honestly reports a failed load with retry', async () => {
  apiJson.mockRejectedValueOnce(new Error('offline'));
  await mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Open pocket stories' })).toBeInTheDocument();
});
it('treats malformed server state as a load failure so athletic rewards can stay usable', async () => {
  apiJson.mockResolvedValueOnce([]);
  await mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
});
it('moves keyboard focus to restore after hiding and back to a heading after restoring', async () => {
  saved = fresh('open');
  await mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Hide pocket stories' }));
  const restore = await screen.findByRole('button', { name: 'Restore pocket stories' });
  await waitFor(() => expect(restore).toHaveFocus());
  fireEvent.click(restore);
  const heading = await screen.findByRole('heading', { name: 'Pocket stories' });
  await waitFor(() => expect(heading).toHaveFocus());
});
it('supplies full Chinese story, both endings and postcard alternatives', async () => {
  language = 'zh-CN'; saved = fresh('open'); chooseState('choose', 'seed-library', 'right');
  await mount();
  expect(await screen.findByText(/镇上的图书馆后面/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '完成章节并保存明信片' }));
  expect(await screen.findByText(/一个没完成的念头/)).toBeInTheDocument();
  expect(screen.getByText(/图书馆种子抽屉旁/)).toBeInTheDocument();
});

it('sets the real API JSON request contract on preference and chapter writes', async () => {
  await openFirst();
  for (const [, options] of apiJson.mock.calls.filter(([, options]) => options?.method === 'POST')) {
    expect(options.headers?.['Content-Type']).toBe('application/json');
  }
});

it('does not reconcile an uncommitted replay against the old same-chapter ending', async () => {
  saved = fresh('open'); chooseState('complete', 'lantern', 'left');
  await mount();
  apiJson.mockRejectedValueOnce(new Error('replay never committed'));
  fireEvent.click(within(await screen.findByRole('article')).getByRole('button', { name: 'Replay chapter' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved progress' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm');
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
  expect(screen.queryByText('Saved')).not.toBeInTheDocument();
});

it('does not reconcile an uncommitted resume against the same-chapter shelf', async () => {
  saved = fresh('open'); chooseState('choose', 'lantern', 'right'); saved.currentPanel = 'shelf';
  await mount();
  apiJson.mockRejectedValueOnce(new Error('start never committed'));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue chapter' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved progress' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm');
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
});

it('displays the first earned instant in the account calendar rather than the browser calendar', async () => {
  saved = fresh('open'); chooseState('complete', 'lantern', 'left');
  await mount({ timeZone: 'Pacific/Kiritimati' });
  expect(await screen.findByText('Earned Oct 11, 2026')).toBeInTheDocument();
});

it('does not reconcile an uncommitted replay while its old reading choice is still saved', async () => {
  saved = fresh('open'); chooseState('complete', 'lantern', 'left'); chooseState('choose', 'lantern', 'left');
  await mount();
  apiJson.mockRejectedValueOnce(new Error('replay never committed'));
  fireEvent.click(await screen.findByRole('button', { name: 'Replay chapter' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved progress' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm');
  expect(screen.getByRole('button', { name: 'Retry save' })).toBeInTheDocument();
});
