import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { apiJson } from '../../api';
import { StrictMode } from 'react';

let account = { isAuthenticated: true, token: 'fictional-a', email: 'fictional-a@example.test' };
let language = 'en';
let dictionaries;
const t = (key, params = {}) => Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), dictionaries?.[language]?.[key.replace('entertainment_expansion.', '')] || key);
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => account }));
vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: language }) }));
vi.mock('../../api', () => ({ apiJson: vi.fn() }));
const root = '/api/entertainment';
const fresh = () => ({ accountId: '101', companion: { accessory: 'scarf', background: 'meadow', hidden: false, version: 0, lastRequestId: null }, memories: [], missions: ['rest', 'reflection', 'story', 'walk-jog'].map(missionId => ({ missionId, status: 'available', completionSource: 'self-marked', version: 0, lastRequestId: null })), groups: [] });
const metadata = { accountId: '101', accessories: ['scarf', 'cap', 'satchel'], backgrounds: ['meadow', 'night'], missionCatalog: ['rest', 'reflection', 'story', 'walk-jog'], symbols: ['sun', 'leaf', 'star', 'wave'], slotCount: 4, maxMembers: 4 };
let saved;
let receipts;
let missionHistory;
const clone = value => structuredClone(value);
const group = () => ({ id: 'group-a', ownerAccountId: '101', version: 0, lastRequestId: null, complete: false, members: [{ accountId: '101' }], slots: Array.from({ length: 4 }, (_, index) => ({ index, symbol: null, contributorAccountId: null })), invites: [] });
async function transport(url, options) {
  if (url === `${root}/metadata`) return clone(metadata);
  if (url === `${root}/me`) return clone(saved);
  if (url.includes('/requests/')) {
    const receipt = receipts.get(url.split('/').at(-1));
    if (!receipt) throw Object.assign(new Error('not committed'), { status: 404 });
    return clone(receipt);
  }
  const body = JSON.parse(options.body);
  if (receipts.has(body.requestId)) return clone(receipts.get(body.requestId).result);
  let result;
  if (url.endsWith('/companion')) result = saved.companion = { ...body, version: saved.companion.version + 1, lastRequestId: body.requestId };
  else if (url.includes('/memories')) {
    const id = url.split('/').at(-1);
    const row = saved.memories.find(value => value.id === id);
    if (options.method === 'DELETE') { saved.memories = saved.memories.filter(value => value.id !== id); result = { id, deleted: true }; }
    else {
      if (row && row.version !== body.expectedVersion) throw Object.assign(new Error('stale version'), { status: 409 });
      result = { ...body, id: row?.id || `memory-${saved.memories.length}`, createdAt: row?.createdAt || '2026-10-11T16:00:00Z', updatedAt: '2026-10-11T16:00:00Z', version: (row?.version ?? -1) + 1, lastRequestId: body.requestId };
      if (row) saved.memories = saved.memories.map(value => value.id === row.id ? result : value);
      else saved.memories.push(result);
    }
  } else if (url.includes('/missions/')) {
    const row = saved.missions.find(value => value.missionId === url.split('/').at(-1));
    const previous = row.status;
    row.status = body.action === 'undo' ? missionHistory.get(row.missionId) : ({ choose: 'chosen', pause: 'paused', complete: 'completed', skip: 'skipped' })[body.action];
    missionHistory.set(row.missionId, previous); row.version++; row.lastRequestId = body.requestId; result = row;
  } else if (url.endsWith('/groups')) { result = group(); saved.groups.push(result); }
  else if (url.includes('/slots/')) {
    result = saved.groups[0];
    if (result.version !== body.expectedVersion) throw Object.assign(new Error('stale tile version'), { status: 409 });
    result.slots[Number(url.split('/').at(-1))] = { index: Number(url.split('/').at(-1)), symbol: body.symbol, contributorAccountId: saved.accountId };
    result.version++; result.lastRequestId = body.requestId; result.complete = result.slots.every(slot => slot.symbol);
  } else if (url.endsWith('/revoke')) { result = saved.groups[0]; result.invites[0].status = 'revoked'; result.version++; }
  else if (url.endsWith('/leave') || options.method === 'DELETE') { saved.groups = []; result = { id: 'group-a', [url.endsWith('/leave') ? 'left' : 'deleted']: true }; }
  else if (url.endsWith('/invites/decline')) result = { declined: true };
  else if (url.endsWith('/invites/accept')) { result = { ...group(), ownerAccountId: '202', members: [{ accountId: '202' }, { accountId: '101' }] }; saved.groups = [result]; }
  else if (url.endsWith('/invites')) {
    const row = saved.groups[0]; row.version++; row.invites.push({ id: 'invite-a', recipientAccountId: body.recipientAccountId, expiresAt: '2026-10-12T16:00:00Z', status: 'pending' });
    result = { inviteId: 'invite-a', token: 'test-only-placeholder', expiresAt: '2026-10-12T16:00:00Z', group: row };
  }
  const path = url.slice(root.length).split('/').filter(Boolean);
  const operation = path[0] === 'companion' ? 'companion.save'
    : path[0] === 'memories' ? `memory.${options.method === 'DELETE' ? 'delete' : options.method === 'PUT' ? 'update' : 'create'}${path[1] ? `/${path[1]}` : ''}`
      : path[0] === 'missions' ? `mission.action/${path[1]}`
        : path[0] === 'invites' ? `invite.${path[1]}`
          : path.length === 1 ? 'group.create'
            : path[2] === 'slots' ? `group.slot/${path[1]}/${path[3]}`
              : path[2] === 'invites' ? `group.${path[4] === 'revoke' ? `revoke/${path[1]}/${path[3]}` : `invite/${path[1]}`}`
                : `group.${path[2] === 'leave' ? 'leave' : 'delete'}/${path[1]}`;
  receipts.set(body.requestId, { requestId: body.requestId, operation, result: { ...clone(result), ...(result?.token ? { token: null } : {}) } });
  return clone(result);
}
async function mount({ strict = false } = {}) {
  expect(existsSync(resolve(dirname(fileURLToPath(import.meta.url)), 'EntertainmentExpansion.jsx')), 'all four modules component exists').toBe(true);
  const enPath = '../../i18n/locales/en/entertainmentExpansion.js';
  const zhPath = '../../i18n/locales/zh-CN/entertainmentExpansion.js';
  const [en, zh] = await Promise.all([import(/* @vite-ignore */ enPath), import(/* @vite-ignore */ zhPath)]);
  dictionaries = { en: en.default.entertainment_expansion, 'zh-CN': zh.default.entertainment_expansion };
  const path = './EntertainmentExpansion.jsx';
  const { default: Component } = await import(/* @vite-ignore */ path);
  return { ...render(strict ? <StrictMode><Component /></StrictMode> : <Component />), Component };
}
beforeEach(() => {
  saved = fresh(); receipts = new Map(); missionHistory = new Map(); language = 'en';
  account = { isAuthenticated: true, token: 'fictional-a', email: 'fictional-a@example.test' };
  apiJson.mockReset().mockImplementation(transport);
});
afterEach(cleanup);
async function startMemory() {
  fireEvent.click(await screen.findByRole('button', { name: 'New memory' }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quiet afternoon' } });
  fireEvent.change(screen.getByLabelText('Memory text'), { target: { value: '  keep this moment\n' } });
  fireEvent.change(screen.getByLabelText('Calendar date (optional)'), { target: { value: '2024-02-29' } });
}

it('offers all four optional modules free to a zero-history account with persistent companion hide/restore and focus', async () => {
  await mount();
  await screen.findByRole('heading', { name: 'Companion closet' });
  for (const name of ['Private memories', 'Flexible missions', 'Private symbol mosaic']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hide companion' }));
  const restore = await screen.findByRole('button', { name: 'Restore companion' });
  await waitFor(() => expect(restore).toHaveFocus());
  fireEvent.click(restore);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Companion closet' })).toHaveFocus());
});

it('creates, reads, edits and explicitly confirms deleting bounded private text with a literal date', async () => {
  await mount(); await startMemory();
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('heading', { name: 'Quiet afternoon' });
  expect(screen.getByText('2024-02-29')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit memory' }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'A quieter afternoon' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('heading', { name: 'A quieter afternoon' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete memory' }));
  expect(saved.memories).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete memory' }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'A quieter afternoon' })).not.toBeInTheDocument());
  const writes = apiJson.mock.calls.filter(([, options]) => options?.method);
  expect(writes.every(([, options]) => options.headers['Content-Type'] === 'application/json')).toBe(true);
});

it('retains failed drafts, retries the identical request ID and reconciles only an actual receipt', async () => {
  await mount(); await startMemory();
  apiJson.mockRejectedValueOnce(new Error('response lost before commit'));
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved state' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry same save' }));
  await screen.findByRole('heading', { name: 'Quiet afternoon' });
  const requests = apiJson.mock.calls.filter(([url, options]) => url === `${root}/memories` && options?.method);
  expect(JSON.parse(requests[0][1].body).requestId === JSON.parse(requests[1][1].body).requestId).toBe(true);
});

it('reconciles committed response loss, refreshes current state and avoids duplicate cards', async () => {
  await mount(); await startMemory();
  apiJson.mockImplementationOnce(async (...args) => { await transport(...args); throw new Error('lost committed response'); });
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved state' }));
  await screen.findByRole('heading', { name: 'Quiet afternoon' });
  expect(saved.memories).toHaveLength(1);
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
});

it('preserves an edit conflict and requires reviewing the latest version before overwriting', async () => {
  saved.memories.push({ id: 'existing', title: 'Original', body: 'Old body', date: null, version: 0, createdAt: '2026-10-11T16:00:00Z', updatedAt: '2026-10-11T16:00:00Z', lastRequestId: null });
  await mount(); fireEvent.click(await screen.findByRole('button', { name: 'Edit memory' }));
  fireEvent.change(screen.getByLabelText('Memory text'), { target: { value: 'My draft' } });
  saved.memories[0].version++; saved.memories[0].body = 'Other saved edit';
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Review latest saved state' }));
  await screen.findAllByText('Other saved edit');
  expect(screen.getByLabelText('Memory text')).toHaveValue('My draft');
  expect(screen.getByRole('button', { name: 'Save memory' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Use this saved version and keep my draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByText('My draft');
});

it('provides voluntary self-marked untimed choose, pause, complete, skip and undo without exercise writes', async () => {
  await mount();
  const missions = await screen.findByRole('region', { name: 'Flexible missions' });
  expect(within(missions).getByText(/Every completion is marked by you/)).toBeInTheDocument();
  const rest = within(missions).getByRole('article', { name: 'Rest' });
  fireEvent.click(within(rest).getByRole('button', { name: 'Choose' })); await within(rest).findByText('Chosen');
  fireEvent.click(within(rest).getByRole('button', { name: 'Pause' })); await within(rest).findByText('Paused');
  fireEvent.click(within(rest).getByRole('button', { name: 'Mark complete' })); await within(rest).findByText('Completed by you');
  fireEvent.click(within(rest).getByRole('button', { name: 'Undo last change' })); await within(rest).findByText('Paused');
  fireEvent.click(within(rest).getByRole('button', { name: 'Skip' })); await within(rest).findByText('Skipped');
  expect(apiJson.mock.calls.every(([url]) => url.startsWith(root))).toBe(true);
});

it('completes all four catalog symbol slots solo and confirms owner deletion', async () => {
  await mount(); fireEvent.click(await screen.findByRole('button', { name: 'Create solo mosaic' }));
  for (let index = 1; index <= 4; index++) {
    const slot = await screen.findByRole('group', { name: `Tile ${index}` });
    fireEvent.change(within(slot).getByRole('combobox'), { target: { value: 'sun' } });
    fireEvent.click(within(slot).getByRole('button', { name: 'Save tile' }));
    await waitFor(() => expect(saved.groups[0].slots[index - 1].symbol).toBe('sun'));
    await waitFor(() => expect(within(slot).getByRole('button', { name: 'Save tile' })).not.toBeDisabled());
  }
  await screen.findByText('Mosaic complete. No award or exercise record is created.');
  fireEvent.click(screen.getByRole('button', { name: 'Delete mosaic' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete mosaic' }));
  await screen.findByRole('button', { name: 'Create solo mosaic' });
});

it('creates a directed one-time invite, keeps the token masked, clears it on closing and can revoke', async () => {
  saved.groups = [group()]; await mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Invite someone (optional)' }));
  fireEvent.change(screen.getByLabelText('Recipient account ID'), { target: { value: '202' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  const tokenInput = await screen.findByLabelText('Private invitation token');
  expect(tokenInput).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Close and clear invitation' }));
  expect(screen.queryByLabelText('Private invitation token')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke invitation' }));
  await screen.findByText('Revoked');
});

it('accepts or declines only an explicitly entered token and offers member leave', async () => {
  await mount();
  fireEvent.change(await screen.findByLabelText('Invitation token'), { target: { value: 'test-only-placeholder' } });
  fireEvent.click(screen.getByRole('button', { name: 'Decline invitation' })); await screen.findByText('Saved.');
  fireEvent.change(screen.getByLabelText('Invitation token'), { target: { value: 'test-only-placeholder' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept invitation' }));
  const leave = await screen.findByRole('button', { name: 'Leave mosaic' });
  expect(screen.queryByRole('button', { name: 'Delete mosaic' })).not.toBeInTheDocument();
  fireEvent.click(leave); fireEvent.click(screen.getByRole('button', { name: 'Confirm leave mosaic' }));
  await screen.findByRole('button', { name: 'Create solo mosaic' });
});

it('clears in-page drafts immediately on a mounted token/email switch and on signout, ignoring late old responses', async () => {
  const { Component, rerender } = await mount(); await startMemory();
  let resolveOld;
  apiJson.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  account = { isAuthenticated: true, token: 'fictional-b', email: 'fictional-b@example.test' }; saved = fresh();
  rerender(<Component />);
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'New memory' });
  await act(async () => resolveOld({ id: 'old', title: 'Quiet afternoon' }));
  expect(screen.queryByText('Quiet afternoon')).not.toBeInTheDocument();
  account = { isAuthenticated: false, token: null, email: null }; rerender(<Component />);
  expect(screen.queryByRole('heading', { name: 'Optional entertainment' })).not.toBeInTheDocument();
});

it('announces load failure and rejects malformed or mismatched ownership state', async () => {
  apiJson.mockResolvedValueOnce({ ...fresh(), accountId: 'foreign-owner' });
  await mount();
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  await screen.findByRole('button', { name: 'New memory' });
});

it('renders all four modules in Chinese with matching nonempty translation keys', async () => {
  language = 'zh-CN'; await mount();
  await screen.findByRole('heading', { name: '伙伴衣橱' });
  for (const name of ['私人回忆', '随心任务', '私人符号拼图']) expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries['zh-CN']).sort());
  expect(Object.values(dictionaries['zh-CN']).every(value => typeof value === 'string' && value.length > 0)).toBe(true);
});

it('rejects a receipt for the wrong operation even when its ID and old result appear to match', async () => {
  await mount(); await startMemory();
  apiJson.mockImplementationOnce(async (...args) => {
    await transport(...args);
    for (const receipt of receipts.values()) receipt.operation = 'companion.save';
    throw new Error('lost response');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved state' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
});

it('coalesces double clicks and prevents editing the exact pending draft during response loss', async () => {
  await mount(); await startMemory();
  let finish;
  apiJson.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const save = screen.getByRole('button', { name: 'Save memory' });
  fireEvent.click(save); fireEvent.click(save);
  expect(screen.getByLabelText('Title')).toBeDisabled();
  expect(apiJson.mock.calls.filter(([url, options]) => url.endsWith('/memories') && options?.method)).toHaveLength(1);
  const request = apiJson.mock.calls.find(([url, options]) => url.endsWith('/memories') && options?.method);
  await act(async () => finish(await transport(...request)));
  await screen.findByText('Saved.');
});

it('retains another unsaved tile choice when one tile is saved and requires explicit version review', async () => {
  saved.groups = [group()]; await mount();
  const first = await screen.findByRole('group', { name: 'Tile 1' });
  const second = screen.getByRole('group', { name: 'Tile 2' });
  fireEvent.change(within(first).getByRole('combobox'), { target: { value: 'sun' } });
  fireEvent.change(within(second).getByRole('combobox'), { target: { value: 'leaf' } });
  fireEvent.click(within(first).getByRole('button', { name: 'Save tile' }));
  await screen.findByText('Saved.');
  expect(within(second).getByRole('combobox')).toHaveValue('leaf');
  expect(within(second).getByRole('button', { name: 'Save tile' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Use latest mosaic version and keep tile choices' }));
  fireEvent.click(within(second).getByRole('button', { name: 'Save tile' }));
  await waitFor(() => expect(saved.groups[0].slots[1].symbol).toBe('leaf'));
});

it('does not overwrite a competing tile write until current symbols and version are reviewed', async () => {
  saved.groups = [group()]; await mount();
  const slot = await screen.findByRole('group', { name: 'Tile 1' });
  fireEvent.change(within(slot).getByRole('combobox'), { target: { value: 'leaf' } });
  saved.groups[0].version = 1; saved.groups[0].slots[0].symbol = 'wave';
  fireEvent.click(within(slot).getByRole('button', { name: 'Save tile' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Review latest saved state' }));
  await within(slot).findByText('Saved symbol: Wave');
  expect(within(slot).getByRole('combobox')).toHaveValue('leaf');
  expect(within(slot).getByRole('button', { name: 'Save tile' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Use latest mosaic version and keep tile choices' }));
  fireEvent.click(within(slot).getByRole('button', { name: 'Save tile' }));
  await within(slot).findByText('Saved symbol: Leaf');
});

it('honestly reconciles an invitation response loss without reconstructing its one-time bearer token', async () => {
  saved.groups = [group()]; await mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Invite someone (optional)' }));
  fireEvent.change(screen.getByLabelText('Recipient account ID'), { target: { value: '202' } });
  apiJson.mockImplementationOnce(async (...args) => { await transport(...args); throw new Error('lost response'); });
  fireEvent.click(screen.getByRole('button', { name: 'Create invitation' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved state' }));
  await screen.findByText(/one-time token is no longer available/);
  expect(screen.queryByLabelText('Private invitation token')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revoke invitation' })).toBeInTheDocument();
});

it('preserves unrelated memory drafts through mission saves and restores committed data after an absence/reload', async () => {
  saved.companion.hidden = true;
  saved.memories = [{ id: 'older-card', title: 'A month ago', body: 'A saved moment', date: '2026-09-11', version: 0, createdAt: '2026-09-11T16:00:00Z', updatedAt: '2026-09-11T16:00:00Z', lastRequestId: null }];
  const { unmount } = await mount(); await startMemory();
  const rest = screen.getByRole('article', { name: 'Rest' });
  fireEvent.click(within(rest).getByRole('button', { name: 'Choose' }));
  await within(rest).findByText('Chosen');
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  unmount(); await mount();
  await screen.findByRole('button', { name: 'Restore companion' });
  expect(screen.getByRole('heading', { name: 'A month ago' })).toBeInTheDocument();
  expect(screen.getByText('Chosen')).toBeInTheDocument();
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
});

it('loads in the app StrictMode after its first effect request is aborted', async () => {
  apiJson.mockImplementation(async (url, options) => {
    if (!options?.method) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (options?.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }
    return transport(url, options);
  });
  await mount({ strict: true });
  await screen.findByRole('button', { name: 'New memory' });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('moves focus to the announced save error so retry/reconcile is reachable from a failed keyboard save', async () => {
  await mount(); await startMemory();
  apiJson.mockRejectedValueOnce(new Error('lost response'));
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  expect(await screen.findByRole('alert')).toHaveFocus();
});

it.each([
  ['create', 'Check saved state'], ['update', 'Check saved state'],
  ['create', 'Retry same save'], ['update', 'Retry same save'],
])('retains a %s draft and releases the gate after committed-then-deleted recovery with %s', async (action, recovery) => {
  if (action === 'update') saved.memories.push({ id: 'existing', title: 'Original', body: 'Original text', date: null, version: 0, createdAt: '2026-10-11T16:00:00Z', updatedAt: '2026-10-11T16:00:00Z', lastRequestId: null });
  await mount();
  if (action === 'create') await startMemory();
  else {
    fireEvent.click(await screen.findByRole('button', { name: 'Edit memory' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Quiet afternoon' } });
    fireEvent.change(screen.getByLabelText('Memory text'), { target: { value: '  keep this moment\n' } });
  }
  apiJson.mockImplementationOnce(async (...args) => {
    const committed = await transport(...args);
    saved.memories = [];
    for (const receipt of receipts.values()) if (receipt.result.id === committed.id) receipt.result = { id: committed.id, deleted: true };
    throw new Error('response lost, then deleted in another same-account tab');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: recovery }));
  const outcome = await screen.findByText(/Your save committed, then this memory was later deleted/);
  expect(outcome.closest('[role="status"]')).not.toBe(null);
  expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  expect(screen.getByLabelText('Memory text')).toHaveValue('  keep this moment\n');
  expect(screen.getByRole('button', { name: 'Save memory' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Hide companion' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Discard draft' })).not.toBeDisabled();
  expect(saved.memories).toHaveLength(0);
  const writes = apiJson.mock.calls.filter(([url, options]) => url.includes('/memories') && options?.method);
  expect(writes).toHaveLength(recovery === 'Retry same save' ? 2 : 1);
  if (writes.length === 2) expect(JSON.parse(writes[0][1].body).requestId === JSON.parse(writes[1][1].body).requestId).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Keep draft on this page' }));
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New memory' })).not.toBeDisabled();
  expect(saved.memories).toHaveLength(0);
});

it('rejects a deletion tombstone from a mismatched operation without releasing the pending draft', async () => {
  await mount(); await startMemory();
  apiJson.mockImplementationOnce(async (...args) => {
    const committed = await transport(...args); saved.memories = [];
    for (const receipt of receipts.values()) { receipt.operation = 'memory.update/foreign-card'; receipt.result = { id: committed.id, deleted: true }; }
    throw new Error('response lost');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save memory' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Check saved state' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
  expect(screen.getByRole('button', { name: 'Hide companion' })).toBeDisabled();
  expect(screen.queryByText(/Your save committed, then this memory was later deleted/)).not.toBeInTheDocument();
});

async function prepareGroupCommand(action) {
  if (!['create', 'accept'].includes(action)) {
    saved.groups = [group()];
    if (['tile', 'leave'].includes(action)) Object.assign(saved.groups[0], { ownerAccountId: '202', members: [{ accountId: '202' }, { accountId: '101' }] });
    if (action === 'revoke') saved.groups[0].invites.push({ id: 'invite-a', recipientAccountId: '202', status: 'pending', expiresAt: '2026-10-12T16:00:00Z' });
  }
  await mount();
  fireEvent.change(await screen.findByLabelText('Invitation token'), { target: { value: 'test-only-placeholder' } });
  if (action === 'tile') {
    const first = screen.getByRole('group', { name: 'Tile 1' });
    fireEvent.change(within(first).getByRole('combobox'), { target: { value: 'sun' } });
    fireEvent.change(within(screen.getByRole('group', { name: 'Tile 2' })).getByRole('combobox'), { target: { value: 'leaf' } });
    return within(first).getByRole('button', { name: 'Save tile' });
  }
  if (action === 'invite') {
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone (optional)' }));
    fireEvent.change(screen.getByLabelText('Recipient account ID'), { target: { value: '202' } });
  }
  if (action === 'leave') fireEvent.click(screen.getByRole('button', { name: 'Leave mosaic' }));
  return screen.getByRole('button', { name: ({ create: 'Create solo mosaic', invite: 'Create invitation', accept: 'Accept invitation', revoke: 'Revoke invitation', leave: 'Confirm leave mosaic' })[action] });
}

it.each(['tile', 'create', 'invite', 'accept', 'revoke', 'leave'].flatMap(action => ['Check saved state', 'Retry same save'].map(recovery => [action, recovery])))(
  'releases a tombstoned group %s command through %s without recreation or secret retention', async (action, recovery) => {
  const submit = await prepareGroupCommand(action);
  apiJson.mockImplementationOnce(async (...args) => {
    const committed = await transport(...args);
    const id = committed.group?.id || committed.id;
    saved.groups = [];
    for (const receipt of receipts.values()) if ((receipt.result.group?.id || receipt.result.id) === id) receipt.result = { id, deleted: true };
    throw new Error('response lost, then owner deleted group');
  });
  fireEvent.click(submit);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: recovery }));
  const outcome = await screen.findByText(/Your change committed, then this mosaic was later deleted/);
  expect(outcome.closest('[role="status"]')).not.toBe(null);
  expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  expect(screen.queryByRole('article', { name: 'Your private mosaic' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Private invitation token')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Invitation token')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Hide companion' })).not.toBeDisabled();
  expect(screen.getByRole('button', { name: 'Create solo mosaic' })).not.toBeDisabled();
  expect(saved.groups).toHaveLength(0);
  const writes = apiJson.mock.calls.filter(([, options]) => options?.method);
  expect(writes).toHaveLength(recovery === 'Retry same save' ? 2 : 1);
  if (writes.length === 2) expect(writes[0][1].body).toBe(writes[1][1].body);
  if (action === 'tile') {
    expect(screen.getByText('Retained choice for tile 1: Sun')).toBeInTheDocument();
    expect(screen.getByText('Retained choice for tile 2: Leaf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep tile choices on this page' }));
    expect(screen.getByRole('heading', { name: 'Retained tile choices' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Discard tile choices' }));
    expect(screen.queryByText('Retained choice for tile 1: Sun')).not.toBeInTheDocument();
    expect(saved.groups).toHaveLength(0);
  }
  if (action === 'invite') {
    expect(screen.getByText('Recipient account ID draft: 202')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep invitation draft on this page' }));
    expect(screen.getByRole('heading', { name: 'Retained invitation draft' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Discard invitation draft' }));
    expect(screen.queryByText('Recipient account ID draft: 202')).not.toBeInTheDocument();
  }
  expect(apiJson.mock.calls.filter(([, options]) => options?.method)).toHaveLength(writes.length);
});

it.each(['wrong-operation', 'wrong-request', 'wrong-group', 'extra-fields', 'still-present'].flatMap(fault => ['Check saved state', 'Retry same save'].map(recovery => [fault, recovery])))(
  'rejects a %s group tombstone through %s and keeps the command gated', async (fault, recovery) => {
  const submit = await prepareGroupCommand('tile');
  apiJson.mockImplementationOnce(async (...args) => {
    await transport(...args);
    if (fault !== 'still-present') saved.groups = [];
    for (const receipt of receipts.values()) {
      receipt.result = { id: fault === 'wrong-group' ? 'foreign-group' : 'group-a', deleted: true };
      if (fault === 'wrong-operation') receipt.operation = 'group.create';
      if (fault === 'wrong-request') receipt.requestId = 'foreign-request';
      if (fault === 'extra-fields') receipt.result.members = [];
    }
    throw new Error('response lost');
  });
  fireEvent.click(submit); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: recovery }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Hide companion' })).toBeDisabled();
  expect(screen.queryByText(/Your change committed, then this mosaic was later deleted/)).not.toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Tile 1' })).getByRole('combobox')).toHaveValue('sun');
});

it.each(['accept', 'tile'].flatMap(action => ['Check saved state', 'Retry same save'].map(recovery => [action, recovery])))(
  'recovers lost member %s through %s after same-account leave from a surviving owner group', async (action, recovery) => {
    const submit = await prepareGroupCommand(action);
    await startMemory(); // An unrelated local draft must survive terminal recovery.
    let ownerGroup;
    const ownerMemory = { id: 'owner-private-control', title: 'Owner control', body: 'Owner-only text' };
    const originalOwnerMemory = clone(ownerMemory);
    apiJson.mockImplementationOnce(async (...args) => {
      const committed = await transport(...args);
      ownerGroup = clone(committed);
      ownerGroup.slots[3] = { index: 3, symbol: 'star', contributorAccountId: '202' };
      // Mirror clearMember/scrubGroupReceipts: the owner's group survives,
      // while the departing account's current view no longer contains it.
      ownerGroup.members = ownerGroup.members.filter(member => member.accountId !== '101');
      ownerGroup.slots = ownerGroup.slots.map(slot => slot.contributorAccountId === '101'
        ? { ...slot, symbol: null, contributorAccountId: null } : slot);
      ownerGroup.invites = ownerGroup.invites.filter(invite => invite.recipientAccountId !== '101');
      ownerGroup.complete = ownerGroup.slots.every(slot => slot.symbol !== null);
      for (const receipt of receipts.values()) if (receipt.result.id === committed.id) receipt.result = clone(ownerGroup);
      saved.groups = [];
      throw new Error('committed response lost, then same-account member left in another tab');
    });
    fireEvent.click(submit);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: recovery }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hide companion' })).not.toBeDisabled());
    const outcome = await screen.findByText(/no longer accessible to your account/);
    expect(outcome.closest('[role="status"]')).not.toBe(null);
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(screen.queryByText(/this mosaic was later deleted/)).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Your private mosaic' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Invitation token')).toHaveValue('');
    expect(screen.queryByLabelText('Private invitation token')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide companion' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create solo mosaic' })).not.toBeDisabled();
    expect(screen.getByLabelText('Title')).toHaveValue('Quiet afternoon');
    expect(screen.getByRole('button', { name: 'Discard draft' })).not.toBeDisabled();
    if (action === 'tile') {
      expect(screen.getByText('Retained choice for tile 1: Sun')).toBeInTheDocument();
      expect(screen.getByText('Retained choice for tile 2: Leaf')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Keep tile choices on this page' }));
      expect(screen.getByRole('heading', { name: 'Retained tile choices' })).toHaveFocus();
      fireEvent.click(screen.getByRole('button', { name: 'Discard tile choices' }));
      expect(screen.queryByText('Retained choice for tile 1: Sun')).not.toBeInTheDocument();
    }
    const writes = apiJson.mock.calls.filter(([, options]) => options?.method);
    expect(writes).toHaveLength(recovery === 'Retry same save' ? 2 : 1);
    if (writes.length === 2) expect(writes[0][1].body).toBe(writes[1][1].body);
    expect(ownerGroup.id).toBe('group-a');
    expect(ownerGroup.members).toEqual([{ accountId: '202' }]);
    expect(ownerGroup.slots[0]).toEqual({ index: 0, symbol: null, contributorAccountId: null });
    expect(ownerGroup.slots[3]).toEqual({ index: 3, symbol: 'star', contributorAccountId: '202' });
    expect(ownerMemory).toEqual(originalOwnerMemory);
    expect(saved.groups).toHaveLength(0);
    expect(saved.memories).toHaveLength(0);
  },
);

it.each(['accept', 'tile'].flatMap(action => ['wrong-request', 'wrong-operation', 'malformed', 'still-current', 'wrong-account', ...(action === 'tile' ? ['wrong-group'] : [])]
  .flatMap(fault => ['Check saved state', 'Retry same save'].map(recovery => [action, fault, recovery]))))(
  'denies member %s unavailable recovery for %s through %s', async (action, fault, recovery) => {
    const submit = await prepareGroupCommand(action);
    apiJson.mockImplementationOnce(async (...args) => {
      const committed = await transport(...args);
      const scrubbed = clone(committed);
      scrubbed.members = scrubbed.members.filter(member => member.accountId !== '101');
      scrubbed.slots = scrubbed.slots.map(slot => slot.contributorAccountId === '101' ? { ...slot, symbol: null, contributorAccountId: null } : slot);
      scrubbed.complete = scrubbed.slots.every(slot => slot.symbol !== null);
      for (const receipt of receipts.values()) {
        receipt.result = clone(scrubbed);
        if (fault === 'wrong-request') receipt.requestId = 'wrong-request';
        if (fault === 'wrong-operation') receipt.operation = action === 'accept' ? 'invite.decline' : 'group.slot/group-a/1';
        if (fault === 'malformed') receipt.result.slots.pop();
        if (fault === 'wrong-group') receipt.result.id = 'foreign-group';
      }
      if (fault !== 'still-current') saved.groups = [];
      if (fault === 'wrong-account') saved.accountId = 'foreign-account';
      throw new Error('lost response');
    });
    fireEvent.click(submit); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: recovery }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Hide companion' })).toBeDisabled();
    expect(screen.queryByText(/no longer accessible to your account/)).not.toBeInTheDocument();
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Invitation token')).toHaveValue('test-only-placeholder');
    if (action === 'tile') expect(within(screen.getByRole('group', { name: 'Tile 1' })).getByRole('combobox')).toHaveValue('sun');
  },
);
