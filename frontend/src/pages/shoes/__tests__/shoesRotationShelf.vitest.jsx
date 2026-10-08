import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Shoes from '../Shoes';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/removeBackground', () => ({ default: async (src) => src, bgRemovedCache: {} }));

let shoes;
beforeEach(() => {
  preferences.lang = 'en';
  preferences.unit = 'km';
  shoes = [
    { id: 1, brand: 'ASICS', model: 'Superblast 2', type: 'daily', isPrimary: true, currentDistanceKm: 412, maxDistanceKm: 600, photoUrl: '/shoe-1.png' },
    { id: 2, brand: 'Nike', model: 'Pegasus 41', type: 'daily', currentDistanceKm: 588, maxDistanceKm: 650, photoUrl: '/shoe-2.png' },
    { id: 3, brand: 'HOKA', model: 'Speedgoat 6', type: 'trail', currentDistanceKm: 186, maxDistanceKm: 700, photoUrl: '/shoe-3.png' },
    { id: 4, brand: 'Saucony', model: 'Endorphin Speed 4', type: 'speed', currentDistanceKm: 412, maxDistanceKm: 600, photoUrl: '/shoe-4.png' },
    { id: 5, brand: 'Adidas', model: 'Adios Pro 3', type: 'race', retired: true, currentDistanceKm: 450, maxDistanceKm: 400, photoUrl: '/shoe-5.png' },
  ];
  cachedApiJson.mockResolvedValue({ displayName: 'Runner' });
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/shoes?')) return shoes;
    if (url === '/api/activities') return [{ id: 1, shoeId: 1, startDateLocal: '2026-10-07T12:00:00Z', distanceKm: 8 }];
    if (url === '/api/shoes/scan-available') return { available: true, tier: 'FREE', scansRemaining: 3, userFreeTotal: 3 };
    return {};
  });
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ clusters: [], candidates: [] }) });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/shoes']}><Routes>
    <Route path="/shoes" element={<Shoes />} />
    <Route path="/shoes/add" element={<h1>Add destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: preferences.lang === 'zh-CN' ? zh.shoes.v2_title : en.shoes.v2_title });
  return result;
}

it('shows actual inventory mileage, warning colors, usage, and working filters', async () => {
  const { container } = await openPage();
  const cards = () => [...container.querySelectorAll('.shoe-v2-card')];
  expect(cards()).toHaveLength(4);
  const nike = cards().find((card) => card.textContent.includes('Pegasus'));
  expect(nike).toHaveClass('is-critical');
  expect(nike).toHaveTextContent('62 km left');
  expect(cards().find((card) => card.textContent.includes('Superblast'))).toHaveTextContent('1 uses');
  expect(cards().find((card) => card.textContent.includes('Superblast'))).toHaveTextContent('last Oct 7');
  fireEvent.click(within(container.querySelector('.shoe-v2-chips')).getByRole('button', { name: 'Race' }));
  expect(cards()).toHaveLength(1);
  expect(cards()[0]).toHaveTextContent('Endorphin');
  fireEvent.click(screen.getByRole('button', { name: en.shoes.stitch_reset }));
  fireEvent.change(screen.getByRole('combobox', { name: en.shoes.stitch_brand_label }), { target: { value: 'Nike' } });
  expect(cards()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: en.shoes.stitch_reset }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Speedgoat' } });
  expect(cards()).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: en.shoes.stitch_reset }));
  fireEvent.change(screen.getByRole('combobox', { name: en.shoes.v2_sort_label }), { target: { value: 'mileage' } });
  expect(cards()[0]).toHaveTextContent('Pegasus');
  fireEvent.click(within(container.querySelector('.shoe-v2-segmented')).getByRole('button', { name: /Retired/ }));
  expect(cards()).toHaveLength(1);
  expect(container.querySelector('.shoe-v2-add-card')).toBeNull();
  expect(cards()[0]).toHaveClass('is-retired');
});

it('opens shoe actions with keyboard focus and returns focus on Escape', async () => {
  const { container } = await openPage();
  const card = [...container.querySelectorAll('.shoe-v2-card')].find((item) => item.textContent.includes('Superblast'));
  const trigger = within(card).getByRole('button', { name: /Actions for/ });
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const menu = screen.getByRole('menu');
  expect(within(menu).getByRole('menuitem', { name: en.shoes.edit })).toHaveFocus();
  fireEvent.keyDown(menu, { key: 'End' });
  expect(within(menu).getByRole('menuitem', { name: en.shoes.delete_shoe })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('menuitem', { name: en.shoes.edit }));
  expect(screen.getByRole('dialog')).toHaveTextContent(en.shoes.edit);
});

it('keeps photo and delete dialogs reachable from the redesigned card', async () => {
  const { container } = await openPage();
  const card = container.querySelector('.shoe-v2-card');
  fireEvent.click(within(card).getByRole('button', { name: /Change photo for/ }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: en.common.close })[0]);
  fireEvent.click(within(card).getByRole('button', { name: /Actions for/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: en.shoes.delete_shoe }));
  expect(screen.getByRole('dialog')).toHaveTextContent(en.shoes.delete_v2_title);
  expect(apiJson).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'DELETE' }));
});

it('keeps the add-pair tile available for an empty inventory and supports Chinese and miles', async () => {
  shoes = [];
  preferences.lang = 'zh-CN';
  preferences.unit = 'mile';
  const { container } = await openPage();
  expect(container.querySelector('.shoe-v2-head-copy')).toHaveTextContent('0 双在用');
  fireEvent.click(container.querySelector('.shoe-v2-add-card'));
  expect(screen.getByRole('heading', { name: 'Add destination' })).toBeInTheDocument();
});

it('renders large collections as virtualized shelf rows without losing the row props', async () => {
  shoes = Array.from({ length: 25 }, (_, index) => ({ ...shoes[0], id: index + 1, model: `Shoe ${index + 1}` }));
  const { container } = await openPage();
  expect(container.querySelector('.shoe-inventory-virtual-list')).toBeInTheDocument();
  expect(container.querySelectorAll('.shoe-v2-card').length).toBeGreaterThan(0);
  expect(container.querySelectorAll('.shoe-v2-card').length).toBeLessThan(25);
  expect(container.querySelector('.shoe-v2-virtual-row').querySelectorAll('.shoe-v2-card')).toHaveLength(4);
});

it('converts both mileage and remaining life to miles', async () => {
  preferences.unit = 'mile';
  const { container } = await openPage();
  const asics = [...container.querySelectorAll('.shoe-v2-card')].find((card) => card.textContent.includes('Superblast'));
  expect(asics.querySelector('.shoe-v2-mileage')).toHaveTextContent('256/ 373 mi');
  expect(asics.querySelector('.shoe-v2-left')).toHaveTextContent('117 mi left');
});

async function openEditor() {
  const { container } = await openPage();
  fireEvent.click(container.querySelector('.shoe-v2-model'));
  return screen.getByRole('dialog');
}

it('updates the edit header and enables Save only while the draft differs', async () => {
  const dialog = await openEditor();
  const save = within(dialog).getByRole('button', { name: en.shoes.save });
  expect(save).toBeDisabled();
  expect(dialog).toHaveTextContent(en.shoes.edit_v2_no_changes);
  fireEvent.change(within(dialog).getByRole('textbox', { name: en.shoes.model }), { target: { value: 'Superblast 3' } });
  expect(within(dialog).getByRole('heading')).toHaveTextContent('ASICS Superblast 3');
  expect(save).toBeEnabled();
  expect(dialog).toHaveTextContent(en.shoes.edit_v2_unsaved);
  fireEvent.change(within(dialog).getByRole('textbox', { name: en.shoes.model }), { target: { value: 'Superblast 2' } });
  expect(save).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('textbox', { name: /Nickname/ }), { target: { value: 'Long run' } });
  expect(dialog.querySelector('.edit-v2-meta')).toHaveTextContent('“Long run” · 412 km · 1 uses');
  fireEvent.click(within(dialog).getByRole('button', { name: en.shoes.cancel }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Superblast 2' }));
  expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: /Nickname/ })).toHaveValue('');
});

it('keeps mileage presets and the primary switch in the draft until Save', async () => {
  const dialog = await openEditor();
  const slider = within(dialog).getByRole('slider');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Race 400 km' }));
  expect(slider).toHaveValue('400');
  expect(dialog.querySelector('.edit-v2-usage-bar i')).toHaveClass('is-critical');
  expect(dialog.querySelector('.edit-v2-usage-bar i')).toHaveStyle({ width: '100%' });
  expect(dialog).toHaveTextContent(en.shoes.retirement_past_due);
  fireEvent.change(slider, { target: { value: '750' } });
  expect(dialog).toHaveTextContent('338 km left');
  expect(dialog.querySelector('.edit-v2-usage-bar i')).toHaveClass('is-good');
  fireEvent.click(within(dialog).getByRole('switch', { name: en.shoes.set_primary }));
  expect(within(dialog).getByRole('switch')).not.toBeChecked();
  expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole('button', { name: en.shoes.save }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(apiFetch).toHaveBeenCalledWith('/api/shoes/1', expect.objectContaining({
    method: 'PUT', body: JSON.stringify({ brand: 'ASICS', model: 'Superblast 2', nickname: '', maxDistanceKm: 750, isPrimary: false }),
  }));
});

it('protects a pending save and keeps the draft available after a failed response', async () => {
  const dialog = await openEditor();
  let finishSave;
  apiFetch.mockImplementation((url, options) => options?.method === 'PUT'
    ? new Promise((resolve) => { finishSave = resolve; })
    : Promise.resolve({ ok: true, json: async () => ({ clusters: [], candidates: [] }) }));
  fireEvent.change(within(dialog).getByRole('textbox', { name: /Nickname/ }), { target: { value: 'Long run' } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.shoes.save }));
  expect(within(dialog).getByRole('button', { name: en.shoes.edit_v2_saving })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: en.shoes.cancel })).toBeDisabled();
  expect(within(dialog).getByRole('slider')).toBeDisabled();
  fireEvent.keyDown(window, { key: 'Escape' });
  fireEvent.submit(dialog.querySelector('form'));
  expect(apiFetch.mock.calls.filter(([, options]) => options?.method === 'PUT')).toHaveLength(1);
  await act(async () => { finishSave({ ok: false }); });
  expect(within(dialog).getByRole('alert')).toHaveTextContent(en.shoes.add_page_error);
  expect(within(dialog).getByRole('textbox', { name: /Nickname/ })).toHaveValue('Long run');
  expect(within(dialog).getByRole('button', { name: en.shoes.save })).toBeEnabled();
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ clusters: [], candidates: [] }) });
  fireEvent.click(within(dialog).getByRole('button', { name: en.shoes.save }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('localizes the modal and displays usage in miles while preserving kilometer limit values', async () => {
  preferences.lang = 'zh-CN';
  preferences.unit = 'mile';
  shoes[0].maxDistanceKm = 750;
  const dialog = await openEditor();
  expect(dialog).toHaveTextContent(zh.shoes.edit_v2_limit);
  expect(dialog.querySelector('.edit-v2-limit-head')).toHaveTextContent('750公里');
  expect(dialog.querySelector('.edit-v2-meta')).toHaveTextContent('256 英里');
  expect(dialog.querySelector('.edit-v2-usage')).toHaveTextContent('210 英里');
  expect(within(dialog).getByRole('button', { name: '竞速鞋 400 公里' })).toBeInTheDocument();
  expect(within(dialog).getByRole('switch', { name: zh.shoes.set_primary })).toBeChecked();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});
