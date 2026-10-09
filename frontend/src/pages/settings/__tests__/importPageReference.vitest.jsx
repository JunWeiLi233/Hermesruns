import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ImportDataSettings from '../ImportDataSettings';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiFetch } from '../../../api';
import { invalidateResourceCache } from '../../../api/resourceCache';

const state = vi.hoisted(() => ({ lang: 'en' }));
function t(key, values = {}) {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t }) }));
vi.mock('../../../api', () => ({ apiFetch: vi.fn() }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: async () => ({ displayName: 'Alex' }), invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

beforeEach(() => { state.lang = 'en'; apiFetch.mockReset(); apiFetch.mockResolvedValue({ ok: true }); });
afterEach(cleanup);
const file = (name) => new File(['activity'], name, { type: 'application/octet-stream' });
function openPage() {
  return render(<MemoryRouter initialEntries={['/settings/import-data']}><Routes>
    <Route path="/settings/import-data" element={<ImportDataSettings />} />
    <Route path="/settings" element={<h1>Settings destination</h1>} />
    <Route path="/runs" element={<h1>Runs destination</h1>} />
  </Routes></MemoryRouter>);
}

it('keeps the actual sidebar and top bar around a single inline upload form', () => {
  const { container } = openPage();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toHaveTextContent(en.profile.import_data);
  expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(container.querySelector('.import-page-v2-guide')).toHaveTextContent(en.profile.import_guide_detail_generic);
});

it('changes the export guide when tabs are selected with the mouse or keyboard', async () => {
  const user = userEvent.setup();
  const { container } = openPage();
  await user.click(screen.getByRole('tab', { name: /Huawei/ }));
  expect(container.querySelector('.import-page-v2-provider')).toHaveTextContent(en.profile.import_guide_detail_huawei);
  await user.keyboard('{ArrowLeft}');
  expect(screen.getByRole('tab', { name: /COROS/ })).toHaveFocus();
  expect(container.querySelector('.import-page-v2-provider')).toHaveTextContent(en.profile.import_guide_detail_coros);
  expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: /COROS/ }).id);
});

it('uploads mixed sources, clears the queue, reports success, and opens the run list', async () => {
  const user = userEvent.setup();
  const { container } = openPage();
  await user.upload(container.querySelector('input[type="file"]'), file('morning.fit'));
  await user.click(screen.getByRole('tab', { name: /COROS/ }));
  fireEvent.drop(container.querySelector('.import-v2-drop'), { dataTransfer: { files: [file('coros.zip')] } });
  expect(container.querySelectorAll('.import-v2-file')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Import 2 file(s)' }));
  await waitFor(() => expect(container.querySelector('.import-page-v2-success')).toHaveTextContent('Imported 2 files'));
  const [endpoint, options] = apiFetch.mock.calls[0];
  expect(endpoint).toBe('/api/import/batch'); expect(options.method).toBe('POST');
  expect([...options.body.entries()].map(([field, entry]) => [field, entry.name])).toEqual([['exports', 'morning.fit'], ['coros', 'coros.zip']]);
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
  expect(container.querySelectorAll('.import-v2-file')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: `${en.profile.garmin_v2_view_runs} →` }));
  expect(screen.getByRole('heading', { name: 'Runs destination' })).toBeInTheDocument();
});

it('keeps failed files available for retry and avoids displaying the previous success banner', async () => {
  const user = userEvent.setup();
  const { container } = openPage();
  const upload = async (name) => {
    await user.upload(container.querySelector('input[type="file"]'), file(name));
    await user.click(screen.getByRole('button', { name: 'Import 1 file(s)' }));
  };
  await upload('first.fit');
  await waitFor(() => expect(container.querySelector('.import-page-v2-success')).toBeInTheDocument());
  apiFetch.mockResolvedValueOnce({ ok: false });
  await upload('retry.gpx');
  expect(await screen.findByRole('alert')).toHaveTextContent(en.profile.import_failed);
  expect(container.querySelector('.import-page-v2-success')).not.toBeInTheDocument();
  expect(container.querySelector('.import-v2-file')).toHaveTextContent('retry.gpx');
  await user.click(screen.getByRole('button', { name: 'Import 1 file(s)' }));
  await waitFor(() => expect(container.querySelector('.import-page-v2-success')).toBeInTheDocument());
  expect(apiFetch).toHaveBeenCalledTimes(3);
});

it.each(['.import-page-v2-back', '.import-v2-cancel', '.import-page-v2-sync .is-strava', '.import-page-v2-sync .is-garmin'])('returns to Settings from %s', (selector) => {
  const { container } = openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: 'Settings destination' })).toBeInTheDocument();
});

it('renders the source guide and new feedback in Chinese', async () => {
  state.lang = 'zh-CN';
  const user = userEvent.setup();
  const { container } = openPage();
  expect(container.querySelector('.import-page-v2-sync')).toHaveTextContent(zh.settings.import_v2_auto_sync);
  await user.upload(container.querySelector('input[type="file"]'), file('morning.fit'));
  await user.click(screen.getByRole('button', { name: t('profile.upload_file_count', { count: 1 }) }));
  await waitFor(() => expect(container.querySelector('.import-page-v2-success')).toHaveTextContent(t('settings.import_v2_success', { count: 1 })));
  expect(container.textContent).not.toMatch(/settings\.import_v2|profile\.import_|\{count\}/);
});
