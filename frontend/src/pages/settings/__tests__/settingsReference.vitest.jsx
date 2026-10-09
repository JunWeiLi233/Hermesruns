import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Settings from '../Settings';
import { apiFetch, apiJson } from '../../../api';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

const state = vi.hoisted(() => ({ lang: 'en', linked: true, logout: vi.fn(), setUnit: vi.fn(), setTheme: vi.fn(), setLang: vi.fn() }));
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

beforeEach(() => {
  state.lang = 'en'; state.linked = true;
  state.logout.mockReset(); state.setUnit.mockReset(); state.setTheme.mockReset(); state.setLang.mockReset();
  localStorage.clear();
  localStorage.setItem('hermes.settings.mantra', 'Easy days easy, hard days hard.');
  localStorage.setItem('hermes.settings.digest', '1');
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  apiFetch.mockReset(); apiFetch.mockResolvedValue({ ok: true });
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (url === '/api/profile/me') return { displayName: 'Mira Chen', email: 'preview@example.test' };
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

it('keeps Strava management, Garmin import modal, and manual file navigation working', async () => {
  const user = userEvent.setup();
  const { container } = await openPage();
  await user.click(screen.getByRole('tab', { name: t('settings.stitch_data_services_title') }));
  const connections = container.querySelector('#st-v2-connections');
  await user.click(within(connections).getByRole('button', { name: t('settings.stitch_manage'), exact: true }));
  expect(apiFetch).toHaveBeenCalledWith('/api/auth/strava/unlink', { method: 'DELETE' });
  await waitFor(() => expect(within(connections).getByRole('button', { name: t('settings.stitch_connect'), exact: true })).toBeInTheDocument());
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
