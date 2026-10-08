import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
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

let quota;
let scanResponse;
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
const file = (name) => new File(['image'], name, { type: 'image/png', lastModified: 1 });
beforeEach(() => {
  preferences.lang = 'en';
  quota = { available: true, tier: 'FREE', scansRemaining: 3, userFreeTotal: 5 };
  scanResponse = response({ raw: JSON.stringify([{ brand: 'Nike', model: 'Pegasus 41', distanceKm: 350 }]) });
  cachedApiJson.mockResolvedValue({ displayName: 'Runner' });
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/shoes?') || url === '/api/activities') return [];
    if (url === '/api/shoes/scan-available') return quota;
    return {};
  });
  apiFetch.mockImplementation(async (url) => {
    if (url === '/api/shoes/scan-image') return scanResponse;
    if (url === '/api/shoes/match-batch') return response({ results: [{ index: 0, matches: [{ id: 7, currentDistanceKm: 230, initialDistanceKm: 180 }] }] });
    return response({ clusters: [] });
  });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn((image) => `blob:${image.name}`);
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['compressed'], { type: 'image/jpeg' })));
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

async function openScan() {
  render(<MemoryRouter><Shoes /></MemoryRouter>);
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(dictionary.shoes.v2_scan_photo) }));
  const dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByLabelText(dictionary.shoes.scan_v2_step_upload)).toBeInTheDocument());
  return dialog;
}

it('accepts multiple selections and drops, caps at five, and lets a removed image be selected again', async () => {
  const dialog = await openScan();
  const input = within(dialog).getByLabelText('Upload');
  fireEvent.change(input, { target: { files: [file('one.png'), file('two.png')] } });
  fireEvent.drop(input.closest('label'), { dataTransfer: { files: [file('two.png'), file('three.png'), file('four.png'), file('five.png'), file('six.png'), new File(['text'], 'note.txt', { type: 'text/plain' })] } });
  expect(within(dialog).getAllByRole('img')).toHaveLength(5);
  expect(within(dialog).getByRole('button', { name: 'Scan 5 images' })).toBeEnabled();
  expect(window.alert).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove screenshot 1' }));
  expect(input).toBeEnabled();
  fireEvent.change(input, { target: { files: [file('one.png')] } });
  expect(within(dialog).getAllByRole('img')).toHaveLength(5);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one.png');
});

it('keeps the processing dialog open and saves the edited scanned mileage for a duplicate', async () => {
  const dialog = await openScan();
  let resolveScan;
  scanResponse = new Promise((resolve) => { resolveScan = resolve; });
  fireEvent.change(within(dialog).getByLabelText('Upload'), { target: { files: [file('one.png')] } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Scan 1 images' }));
  await waitFor(() => expect(within(dialog).getByRole('status')).toBeInTheDocument());
  fireEvent.click(within(dialog).getByRole('button', { name: en.shoes.close }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: en.shoes.cancel })).toBeDisabled();
  resolveScan(response({ raw: JSON.stringify([{ brand: 'Nike', model: 'Pegasus 41', distanceKm: 350 }]) }));
  const useScanned = await within(dialog).findByRole('button', { name: en.shoes.scan_use_scanned });
  fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '400' } });
  fireEvent.click(useScanned);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Import 1 shoes' }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/shoes/7', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ initialDistanceKm: 350 }) })));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it('shows the Chinese upload copy and real quota, blocking scans when exhausted', async () => {
  preferences.lang = 'zh-CN';
  quota.scansRemaining = 0;
  const dialog = await openScan();
  expect(dialog).toHaveTextContent('AI 识图剩余 0 / 5 次');
  expect(dialog).toHaveTextContent('累计里程');
  fireEvent.change(within(dialog).getByLabelText('上传截图'), { target: { files: [file('one.png')] } });
  expect(within(dialog).getByRole('button', { name: '开始识别 1 张' })).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalledWith('/api/shoes/scan-image', expect.anything());
});

it('allows an unlimited account with no numeric quota remaining to scan', async () => {
  quota = { available: true, unlimited: true, scansRemaining: 0 };
  const dialog = await openScan();
  fireEvent.change(within(dialog).getByLabelText('Upload'), { target: { files: [file('one.png')] } });
  expect(within(dialog).getByRole('button', { name: 'Scan 1 images' })).toBeEnabled();
});

it('keeps failed scans retryable and revokes thumbnails on unmount', async () => {
  scanResponse = response({}, false, 500);
  const dialog = await openScan();
  fireEvent.change(within(dialog).getByLabelText('Upload'), { target: { files: [file('one.png')] } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Scan 1 images' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(en.shoes.scan_failed);
  expect(within(dialog).getByRole('button', { name: 'Scan 1 images' })).toBeEnabled();
  cleanup();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one.png');
});

it('shows a retry notice for a service rate limit without treating it as exhausted quota', async () => {
  scanResponse = response({ error: 'Too many AI requests. Try again later.' }, false, 429);
  const dialog = await openScan();
  fireEvent.change(within(dialog).getByLabelText('Upload'), { target: { files: [file('one.png')] } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Scan 1 images' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(en.shoes.scan_rate_limited);
  expect(dialog).toHaveTextContent('AI scans left: 3 / 5');
});
