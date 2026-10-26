import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AddShoes from '../AddShoes';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiFetch, apiJson } from '../../../api';

const preferences = vi.hoisted(() => ({ lang: 'en', unit: 'km' }));
// Expected copy from the main agent's locale integration.
const pendingCopy = {
  en: {
    'shoes.mileage_limit_invalid': 'Enter a mileage limit from 100 to 2000 km in increments of 50 km.',
    'shoeCatalog.category.all': 'All',
    'shoeCatalog.category.cushion': 'Cushion',
    'shoeCatalog.category.trainer': 'Trainer',
    'shoeCatalog.category.support': 'Support',
    'shoeCatalog.category.trainerrace': 'Trainer/Race',
    'shoeCatalog.category.speed': 'Speed',
    'shoeCatalog.category.race': 'Race',
    'shoeCatalog.category.lowstackrace': 'Low Stack Race',
  },
  'zh-CN': {
    'shoes.mileage_limit_invalid': '请输入 100 至 2000 公里的里程上限，以 50 公里为增量。',
    'shoeCatalog.category.all': '全部',
    'shoeCatalog.category.cushion': '缓震',
    'shoeCatalog.category.trainer': '综训',
    'shoeCatalog.category.support': '支撑',
    'shoeCatalog.category.trainerrace': '综训/竞速',
    'shoeCatalog.category.speed': '速度',
    'shoeCatalog.category.race': '竞速',
    'shoeCatalog.category.lowstackrace': '薄底竞速',
  },
};

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: (key, values = {}) => {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

beforeEach(() => {
  preferences.lang = 'en';
  preferences.unit = 'km';
  localStorage.clear();
  apiJson.mockResolvedValue({ brands: [] });
  apiFetch.mockResolvedValue({ ok: true, status: 201 });
});
afterEach(cleanup);

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/shoes/add']}><Routes>
    <Route path="/shoes/add" element={<AddShoes />} />
    <Route path="/shoes" element={<h1>Saved shoes</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('button', { name: 'Ultraboost' });
  return result;
}

async function selectPair() {
  const result = await openPage();
  fireEvent.click(screen.getByRole('button', { name: 'Ultraboost' }));
  return result;
}

it.each(['en', 'zh-CN'])('rejects a cleared mileage cap with a localized explanation in %s', async (lang) => {
  preferences.lang = lang;
  const { container } = await selectPair();
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '' } });
  expect(container.querySelector('.add-shoes-selected-meta')).toHaveTextContent('--');
  await act(async () => { fireEvent.submit(container.querySelector('.add-shoes-form')); });
  expect(apiFetch).not.toHaveBeenCalled();
  expect(input).toHaveValue(null);
  expect(input).toBeRequired();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(pendingCopy[lang]['shoes.mileage_limit_invalid']);
  expect(screen.getByRole('alert')).toHaveTextContent(pendingCopy[lang]['shoes.mileage_limit_invalid']);
});

it('shows its localized explanation when native validation blocks a blank submit', async () => {
  const { container } = await selectPair();
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.shoes.add_page_complete_setup })); });
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(pendingCopy.en['shoes.mileage_limit_invalid']);
  expect(container.querySelector('.add-shoes-form')).toBeInTheDocument();
});

it.each(['0', '50', '125', '2050'])('rejects cap %s outside the existing UI range or step', async (value) => {
  const { container } = await selectPair();
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value } });
  await act(async () => { fireEvent.submit(container.querySelector('.add-shoes-form')); });
  expect(apiFetch).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(pendingCopy.en['shoes.mileage_limit_invalid']);
});

it.each([100, 500, 2000])('saves the displayed %s km cap with canonical brand and model', async (km) => {
  const { container } = await selectPair();
  const input = screen.getByRole('spinbutton');
  expect(input).toHaveAttribute('min', '100');
  expect(input).toHaveAttribute('max', '2000');
  expect(input).toHaveAttribute('step', '50');
  fireEvent.change(input, { target: { value: String(km) } });
  expect(container.querySelector('.add-shoes-selected-meta')).toHaveTextContent(`${km} km`);
  fireEvent.click(screen.getByRole('button', { name: en.shoes.add_page_complete_setup }));
  await screen.findByRole('heading', { name: 'Saved shoes' });
  expect(apiFetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
    brand: 'Adidas', model: 'Ultraboost', nickname: '', maxDistanceKm: km, isPrimary: false,
  });
});

it('clears the mileage error after correction and saves the corrected value', async () => {
  const { container } = await selectPair();
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '' } });
  await act(async () => { fireEvent.submit(container.querySelector('.add-shoes-form')); });
  expect(apiFetch).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '750' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(input).not.toHaveAttribute('aria-invalid', 'true');
  fireEvent.click(screen.getByRole('button', { name: en.shoes.add_page_complete_setup }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
  expect(JSON.parse(apiFetch.mock.calls[0][1].body).maxDistanceKm).toBe(750);
});

it.each(['en', 'zh-CN'])('localizes Adidas filters, cards, and selection without changing filter identity in %s', async (lang) => {
  preferences.lang = lang;
  const { container } = await openPage();
  const filters = within(container.querySelector('.add-shoes-filter-row'));
  for (const suffix of ['all', 'cushion', 'trainer', 'support', 'trainerrace', 'speed', 'race', 'lowstackrace']) {
    expect(filters.getAllByRole('button', { name: pendingCopy[lang][`shoeCatalog.category.${suffix}`], exact: true }).length).toBeGreaterThan(0);
  }
  const ultraboost = screen.getByRole('button', { name: 'Ultraboost' });
  expect(ultraboost).toHaveTextContent(pendingCopy[lang]['shoeCatalog.category.cushion']);
  fireEvent.click(ultraboost);
  expect(container.querySelector('.add-shoes-selected-summary')).toHaveTextContent(pendingCopy[lang]['shoeCatalog.category.cushion']);
  fireEvent.click(filters.getByRole('button', { name: pendingCopy[lang]['shoeCatalog.category.support'], exact: true }));
  expect(screen.getByRole('button', { name: 'Supernova Sequence' })).toHaveTextContent(pendingCopy[lang]['shoeCatalog.category.support']);
  expect(screen.queryByRole('button', { name: 'Ultraboost' })).toBeNull();
  fireEvent.click(filters.getByRole('button', { name: pendingCopy[lang]['shoeCatalog.category.all'], exact: true }));
  expect(screen.getByRole('button', { name: 'Ultraboost' })).toBeInTheDocument();
});

it('keeps an unknown custom descriptor intact', async () => {
  apiJson.mockResolvedValue({ brands: [{ brand: 'Adidas', models: [{ model: 'Ultraboost', category: 'Custom descriptor', type: 'daily' }] }] });
  const { container } = await selectPair();
  expect(screen.getByRole('button', { name: 'Ultraboost' })).toHaveTextContent('Custom descriptor');
  expect(container.querySelector('.add-shoes-selected-summary')).toHaveTextContent('Custom descriptor');
});

it.each(Object.entries(zh.shoeCatalog.category).filter(([suffix]) => suffix !== 'all'))(
  'localizes the built-in %s descriptor on a model card', async (suffix, category) => {
    apiJson.mockResolvedValue({ brands: [{ brand: 'Adidas', models: [{ model: 'Ultraboost', category, type: 'daily' }] }] });
    await openPage();
    expect(screen.getByRole('button', { name: 'Ultraboost' })).toHaveTextContent(en.shoeCatalog.category[suffix]);
  },
);
