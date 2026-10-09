import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Races from '../Races';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import worldRaceCatalog from '../../../data/worldRaceCatalog';
import { getLocalizedRaceLabel } from '../../../utils/raceLocalization';

const state = vi.hoisted(() => ({ lang: 'en' }));
function translate(key, values = {}) {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'preview@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: translate }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../utils/routePreload', () => ({ preloadRoute: () => {} }));
vi.mock('../../../utils/raceImage', () => ({
  getCachedRaceImage: () => null, resolveRaceImage: async () => ({ imageUrl: '' }),
  rememberLoadedRaceImage: () => {}, invalidateRaceImageCache: () => {},
}));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let races;
beforeEach(() => {
  state.lang = 'en';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-09T16:00:00Z'));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  races = [{ id: 71, name: 'Tokyo Marathon 2027', eventDate: '2027-03-15', countdownDays: 157,
    location: 'Tokyo, Japan', organization: 'Tokyo Marathon Foundation', distanceKm: 42.195,
    goalTimeSeconds: 12300, registrationStatus: 'REGISTERED', notes: 'Start corral B', nyrrNinePlusOneEligible: false }];
  cachedApiJson.mockImplementation(async (url) => url === '/api/profile/me' ? { displayName: 'Alex' } : []);
  apiJson.mockImplementation(async (_url, options) => options?.method ? {} : [...races]);
  apiFetch.mockResolvedValue({ ok: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  const view = render(<MemoryRouter initialEntries={['/races']}><Races /></MemoryRouter>);
  await screen.findByRole('heading', { name: translate('races.v2_plan_title') });
  return view;
}
async function openCreate() {
  await openPage();
  fireEvent.click(screen.getByRole('button', { name: translate('races.add_button'), exact: true }));
  return screen.getByRole('dialog');
}
async function openEdit() {
  await openPage();
  fireEvent.click(screen.getByRole('button', { name: translate('races.stitch_race_details'), exact: true }));
  return screen.getByRole('dialog');
}
function fillRequired(dialog) {
  fireEvent.change(within(dialog).getByRole('textbox', { name: /Race name/ }), { target: { value: 'Tokyo Marathon 2027' } });
  fireEvent.change(within(dialog).getByLabelText(/Race date/), { target: { value: '2027-03-15' } });
}
function writes() { return apiJson.mock.calls.filter(([, options]) => options?.method); }

it('uses the handoff sections with a scrollable body and separate footer', async () => {
  const dialog = await openCreate();
  expect(dialog).toHaveClass('race-form-v2-card');
  expect(dialog.querySelector('.race-form-v2-body')).toBeInTheDocument();
  expect(dialog.querySelector('.race-form-v2-footer')).toBeInTheDocument();
  expect(dialog.querySelector('.race-form-v2-body .race-form-v2-footer')).toBeNull();
  expect(within(dialog).getByRole('textbox', { name: /Race name/ })).toHaveFocus();
  expect(within(dialog).getByRole('radiogroup', { name: en.races.form_status })).toBeInTheDocument();
  expect(within(dialog).getAllByRole('radio')).toHaveLength(6);
  expect(within(dialog).getByRole('switch', { name: en.races.form_nyrr })).not.toBeChecked();
  expect(within(dialog).getByRole('textbox', { name: en.races.form_notes }).tagName).toBe('TEXTAREA');
  expect(within(dialog).getByRole('button', { name: en.races.create_button })).toBeDisabled();
  expect(within(dialog).queryByRole('button', { name: en.races.delete_button })).toBeNull();
});

it.each([['5K', 5], ['10K', 10], ['Half', 21.0975], ['Marathon', 42.195]])('preserves exact %s preset distance in the API payload', async (label, km) => {
  const dialog = await openCreate();
  fillRequired(dialog);
  fireEvent.click(within(dialog).getByRole('button', { name: label, exact: true }));
  expect(within(dialog).getByRole('spinbutton')).toHaveValue(km);
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.create_button }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(writes()[0][0]).toBe('/api/races');
  expect(writes()[0][1].method).toBe('POST');
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({ name: 'Tokyo Marathon 2027', eventDate: '2027-03-15', distanceKm: km, goalTimeSeconds: null });
});

it.each([['3:25:00', 12300], ['24:15', 1455], ['90', 5400]])('converts goal %s to seconds without changing the save contract', async (goal, seconds) => {
  const dialog = await openCreate();
  fillRequired(dialog);
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true }), { target: { value: goal } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.create_button }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(JSON.parse(writes()[0][1].body).goalTimeSeconds).toBe(seconds);
});

it('shows the saved duration, real target pace and calendar countdown when editing', async () => {
  const dialog = await openEdit();
  expect(dialog).toHaveAccessibleName('Tokyo Marathon 2027');
  expect(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true })).toHaveValue('3:25:00');
  expect(dialog.querySelector('.race-form-v2-hint')).toHaveTextContent('4:52 /km');
  expect(dialog.querySelector('.race-form-v2-countdown')).toHaveTextContent('157 days to go');
  expect(within(dialog).getByRole('radio', { name: en.races.status_registered })).toBeChecked();
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.save_button }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(writes()[0][0]).toBe('/api/races/71');
  expect(writes()[0][1].method).toBe('PUT');
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({ goalTimeSeconds: 12300, notes: 'Start corral B', registrationStatus: 'REGISTERED' });
});

it('rounds pace across a minute boundary without displaying :60', async () => {
  races[0].distanceKm = 5;
  races[0].goalTimeSeconds = 1499;
  const dialog = await openEdit();
  expect(dialog.querySelector('.race-form-v2-hint')).toHaveTextContent('5:00 /km');
});

it('prevents duplicate saves while the existing request is pending', async () => {
  const dialog = await openEdit();
  let resolveSave;
  apiJson.mockImplementation(async (_url, options) => options?.method
    ? new Promise((resolve) => { resolveSave = resolve; }) : [...races]);
  const save = within(dialog).getByRole('button', { name: en.races.save_button });
  fireEvent.click(save);
  expect(save).toBeDisabled();
  fireEvent.submit(dialog.querySelector('form'));
  expect(writes()).toHaveLength(1);
  resolveSave({});
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});

it.each(['0', '3:65:00', '24:99', '-2:00', '3.5', 'abc'])('blocks an invalid goal %s with an associated inline hint', async (goal) => {
  const dialog = await openEdit();
  const input = within(dialog).getByRole('textbox', { name: 'Goal time', exact: true });
  fireEvent.change(input, { target: { value: goal } });
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription(en.races.form_v2_goal_invalid);
  expect(within(dialog).getByRole('button', { name: en.races.save_button })).toBeDisabled();
  fireEvent.submit(dialog.querySelector('form'));
  expect(writes()).toHaveLength(0);
});

it('clears optional goals, validates custom distance and saves every registration field', async () => {
  const dialog = await openEdit();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Custom' }));
  const distance = within(dialog).getByRole('spinbutton');
  fireEvent.change(distance, { target: { value: '0' } });
  expect(within(dialog).getByRole('button', { name: en.races.save_button })).toBeDisabled();
  fireEvent.change(distance, { target: { value: '16.0934' } });
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true }), { target: { value: '' } });
  fireEvent.click(within(dialog).getByRole('radio', { name: en.races.status_waitlist }));
  fireEvent.click(within(dialog).getByRole('switch', { name: en.races.form_nyrr }));
  fireEvent.change(within(dialog).getByRole('textbox', { name: en.races.form_notes }), { target: { value: 'Hotel confirmed\nBib pickup Friday' } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.save_button }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({ distanceKm: 16.0934, goalTimeSeconds: null, registrationStatus: 'WAITLIST', nyrrNinePlusOneEligible: true, notes: 'Hotel confirmed\nBib pickup Friday' });
});

it('does not submit whitespace-only names through an Enter-style form submit', async () => {
  const dialog = await openEdit();
  fireEvent.change(within(dialog).getByRole('textbox', { name: /Race name/ }), { target: { value: '   ' } });
  expect(within(dialog).getByRole('button', { name: en.races.save_button })).toBeDisabled();
  fireEvent.submit(dialog.querySelector('form'));
  expect(writes()).toHaveLength(0);
});

it('reports save failure inline and retains all form values for retry', async () => {
  const dialog = await openEdit();
  apiJson.mockImplementation(async (_url, options) => { if (options?.method) throw new Error('Unable to save race'); return [...races]; });
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.save_button }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to save race');
  expect(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true })).toHaveValue('3:25:00');
  expect(within(dialog).getByRole('button', { name: en.races.save_button })).toBeEnabled();
});

it('keeps cancel, Escape and delete confirmation working without saving', async () => {
  const dialog = await openEdit();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.delete_button }));
  expect(window.confirm).toHaveBeenCalledWith(en.races.delete_confirm.replace('{name}', races[0].name));
  expect(apiFetch).not.toHaveBeenCalled();
  window.confirm.mockReturnValue(true);
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.delete_button }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/api/races/71', { method: 'DELETE' }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(writes()).toHaveLength(0);
});

it('resets a dismissed goal when reopening Add Race and can cancel without mutation', async () => {
  const dialog = await openEdit();
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true }), { target: { value: 'bad' } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.profile.cancel }));
  fireEvent.click(screen.getByRole('button', { name: en.races.add_button, exact: true }));
  const reopened = screen.getByRole('dialog');
  expect(within(reopened).getByRole('textbox', { name: 'Goal time', exact: true })).toHaveValue('');
  expect(within(reopened).getByRole('textbox', { name: 'Goal time', exact: true })).toHaveAttribute('aria-invalid', 'false');
  expect(writes()).toHaveLength(0);
});

it('preserves real catalog prefilling and resets a dismissed invalid goal', async () => {
  const dialog = await openEdit();
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'Goal time', exact: true }), { target: { value: 'bad' } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.profile.cancel }));
  const race = worldRaceCatalog[0];
  fireEvent.click(screen.getByRole('button', { name: `${en.races.v2_add_to_plan}: ${getLocalizedRaceLabel(race, 'en')}`, exact: true }));
  const catalogDialog = screen.getByRole('dialog');
  expect(within(catalogDialog).getByRole('textbox', { name: /Race name/ })).toHaveValue(race.name);
  expect(within(catalogDialog).getByRole('spinbutton')).toHaveValue(race.distanceKm);
  expect(within(catalogDialog).getByRole('textbox', { name: 'Goal time', exact: true })).toHaveValue('');
  expect(within(catalogDialog).getByLabelText(/Race date/).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  fireEvent.click(within(catalogDialog).getByRole('button', { name: en.races.create_button }));
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({ name: race.name, organization: race.organization || '', location: race.location || '', distanceKm: race.distanceKm, goalTimeSeconds: null });
});

it('renders the handoff helper copy and controls in Chinese', async () => {
  state.lang = 'zh-CN';
  const dialog = await openCreate();
  expect(within(dialog).getByRole('button', { name: '全马', exact: true })).toBeInTheDocument();
  expect(dialog).toHaveTextContent('保存后会出现在你的赛季计划中');
  expect(within(dialog).getByRole('textbox', { name: '目标时间', exact: true })).toBeInTheDocument();
  expect(within(dialog).getByRole('radio', { name: zh.races.status_interested })).toBeChecked();
  expect(dialog.textContent).not.toMatch(/races\.form_|\{(?:count|pace)\}/);
});
