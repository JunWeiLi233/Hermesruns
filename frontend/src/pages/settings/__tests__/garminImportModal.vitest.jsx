import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import translations from '../../../i18n/translations';
import { apiFetch, apiJson } from '../../../api';
import { invalidateResourceCache } from '../../../api/resourceCache';
import GarminImportSettings from '../GarminImportSettings';

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn() }));
vi.mock('../../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
vi.mock('../../../components/AuthenticatedPageChrome', () => ({ default: ({ children }) => children }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t, lang: 'en' }) }));

function t(key, params = {}) {
  const value = key.split('.').reduce((result, part) => result?.[part], translations.en) ?? key;
  return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement), value);
}
const renderModal = (props = {}) => render(<GarminImportSettings embedded onClose={vi.fn()} {...props} />);
const fillCredentials = async (user) => {
  await user.type(screen.getByLabelText('Garmin Connect email'), 'preview@example.test');
  await user.type(screen.getByLabelText('Garmin Connect password'), 'fixture-password');
};
const poll = async (delay = 3000) => act(async () => { await vi.advanceTimersByTimeAsync(delay); });

beforeEach(() => {
  navigate.mockReset();
  invalidateResourceCache.mockReset();
  apiFetch.mockReset();
  apiJson.mockReset();
  apiFetch.mockResolvedValue({ ok: true, status: 200 });
  apiJson.mockImplementation(async (url) => url.endsWith('/wellness/status') ? { wellnessSyncEnabled: false, syncStatus: { active: false } } : {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Garmin import modal', () => {
  it('shows the focused form with a password toggle and all activity counts', async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByRole('button', { name: 'Import last 50' })).toBeDisabled();
    expect(screen.getAllByRole('heading', { name: 'Import from Garmin Connect' })).toHaveLength(1);
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Show', exact: true }));
    expect(screen.getByLabelText('Garmin Connect password')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide', exact: true }));
    expect(screen.getByLabelText('Garmin Connect password')).toHaveAttribute('type', 'password');
    for (const count of [10, 25, 50, 100, 200]) expect(screen.getByRole('button', { name: String(count), exact: true })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '200', exact: true }));
    expect(screen.getByRole('button', { name: '200', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Import last 200' }));
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ garminEmail: 'preview@example.test', garminPassword: 'fixture-password', limit: 200 });
    expect(apiJson.mock.calls.some(([url]) => url.endsWith('/wellness/credentials'))).toBe(false);
  });

  it('polls the server job, treats duplicate-only completion as success, and opens Runs', async () => {
    vi.useFakeTimers();
    apiJson.mockImplementation(async (url) => {
      if (url.endsWith('/wellness/status')) return { wellnessSyncEnabled: false };
      return { active: false, status: 'COMPLETED', importedRuns: 0, importedPoints: 0 };
    });
    renderModal();
    fireEvent.change(screen.getByLabelText('Garmin Connect email'), { target: { value: 'preview@example.test' } });
    fireEvent.change(screen.getByLabelText('Garmin Connect password'), { target: { value: 'fixture-password' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import last 50' })); });
    expect(screen.queryByLabelText('Garmin Connect email')).not.toBeInTheDocument();
    await poll();
    expect(screen.getByRole('button', { name: 'View runs' })).toBeEnabled();
    expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
    fireEvent.click(screen.getByRole('button', { name: 'View runs' }));
    expect(navigate).toHaveBeenCalledWith('/runs');
  });

  it('stops polling after closing while the server-side job continues', async () => {
    vi.useFakeTimers();
    apiJson.mockImplementation(async (url) => url.endsWith('/wellness/status') ? { wellnessSyncEnabled: false } : { active: true, importedRuns: 3 });
    const onClose = vi.fn();
    const view = renderModal({ onClose });
    fireEvent.change(screen.getByLabelText('Garmin Connect email'), { target: { value: 'preview@example.test' } });
    fireEvent.change(screen.getByLabelText('Garmin Connect password'), { target: { value: 'fixture-password' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Import last 50' })); });
    fireEvent.submit(document.querySelector('.garmin-v2'));
    expect(apiFetch).toHaveBeenCalledOnce();
    await poll();
    expect(screen.getByRole('status')).toHaveTextContent('Imported 3 activities');
    fireEvent.click(screen.getByRole('button', { name: 'Continue in background' }));
    expect(onClose).toHaveBeenCalledOnce();
    const before = apiJson.mock.calls.length;
    view.unmount();
    await poll(10000);
    expect(apiJson.mock.calls).toHaveLength(before);
  });

  it('keeps credentials editable after an import failure so the user can retry', async () => {
    const user = userEvent.setup();
    apiFetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Incorrect credentials' }) });
    renderModal();
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Import last 50' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect credentials');
    expect(screen.getByLabelText('Garmin Connect password')).toBeEnabled();
    expect(apiJson.mock.calls.some(([url]) => url.endsWith('/wellness/credentials'))).toBe(false);
  });

  it('allows background closing only after the import request is accepted', async () => {
    const user = userEvent.setup();
    let resolveImport;
    apiFetch.mockImplementation(() => new Promise((resolve) => { resolveImport = resolve; }));
    const onClose = vi.fn();
    renderModal({ onClose });
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Import last 50' }));
    expect(screen.getByRole('button', { name: 'Continue in background' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { resolveImport({ ok: true, status: 200 }); });
    await user.click(screen.getByRole('button', { name: 'Continue in background' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('saves credentials only when the user enables health auto-sync', async () => {
    const user = userEvent.setup();
    renderModal();
    await fillCredentials(user);
    const toggle = screen.getByRole('switch', { name: 'Auto-sync wellness data' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    const writes = apiJson.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(writes.map(([url]) => url)).toEqual(['/api/garmin/connect/wellness/credentials', '/api/garmin/connect/wellness/toggle']);
    expect(JSON.parse(writes[1][1].body)).toEqual({ enabled: true });
    expect(screen.getByText(t('profile.garmin_v2_saved_note'))).toBeInTheDocument();
  });

  it('loads the existing health-sync setting and can disable it without saving credentials', async () => {
    const user = userEvent.setup();
    apiJson.mockImplementation(async (url) => url.endsWith('/wellness/status') ? { wellnessSyncEnabled: true } : { wellnessSyncEnabled: false });
    renderModal();
    const toggle = screen.getByRole('switch', { name: 'Auto-sync wellness data' });
    await waitFor(() => expect(toggle).toBeChecked());
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(apiJson.mock.calls.some(([url]) => url.endsWith('/wellness/credentials'))).toBe(false);
  });

  it('shows a health-sync failure without changing the switch to enabled', async () => {
    const user = userEvent.setup();
    apiJson.mockImplementation(async (url) => {
      if (url.endsWith('/wellness/status')) return { wellnessSyncEnabled: false };
      throw new Error('Fixture failure');
    });
    renderModal();
    await fillCredentials(user);
    const toggle = screen.getByRole('switch', { name: 'Auto-sync wellness data' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByText(t('profile.garmin_wellness_failed'))).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  it('retains the full-page form and explicit wellness actions', () => {
    render(<GarminImportSettings />);
    expect(document.querySelector('.garmin-profile-main-grid')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('50');
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Credentials' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reads the nested wellness status when the full-page sync completes', async () => {
    vi.useFakeTimers();
    apiJson.mockResolvedValue({ wellnessSyncEnabled: true, syncStatus: { active: false, status: 'COMPLETED' }, lastSyncedAt: '2026-10-07T12:00:00Z' });
    render(<GarminImportSettings />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sync Now' })); });
    await poll(2500);
    expect(screen.getByText(t('profile.garmin_wellness_success'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync Now' })).toBeEnabled();
  });
});
