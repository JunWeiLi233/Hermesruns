import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Shoes from '../Shoes';
import en from '../../../i18n/locales/en';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import removeBackground, { bgRemovedCache } from '../../../utils/removeBackground';

const images = vi.hoisted(() => ({ result: '/processed-shoe.png' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key, values = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/removeBackground', () => ({ default: vi.fn(async () => images.result), bgRemovedCache: {} }));

beforeEach(() => {
  images.result = '/processed-shoe.png';
  for (const key of Object.keys(bgRemovedCache)) delete bgRemovedCache[key];
  vi.clearAllMocks();
  cachedApiJson.mockResolvedValue({ displayName: 'Runner' });
  apiJson.mockImplementation(async (url) => {
    if (url.startsWith('/api/shoes?')) return [{ id: 1, brand: 'ASICS', model: 'Superblast 2',
      type: 'daily', currentDistanceKm: 10, maxDistanceKm: 600, photoUrl: '/shoe.png' }];
    if (url === '/api/activities') return [];
    if (url === '/api/shoes/scan-available') return { available: true, tier: 'FREE', scansRemaining: 3, userFreeTotal: 3 };
    return {};
  });
  apiFetch.mockImplementation(async (url) => url === '/api/shoes/scan-image'
    ? new Promise(() => {}) : { ok: true, json: async () => ({ clusters: [], candidates: [] }) });
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:shoe-preview');
    static revokeObjectURL = vi.fn();
  });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close: vi.fn() }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['image'], { type: 'image/jpeg' })));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openShoes() {
  const result = render(<MemoryRouter><Shoes /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: en.shoes.v2_title });
  await waitFor(() => expect(result.container.querySelector('.shoe-v2-card')).not.toBeNull());
  await act(async () => {});
  return result;
}

const unsafe = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'data:image/svg+xml,<svg onload="alert(1)"/>'];
it.each(unsafe)('does not render an unsafe background-removal result: %s', async (value) => {
  images.result = value;
  const { container } = await openShoes();
  expect(removeBackground).toHaveBeenCalled();
  expect(container.querySelector('.shoe-v2-card .shoe-img')).toBeNull();
  expect(container.querySelector('.shoe-v2-card .shoe-img-placeholder')).not.toBeNull();
});

it('validates a cached processed image before it reaches the image element', async () => {
  bgRemovedCache[new URL('/shoe.png', window.location.origin).href] = unsafe[1];
  const { container } = await openShoes();
  expect(removeBackground).not.toHaveBeenCalled();
  expect(container.querySelector('.shoe-v2-card .shoe-img')).toBeNull();
});

it.each([
  'https://images.example.test/shoe.png?name=blue&size=800#photo',
  '/shoe.png?name=blue&size=800#photo',
  'blob:shoe-preview',
  'data:image/png;base64,aW1hZ2U=',
])('preserves the supported processed image source: %s', async (value) => {
  images.result = value;
  const { container } = await openShoes();
  expect(container.querySelector('.shoe-v2-card .shoe-img')).toHaveAttribute('src', new URL(value, window.location.origin).href);
});

it.each([unsafe[0], unsafe[1], 'blob:shoe-preview'])('validates scan thumbnail URLs before and during processing: %s', async (value) => {
  URL.createObjectURL.mockReturnValue(value);
  await openShoes();
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.shoes.v2_scan_photo) }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(en.shoes.scan_v2_step_upload), {
    target: { files: [new File(['image'], 'shoe.png', { type: 'image/png' })] },
  });
  const checkThumbnail = () => {
    const image = dialog.querySelector('.scan-v2-thumb img');
    expect(image).not.toBeNull();
    if (value.startsWith('blob:')) expect(image).toHaveAttribute('src', value);
    else expect(image).not.toHaveAttribute('src');
  };
  checkThumbnail();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Scan 1 images' }));
  await within(dialog).findByRole('status');
  checkThumbnail();
});
