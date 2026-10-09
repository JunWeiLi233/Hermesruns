import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Settings from '../Settings';
import { apiFetch, apiJson } from '../../../api';
import { invalidateResourceCache } from '../../../api/resourceCache';
import { downloadBlob } from '../../../utils/downloadBlob';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

const state = vi.hoisted(() => ({
  lang: 'en', linked: true, logout: vi.fn(), setUnit: vi.fn(), setTheme: vi.fn(), setLang: vi.fn(),
  profileTimeZone: 'America/New_York', deviceZone: 'Europe/Copenhagen',
  unlink: { unlinked: true, revokedAtStrava: true, removedActivities: 2 },
  failures: {},
}));
const t = (key, params = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
vi.mock('../../../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ invalidateResourceCache: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, authHydrated: true, logout: state.logout }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t, locale: { label: state.lang === 'en' ? 'English' : '简体中文' }, setLang: state.setLang }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', setTheme: state.setTheme }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km', setUnit: state.setUnit }) }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../utils/timeZone', () => ({
  getDeviceTimeZone: () => state.deviceZone,
  listTimeZones: (...extra) => [...new Set(['America/New_York', 'Asia/Tokyo', 'Europe/Copenhagen', 'UTC', ...extra.filter(Boolean)])],
}));
vi.mock('../../../utils/downloadBlob', async (importOriginal) => ({ ...(await importOriginal()), downloadBlob: vi.fn() }));

beforeEach(() => {
  state.lang = 'en'; state.linked = true;
  state.profileTimeZone = 'America/New_York'; state.deviceZone = 'Europe/Copenhagen';
  state.unlink = { unlinked: true, revokedAtStrava: true, removedActivities: 2 };
  state.failures = {};
  invalidateResourceCache.mockReset(); downloadBlob.mockReset();
  state.logout.mockReset(); state.setUnit.mockReset(); state.setTheme.mockReset(); state.setLang.mockReset();
  localStorage.clear();
  localStorage.setItem('hermes.settings.mantra', 'Easy days easy, hard days hard.');
  localStorage.setItem('hermes.settings.digest', '1');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  apiFetch.mockReset(); apiFetch.mockResolvedValue({ ok: true });
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (state.failures[url]) throw Object.assign(new Error('Request failed'), { status: state.failures[url] });
    if (url === '/api/profile/me') return { displayName: 'Mira Chen', email: 'preview@example.test', timeZone: state.profileTimeZone };
    if (url === '/api/profile/me/time-zone') return { displayName: 'Mira Chen', timeZone: JSON.parse(options.body).timeZone };
    if (url === '/api/auth/strava/unlink') return state.unlink;
    if (url === '/api/account') return { deleted: true };
    if (url === '/api/profile/me/name') return { displayName: JSON.parse(options.body).displayName };
    if (url === '/api/profile/me/avatar') return { avatarUrl: options.method === 'DELETE' ? null : '/avatar.png' };
    if (url === '/api/auth/strava/status') return { linked: state.linked, lastSyncAt: '2026-10-07T12:00:00Z' };
    if (url === '/api/wellness/source-preferences') return { sleep: 'garmin', hrv: 'apple_health' };
    if (url === '/api/activities') return [{ id: 1, startTime: new Date().toISOString(), distanceKm: 10 }];
    return {};
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/settings']}><Routes>
    <Route path="/settings" element={<Settings />} />
    <Route path="/settings/import-data" element={<h1>Import destination</h1>} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('textbox', { name: t('settings.display_name_title') });
  return result;
}

async function openTab(user, name) {
  await user.click(screen.getByRole('tab', { name }));
}

async function openStravaDisconnectDialog(user, connections) {
  await user.click(within(connections).getByRole('button', { name: t('settings.strava_disconnect'), exact: true }));
  return screen.findByRole('dialog', { name: t('settings.strava_disconnect_title') });
}

async function disconnectStrava(user, connections) {
  const dialog = await openStravaDisconnectDialog(user, connections);
  await user.click(within(dialog).getByRole('button', { name: t('settings.strava_disconnect_confirm') }));
  await waitFor(() => expect(within(connections).getByRole('button', { name: t('settings.stitch_connect'), exact: true })).toBeInTheDocument());
}

const unlinkCalls = () => apiJson.mock.calls.filter(([url]) => url === '/api/auth/strava/unlink');

it('retains shell navigation and setup progress while showing only the profile group initially', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toHaveTextContent('Settings');
  expect(container.querySelectorAll('.st-v2-group')).toHaveLength(6);
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'st-v2-profile');
  expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: t('settings.stitch_imperial_label') })).not.toBeInTheDocument();
  expect(container.querySelector('.st-v2-setup-head')).toHaveTextContent('4 / 4');
  await waitFor(() => expect(container.querySelector('.st-activity-summary')).toHaveTextContent('1'));
  expect(container.querySelector('#st-v2-connections')).toHaveTextContent(t('settings.stitch_garmin_ready'));
  expect(container.querySelector('#st-v2-notifications')).toHaveTextContent(t('settings.stitch_wellness_source_garmin'));
});

it('saves the display name through the existing API and persists the mantra', async () => {
  const user = userEvent.setup();
  await openPage();
  const name = screen.getByRole('textbox', { name: t('settings.display_name_title') });
  const mantra = screen.getByRole('textbox', { name: t('settings.stitch_account_identity') });
  await user.clear(name); await user.type(name, 'Mira Runner');
  await user.clear(mantra); await user.type(mantra, 'Keep showing up.');
  await user.click(screen.getByRole('button', { name: t('settings.save'), exact: true }));
  await screen.findByText(t('settings.name_saved'));
  expect(apiJson).toHaveBeenCalledWith('/api/profile/me/name', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ displayName: 'Mira Runner' }) }));
  expect(localStorage.getItem('hermes.settings.mantra')).toBe('Keep showing up.');
});

it('uploads and removes an avatar through the existing authenticated endpoints', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  const input = container.querySelector('#st-profile-avatar-input');
  const click = vi.spyOn(input, 'click');
  await user.click(screen.getByRole('button', { name: t('settings.avatar_upload') }));
  expect(click).toHaveBeenCalled();
  const file = new File(['photo'], 'avatar.png', { type: 'image/png' });
  await user.upload(input, file);
  await screen.findByText(t('settings.avatar_saved'));
  const upload = apiJson.mock.calls.find(([url]) => url === '/api/profile/me/avatar');
  expect(upload[1].method).toBe('PUT');
  expect(upload[1].body.get('image')).toBe(file);
  await user.click(screen.getByRole('button', { name: t('settings.avatar_remove') }));
  await screen.findByText(t('settings.avatar_removed'));
  expect(apiJson).toHaveBeenCalledWith('/api/profile/me/avatar', { method: 'DELETE' });
});

it('preserves units, theme, and language actions in accessible button groups', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  await user.click(screen.getByRole('tab', { name: t('settings.stitch_prefs_title') }));
  await user.click(screen.getByRole('button', { name: t('settings.stitch_imperial_label'), exact: true }));
  await user.click(screen.getByRole('button', { name: t('settings.stitch_theme_pulse'), exact: true }));
  await user.click(screen.getByRole('button', { name: '简体中文', exact: true }));
  expect(state.setUnit).toHaveBeenCalledWith('mile');
  expect(state.setTheme).toHaveBeenCalledWith('midnight');
  expect(state.setLang).toHaveBeenCalledWith('zh-CN');
  expect(container.querySelector('.st-v2-theme.is-light')).toHaveAttribute('aria-pressed', 'true');
});

it('updates the weekly brief switch and stores the selected preference', async () => {
  const user = userEvent.setup();
  await openPage();
  await user.click(screen.getByRole('tab', { name: t('settings.v2_notifications_title') }));
  const control = screen.getByRole('switch');
  expect(control).toHaveAttribute('aria-checked', 'true');
  await user.click(control);
  expect(control).toHaveAttribute('aria-checked', 'false');
  expect(localStorage.getItem('hermes.settings.digest')).toBe('0');
});

it('keeps Strava disconnect, Garmin import modal, and manual file navigation working', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  await user.click(screen.getByRole('tab', { name: t('settings.stitch_data_services_title') }));
  const connections = container.querySelector('#st-v2-connections');
  await disconnectStrava(user, connections);
  await user.click(within(connections).getByRole('button', { name: t('profile.garmin_connect_import'), exact: true }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await user.click(within(connections).getByRole('button', { name: t('profile.import_data'), exact: true }));
  expect(screen.getByRole('heading', { name: 'Import destination' })).toBeInTheDocument();
});

it('switches all six section tabs so only the selected group is visible', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  for (const tab of screen.getAllByRole('tab')) {
    await user.click(tab);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', tab.getAttribute('aria-controls'));
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
    for (const group of container.querySelectorAll('.st-v2-group')) {
      expect(group.hidden).toBe(group.id !== tab.getAttribute('aria-controls'));
    }
  }
});

it('preserves unsaved profile drafts when switching away and back', async () => {
  const user = userEvent.setup();
  await openPage();
  const name = screen.getByRole('textbox', { name: t('settings.display_name_title') });
  await user.clear(name); await user.type(name, 'Unsaved runner');
  await user.click(screen.getByRole('tab', { name: t('settings.stitch_prefs_title') }));
  expect(screen.queryByRole('textbox', { name: t('settings.display_name_title') })).not.toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: t('settings.stitch_account_info') }));
  expect(screen.getByRole('textbox', { name: t('settings.display_name_title') })).toHaveValue('Unsaved runner');
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/profile/me/name')).toHaveLength(0);
});

it('switches and focuses tabs with arrow, Home, and End keys, including wrapping', async () => {
  const user = userEvent.setup();
  await openPage();
  const tabs = screen.getAllByRole('tab');
  tabs[0].focus();
  await user.keyboard('{ArrowDown}');
  expect(tabs[1]).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'st-v2-preferences');
  await user.keyboard('{End}{ArrowRight}');
  expect(tabs[0]).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(tabs[5]).toHaveFocus();
  expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'st-v2-account');
  await user.keyboard('{Home}');
  expect(tabs[0]).toHaveFocus();
  expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
});

it('adapts tab orientation to mobile and cleans up the viewport listener', async () => {
  let onChange;
  const media = {
    matches: true,
    addEventListener: vi.fn((event, callback) => { onChange = callback; }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', (query) => query === '(max-width: 1100px)' ? media : { matches: false });
  const { unmount } = await openPage();
  await waitFor(() => expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal'));
  act(() => { media.matches = false; onChange(); });
  expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
  unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', onChange);
});

it('renders localized headings and signs out through the existing login flow', async () => {
  state.lang = 'zh-CN';
  const user = userEvent.setup();
  const { container } = await openPage();
  expect(container.querySelector('#st-v2-notifications-label')).toHaveTextContent('通知与健康数据');
  expect(container.querySelector('#st-v2-activity-label')).toHaveTextContent('跑步活动');
  await user.click(screen.getByRole('tab', { name: t('settings.v2_account_title') }));
  await user.click(screen.getByRole('button', { name: new RegExp(t('settings.logout_btn')) }));
  expect(state.logout).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
});

it('asks before disconnecting Strava, and cancelling leaves the connection alone', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  await openTab(user, t('settings.stitch_data_services_title'));
  const connections = container.querySelector('#st-v2-connections');

  const dialog = await openStravaDisconnectDialog(user, connections);

  expect(dialog).toHaveTextContent(t('settings.strava_disconnect_copy'));
  expect(dialog).toHaveTextContent(t('settings.strava_disconnect_warning'));
  expect(unlinkCalls()).toHaveLength(0);
  const cancel = within(dialog).getByRole('button', { name: t('settings.dialog_cancel') });
  await waitFor(() => expect(cancel).toHaveFocus());
  await user.click(cancel);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(unlinkCalls()).toHaveLength(0);
  expect(within(connections).getByRole('button', { name: t('settings.strava_disconnect'), exact: true })).toBeInTheDocument();
});

it('disconnects Strava after confirmation, reports how many runs went, and refreshes cached run lists', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  await openTab(user, t('settings.stitch_data_services_title'));
  const connections = container.querySelector('#st-v2-connections');

  await disconnectStrava(user, connections);

  expect(unlinkCalls()).toEqual([['/api/auth/strava/unlink', { method: 'DELETE' }]]);
  expect(connections).toHaveTextContent(t('settings.strava_disconnected_notice', { count: 2 }));
  expect(connections).not.toHaveTextContent(t('settings.strava_revoke_unconfirmed'));
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/activities');
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/profile/dashboard');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('says when Strava could not be reached to revoke access, and claims no removed runs when there were none', async () => {
  state.unlink = { unlinked: true, revokedAtStrava: false, removedActivities: 0 };
  const user = userEvent.setup();
  const { container } = await openPage();
  await openTab(user, t('settings.stitch_data_services_title'));
  const connections = container.querySelector('#st-v2-connections');

  await disconnectStrava(user, connections);

  expect(connections).toHaveTextContent(`${t('settings.strava_disconnected_plain')} ${t('settings.strava_revoke_unconfirmed')}`);
  expect(connections).not.toHaveTextContent(t('settings.strava_disconnected_notice', { count: 0 }));
});

it('keeps the dialog open with an error when the disconnect fails, and the link stays', async () => {
  state.failures['/api/auth/strava/unlink'] = 500;
  const user = userEvent.setup();
  const { container } = await openPage();
  await openTab(user, t('settings.stitch_data_services_title'));
  const connections = container.querySelector('#st-v2-connections');
  const dialog = await openStravaDisconnectDialog(user, connections);

  await user.click(within(dialog).getByRole('button', { name: t('settings.strava_disconnect_confirm') }));

  expect(await within(dialog).findByRole('alert')).toHaveTextContent(t('settings.stitch_strava_disconnect_error'));
  expect(within(dialog).getByRole('button', { name: t('settings.strava_disconnect_confirm') })).toBeEnabled();
  expect(invalidateResourceCache).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: t('settings.dialog_cancel') }));
  expect(within(connections).getByRole('button', { name: t('settings.strava_disconnect'), exact: true })).toBeInTheDocument();
});

it('sets the time zone from this device once, and says so', async () => {
  state.profileTimeZone = null;
  const user = userEvent.setup();
  await openPage();
  await openTab(user, t('settings.stitch_prefs_title'));

  expect(await screen.findByText(t('settings.time_zone_auto'))).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: t('settings.time_zone_title') })).toHaveValue('Europe/Copenhagen');
  const saves = apiJson.mock.calls.filter(([url]) => url === '/api/profile/me/time-zone');
  expect(saves).toHaveLength(1);
  expect(saves[0][1]).toEqual(expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ timeZone: 'Europe/Copenhagen' }) }));
});

it('does not overwrite a time zone the runner already has', async () => {
  const user = userEvent.setup();
  await openPage();
  await openTab(user, t('settings.stitch_prefs_title'));

  expect(screen.getByRole('combobox', { name: t('settings.time_zone_title') })).toHaveValue('America/New_York');
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/profile/me/time-zone')).toHaveLength(0);
});

it('saves a chosen time zone, and explains when the server does not know it', async () => {
  const user = userEvent.setup();
  await openPage();
  await openTab(user, t('settings.stitch_prefs_title'));
  const select = screen.getByRole('combobox', { name: t('settings.time_zone_title') });

  await user.selectOptions(select, 'Asia/Tokyo');

  expect(await screen.findByText(t('settings.time_zone_saved'))).toBeInTheDocument();
  expect(apiJson).toHaveBeenCalledWith('/api/profile/me/time-zone', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ timeZone: 'Asia/Tokyo' }) }));
  expect(invalidateResourceCache).toHaveBeenCalledWith('/api/profile/me');
  expect(select).toHaveValue('Asia/Tokyo');

  state.failures['/api/profile/me/time-zone'] = 400;
  await user.selectOptions(select, 'UTC');
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('settings.time_zone_unsupported')));
  expect(select).toHaveValue('Asia/Tokyo');
});

function exportResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'content-disposition' ? 'attachment; filename="hermes-export-2026-10-09.zip"' : null) },
    blob: async () => new Blob(['zip']),
    ...overrides,
  };
}

it('downloads the data export without GPS tracks unless asked for them', async () => {
  const user = userEvent.setup();
  await openPage();
  await openTab(user, t('settings.v2_account_title'));

  apiFetch.mockResolvedValueOnce(exportResponse());
  await user.click(screen.getByRole('button', { name: t('settings.export_button') }));
  expect(await screen.findByText(t('settings.export_started'))).toBeInTheDocument();
  expect(apiFetch).toHaveBeenCalledWith('/api/account/export?tracks=false');
  expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'hermes-export-2026-10-09.zip');

  apiFetch.mockResolvedValueOnce(exportResponse());
  await user.click(screen.getByRole('checkbox', { name: t('settings.export_tracks') }));
  await user.click(screen.getByRole('button', { name: t('settings.export_button') }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/account/export?tracks=true'));
});

it('tells the runner when an export is already running or could not be prepared', async () => {
  const user = userEvent.setup();
  await openPage();
  await openTab(user, t('settings.v2_account_title'));
  const download = () => user.click(screen.getByRole('button', { name: t('settings.export_button') }));

  apiFetch.mockResolvedValueOnce(exportResponse({ ok: false, status: 429 }));
  await download();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('settings.export_busy')));

  apiFetch.mockResolvedValueOnce(exportResponse({ ok: false, status: 500 }));
  await download();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('settings.export_error')));

  apiFetch.mockRejectedValueOnce(new Error('offline'));
  await download();
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(t('settings.export_error')));
  expect(downloadBlob).not.toHaveBeenCalled();
});

async function openDeleteDialog(user) {
  await openTab(user, t('settings.v2_account_title'));
  await user.click(screen.getByRole('button', { name: t('settings.delete_button') }));
  return screen.findByRole('dialog', { name: t('settings.delete_dialog_title') });
}

it('deletes the account only after the runner types DELETE, then signs out', async () => {
  const user = userEvent.setup();
  await openPage();
  const dialog = await openDeleteDialog(user);
  const confirm = within(dialog).getByRole('button', { name: t('settings.delete_confirm_button') });
  const input = within(dialog).getByRole('textbox', { name: t('settings.delete_type_prompt') });
  expect(dialog).toHaveTextContent(t('settings.delete_dialog_copy'));
  expect(confirm).toBeDisabled();

  await user.type(input, 'delete');
  expect(confirm).toBeDisabled();
  await user.clear(input);
  await user.type(input, 'DELETE');
  expect(confirm).toBeEnabled();
  expect(apiJson.mock.calls.filter(([url]) => url === '/api/account')).toHaveLength(0);
  await user.click(confirm);

  await waitFor(() => expect(state.logout).toHaveBeenCalledOnce());
  expect(apiJson).toHaveBeenCalledWith('/api/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
  expect(invalidateResourceCache).toHaveBeenCalledWith();
});

it('keeps the delete dialog open and explains why when the server says no', async () => {
  const user = userEvent.setup();
  await openPage();
  const dialog = await openDeleteDialog(user);
  await user.type(within(dialog).getByRole('textbox', { name: t('settings.delete_type_prompt') }), 'DELETE');
  const confirm = within(dialog).getByRole('button', { name: t('settings.delete_confirm_button') });

  state.failures['/api/account'] = 403;
  await user.click(confirm);
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(t('settings.delete_admin_refused'));

  state.failures['/api/account'] = 500;
  await user.click(confirm);
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent(t('settings.delete_error')));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(state.logout).not.toHaveBeenCalled();
});

it('forgets what was typed when the delete dialog is closed', async () => {
  const user = userEvent.setup();
  await openPage();
  let dialog = await openDeleteDialog(user);
  await user.type(within(dialog).getByRole('textbox', { name: t('settings.delete_type_prompt') }), 'DELETE');
  await user.click(within(dialog).getByRole('button', { name: t('settings.dialog_cancel') }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await user.click(screen.getByRole('button', { name: t('settings.delete_button') }));
  dialog = await screen.findByRole('dialog', { name: t('settings.delete_dialog_title') });

  expect(within(dialog).getByRole('textbox', { name: t('settings.delete_type_prompt') })).toHaveValue('');
  expect(within(dialog).getByRole('button', { name: t('settings.delete_confirm_button') })).toBeDisabled();
});
