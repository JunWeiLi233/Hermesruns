import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../api';
import { cachedApiJson } from '../api/resourceCache';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import { addDaysToKey, todayKey } from '../utils/calendarDays';
import { estimateCurrentVdot } from '../utils/vdot';
import SettingsPaceZones from './SettingsPaceZones';

vi.mock('../api', () => ({ apiFetch: vi.fn(), apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../api/resourceCache', () => ({ invalidateResourceCache: vi.fn(), cachedApiJson: vi.fn() }));
vi.mock('../utils/vdot', async (importOriginal) => ({ ...(await importOriginal()), estimateCurrentVdot: vi.fn() }));

const makeT = (dictionary) => (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
const t = makeT(en);

const LIMITS = {
  minDistanceMeters: 1500,
  maxDistanceMeters: 100000,
  minSeconds: 240,
  maxSeconds: 86400,
  minPaceSecondsPerKm: 120,
  maxPaceSecondsPerKm: 1200,
  maxAgeDays: 1825,
};
const RECENT = addDaysToKey(todayKey(), -20);
const tenK = (overrides = {}) => ({ distanceMeters: 10000, seconds: 2700, date: RECENT, ...overrides });

let server;
const calls = (method) => apiJson.mock.calls.filter(([url, options]) => url === '/api/training/pace-zones' && (options?.method || 'GET') === method);

beforeEach(() => {
  server = {
    race: null,
    put: (body) => ({ race: { ...body, updatedAt: '2026-10-10T08:00:00' }, limits: LIMITS }),
    remove: () => ({ race: null, limits: LIMITS }),
  };
  apiJson.mockReset();
  apiJson.mockImplementation(async (url, options) => {
    if (url !== '/api/training/pace-zones') return {};
    if (options?.method === 'PUT') return server.put(JSON.parse(options.body));
    if (options?.method === 'DELETE') return server.remove();
    return { race: server.race, limits: LIMITS };
  });
  cachedApiJson.mockReset();
  cachedApiJson.mockResolvedValue([{ id: 1 }]);
  estimateCurrentVdot.mockReset();
  estimateCurrentVdot.mockReturnValue({ representativeVdot: 50 });
});
afterEach(() => cleanup());

async function open(props = {}) {
  const view = render(<SettingsPaceZones t={t} lang="en" unit="km" active {...props} />);
  await screen.findByRole('combobox', { name: t('settings.pace_race_distance') });
  return view;
}

const distance = () => screen.getByRole('combobox', { name: t('settings.pace_race_distance') });
const customDistance = () => screen.getByRole('textbox', { name: /^Distance \(/ });
const time = () => screen.getByRole('textbox', { name: t('settings.pace_race_time') });
const date = () => screen.getByLabelText(t('settings.pace_race_date'));
const basis = () => screen.getByTestId('pace-zones-basis');
const zoneRows = () => within(screen.getByRole('list', { name: t('settings.pace_zones_list') })).getAllByRole('listitem');
const useButton = (name = t('settings.pace_race_save')) => screen.getByRole('button', { name });

async function enter(user, { text = '45:00', day = RECENT } = {}) {
  if (text != null) {
    await user.clear(time());
    if (text) await user.type(time(), text);
  }
  if (day != null) fireEvent.change(date(), { target: { value: day } });
}

describe('loading', () => {
  it('waits until the Training tab is opened before it asks the server', async () => {
    const { rerender } = render(<SettingsPaceZones t={t} lang="en" unit="km" active={false} />);
    expect(apiJson).not.toHaveBeenCalled();
    expect(cachedApiJson).not.toHaveBeenCalled();
    rerender(<SettingsPaceZones t={t} lang="en" unit="km" active />);
    await screen.findByRole('combobox', { name: t('settings.pace_race_distance') });
    expect(calls('GET')).toHaveLength(1);
    rerender(<SettingsPaceZones t={t} lang="en" unit="km" active={false} />);
    rerender(<SettingsPaceZones t={t} lang="en" unit="km" active />);
    expect(calls('GET')).toHaveLength(1);
  });

  it('shows the zones cut from the runner\'s own runs when there is no race, fastest first', async () => {
    await open();
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_runs', { vdot: 50 }));
    const rows = zoneRows();
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.dataset.paceZone)).toEqual(['repetition', 'interval', 'threshold', 'marathon', 'easy', 'recovery']);
    expect(rows[0]).toHaveTextContent('Repetition');
    expect(rows[0]).toHaveTextContent('faster than 3:41 /km');
    expect(rows[4]).toHaveTextContent('Easy');
    expect(rows[4]).toHaveTextContent('4:50–5:52 /km');
    expect(rows[5]).toHaveTextContent('slower than 5:52 /km');
    expect(rows.map((row) => row.className)).toEqual(['is-zone-6', 'is-zone-5', 'is-zone-4', 'is-zone-3', 'is-zone-2', 'is-zone-1']);
    expect(screen.queryByRole('button', { name: t('settings.pace_race_remove') })).not.toBeInTheDocument();
    expect(screen.getByText(t('settings.pace_zones_applies'))).toBeInTheDocument();
    expect(cachedApiJson).toHaveBeenCalledWith('/api/activities/analysis');
  });

  it('starts the form on a 10K with nothing else filled in, and the save button asks for a race', async () => {
    await open();
    expect(distance()).toHaveValue('10k');
    expect(time()).toHaveValue('');
    expect(date()).toHaveValue('');
    expect(date()).toHaveAttribute('max', todayKey());
    expect(useButton()).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says there are no zones to show when the runs give no fitness and there is no race', async () => {
    estimateCurrentVdot.mockReturnValue({ representativeVdot: null });
    await open();
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_none'));
    expect(screen.getByText(t('settings.pace_zones_none'))).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: t('settings.pace_zones_list') })).not.toBeInTheDocument();
  });

  it('says it cannot show the zones from the runs when the runs cannot be loaded, and the form still works', async () => {
    cachedApiJson.mockRejectedValue(new Error('down'));
    await open();
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_unknown'));
    expect(screen.queryByText(t('settings.pace_zones_basis_none'))).not.toBeInTheDocument();
    const user = userEvent.setup();
    await enter(user);
    expect(zoneRows()).toHaveLength(6);
  });

  it('says so when the race cannot be loaded, and loads it on retry', async () => {
    apiJson.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    render(<SettingsPaceZones t={t} lang="en" unit="km" active />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.pace_zones_load_error'));
    await user.click(screen.getByRole('button', { name: t('settings.training_retry') }));
    expect(await screen.findByRole('combobox', { name: t('settings.pace_race_distance') })).toBeInTheDocument();
    expect(calls('GET')).toHaveLength(2);
  });

  it('treats an answer without limits as a failure', async () => {
    apiJson.mockResolvedValueOnce({ race: null });
    render(<SettingsPaceZones t={t} lang="en" unit="km" active />);
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.pace_zones_load_error'));
  });
});

describe('a race that was entered', () => {
  it('fills the form with it, cuts the zones from it and says where they come from', async () => {
    server.race = tenK({ date: '2026-09-20' });
    await open();
    expect(distance()).toHaveValue('10k');
    expect(time()).toHaveValue('45:00');
    expect(date()).toHaveValue('2026-09-20');
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_race', { race: '10K in 45:00', date: 'Sep 20, 2026', vdot: 45.3 }));
    expect(zoneRows()[4]).toHaveTextContent('5:14–6:20 /km');
    expect(zoneRows()[5]).toHaveTextContent('slower than 6:20 /km');
    expect(zoneRows()[0]).toHaveTextContent('faster than 4:00 /km');
    expect(useButton(t('settings.pace_race_replace'))).toBeDisabled();
    expect(screen.getByRole('button', { name: t('settings.pace_race_remove') })).toBeEnabled();
    expect(screen.queryByText(/Nothing changes until/)).not.toBeInTheDocument();
  });

  it('shows a race at a distance of its own as that distance, in the runner\'s unit', async () => {
    server.race = tenK({ distanceMeters: 12500, seconds: 3550, date: '2026-09-20' });
    const view = await open();
    expect(distance()).toHaveValue('other');
    expect(customDistance()).toHaveValue('12.5');
    expect(basis()).toHaveTextContent('12.5 km in 59:10 on Sep 20, 2026 (VDOT 43.4)');
    view.unmount();

    await open({ unit: 'mile' });
    expect(customDistance()).toHaveValue('7.77');
    expect(basis()).toHaveTextContent('7.77 mi in 59:10');
  });

  it('shows the half marathon and the marathon by name', async () => {
    server.race = tenK({ distanceMeters: 21097.5, seconds: 6330, date: '2026-09-20' });
    const view = await open();
    expect(distance()).toHaveValue('half');
    expect(time()).toHaveValue('1:45:30');
    expect(basis()).toHaveTextContent('Half marathon in 1:45:30');
    view.unmount();

    server.race = tenK({ distanceMeters: 42195, seconds: 12600, date: '2026-09-20' });
    await open();
    expect(distance()).toHaveValue('marathon');
    expect(basis()).toHaveTextContent('Marathon in 3:30:00');
  });

  it('says a race is old once it is about six months back, and not before', async () => {
    server.race = tenK({ date: addDaysToKey(todayKey(), -182) });
    const view = await open();
    expect(screen.queryByText(/days ago/)).not.toBeInTheDocument();
    view.unmount();

    server.race = tenK({ date: addDaysToKey(todayKey(), -200) });
    await open();
    expect(screen.getByText(t('settings.pace_race_stale', { days: 200 }))).toBeInTheDocument();
  });
});

describe('entering a race', () => {
  it('previews the zones as the race is typed, and changes nothing until it is used', async () => {
    const user = userEvent.setup();
    await open();
    await enter(user);

    expect(screen.getByText(t('settings.pace_zones_preview', { vdot: 45.3 }))).toBeInTheDocument();
    expect(zoneRows()[4]).toHaveTextContent('5:14–6:20 /km');
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_runs', { vdot: 50 }));
    expect(calls('PUT')).toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps showing the zones in force while the race typed is not complete', async () => {
    const user = userEvent.setup();
    await open();
    await enter(user, { text: '45:0', day: null });
    expect(zoneRows()[4]).toHaveTextContent('4:50–5:52 /km');
    expect(screen.queryByText(/Nothing changes until/)).not.toBeInTheDocument();
  });

  it('saves the race, then cuts the zones from it', async () => {
    const user = userEvent.setup();
    await open();
    await enter(user);
    await user.click(useButton());

    expect(await screen.findByText(t('settings.pace_race_saved'))).toBeInTheDocument();
    expect(calls('PUT')).toHaveLength(1);
    expect(JSON.parse(calls('PUT')[0][1].body)).toEqual({ distanceMeters: 10000, seconds: 2700, date: RECENT });
    expect(calls('PUT')[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(basis()).toHaveTextContent('10K in 45:00');
    expect(basis()).toHaveTextContent('(VDOT 45.3)');
    expect(zoneRows()[4]).toHaveTextContent('5:14–6:20 /km');
    expect(screen.queryByText(/Nothing changes until/)).not.toBeInTheDocument();
    expect(useButton(t('settings.pace_race_replace'))).toBeDisabled();
    expect(screen.getByRole('button', { name: t('settings.pace_race_remove') })).toBeEnabled();
  });

  it('saves with the Enter key from a field', async () => {
    const user = userEvent.setup();
    await open();
    await enter(user, { text: null });
    await user.type(time(), '45:00{Enter}');
    expect(await screen.findByText(t('settings.pace_race_saved'))).toBeInTheDocument();
    expect(calls('PUT')).toHaveLength(1);
  });

  it.each([
    ['5K', '5k', 5000, '20:00', 1200],
    ['Half marathon', 'half', 21097.5, '1:45:30', 6330],
    ['Marathon', 'marathon', 42195, '3:30:00', 12600],
  ])('saves a %s with its distance in metres', async (_name, value, meters, text, seconds) => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(distance(), value);
    await enter(user, { text });
    await user.click(useButton());
    await screen.findByText(t('settings.pace_race_saved'));
    expect(JSON.parse(calls('PUT')[0][1].body)).toEqual({ distanceMeters: meters, seconds, date: RECENT });
  });

  it('saves another distance in kilometres, or in miles when that is the runner\'s unit', async () => {
    const user = userEvent.setup();
    const view = await open();
    await user.selectOptions(distance(), 'other');
    expect(screen.getByRole('textbox', { name: 'Distance (km)' })).toHaveValue('');
    await user.type(customDistance(), '12,5');
    await enter(user, { text: '59:10' });
    await user.click(useButton());
    await screen.findByText(t('settings.pace_race_saved'));
    expect(JSON.parse(calls('PUT')[0][1].body)).toEqual({ distanceMeters: 12500, seconds: 3550, date: RECENT });
    view.unmount();

    apiJson.mockClear();
    server.race = null;
    await open({ unit: 'mile' });
    await user.selectOptions(distance(), 'other');
    expect(screen.getByRole('textbox', { name: 'Distance (mi)' })).toBeInTheDocument();
    await user.type(customDistance(), '8');
    await enter(user, { text: '59:10' });
    await user.click(useButton());
    await screen.findByText(t('settings.pace_race_saved'));
    expect(JSON.parse(calls('PUT')[0][1].body)).toEqual({ distanceMeters: 12874.8, seconds: 3550, date: RECENT });
  });

  it('keeps a distance typed in kilometres the same distance when the runner switches to miles', async () => {
    const user = userEvent.setup();
    const { rerender } = await open();
    await user.selectOptions(distance(), 'other');
    await user.type(customDistance(), '12.5');
    rerender(<SettingsPaceZones t={t} lang="en" unit="mile" active />);
    expect(screen.getByRole('textbox', { name: 'Distance (mi)' })).toHaveValue('7.77');
    rerender(<SettingsPaceZones t={t} lang="en" unit="km" active />);
    expect(screen.getByRole('textbox', { name: 'Distance (km)' })).toHaveValue('12.5');
  });

  it('reads a time that includes hours', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(distance(), 'half');
    await enter(user, { text: '1:45:30' });
    expect(screen.getByText(t('settings.pace_zones_preview', { vdot: 42.4 }))).toBeInTheDocument();
  });
});

describe('what the form refuses', () => {
  it('says nothing until the runner has been at a field, and then only about that field', async () => {
    const user = userEvent.setup();
    await open();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.type(time(), '4');
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.pace_race_problem_time'));
    expect(screen.getByRole('alert')).not.toHaveTextContent(t('settings.pace_race_problem_date'));
    expect(time()).toHaveAttribute('aria-invalid', 'true');
    expect(date()).not.toHaveAttribute('aria-invalid');
  });

  it('says everything that is missing when the runner tries to save an empty form, and does not call the server', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(useButton());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('settings.pace_race_problem_time'));
    expect(alert).toHaveTextContent(t('settings.pace_race_problem_date'));
    expect(time()).toHaveAttribute('aria-invalid', 'true');
    expect(date()).toHaveAttribute('aria-invalid', 'true');
    expect(distance()).not.toHaveAttribute('aria-invalid');
    expect(calls('PUT')).toHaveLength(0);
  });

  it('ties each field with a problem to the sentence that says what is wrong with it, and to no other', async () => {
    const user = userEvent.setup();
    await open();
    await user.click(useButton());
    const alert = await screen.findByRole('alert');
    const sentences = (field) => (field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).map((id) => {
      const sentence = document.getElementById(id);
      expect(alert).toContainElement(sentence);
      return sentence.textContent;
    });
    expect(sentences(time())).toEqual([t('settings.pace_race_problem_time')]);
    expect(sentences(date())).toEqual([t('settings.pace_race_problem_date')]);
    expect(distance()).not.toHaveAttribute('aria-describedby');

    await enter(user);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(time()).not.toHaveAttribute('aria-describedby');
    expect(date()).not.toHaveAttribute('aria-describedby');
  });

  it('ties a distance that is refused to its sentence too', async () => {
    const user = userEvent.setup();
    await open();
    await user.selectOptions(distance(), 'other');
    await user.type(customDistance(), 'far');
    const alert = await screen.findByRole('alert');
    const [id, ...others] = customDistance().getAttribute('aria-describedby').split(' ');
    expect(others).toEqual([]);
    expect(alert).toContainElement(document.getElementById(id));
    expect(document.getElementById(id)).toHaveTextContent(t('settings.pace_race_problem_distance'));
  });

  it.each([
    ['a time that is not a time', { text: '45' }, 'settings.pace_race_problem_time'],
    ['a time over 59 seconds', { text: '45:75' }, 'settings.pace_race_problem_time'],
    ['a time under four minutes', { text: '3:59' }, 'settings.pace_race_problem_time_range'],
    ['a time over a day', { text: '25:00:00' }, 'settings.pace_race_problem_time_range'],
    ['a time too fast for the distance', { text: '17:00' }, 'settings.pace_race_problem_pace'],
    ['a day in the future', { day: addDaysToKey(todayKey(), 1) }, 'settings.pace_race_problem_date_future'],
    ['a day more than five years back', { day: addDaysToKey(todayKey(), -1826) }, 'settings.pace_race_problem_date_old'],
    ['a day that is not one', { day: '2026-02-31' }, 'settings.pace_race_problem_date'],
  ])('refuses %s without calling the server', async (_name, typed, key) => {
    const user = userEvent.setup();
    await open();
    await enter(user, typed.text != null && typed.day == null ? { ...typed, day: RECENT } : { text: '45:00', ...typed });
    await user.click(useButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t(key));
    expect(calls('PUT')).toHaveLength(0);
  });

  it('refuses a distance that is not a number or is out of range, in the runner\'s unit', async () => {
    const user = userEvent.setup();
    const view = await open();
    await user.selectOptions(distance(), 'other');
    await enter(user);
    await user.type(customDistance(), 'far');
    await user.click(useButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.pace_race_problem_distance'));
    expect(customDistance()).toHaveAttribute('aria-invalid', 'true');

    await user.clear(customDistance());
    await user.type(customDistance(), '1');
    expect(screen.getByRole('alert')).toHaveTextContent('The distance must be from 1.5 to 100 km.');
    await user.clear(customDistance());
    await user.type(customDistance(), '101');
    expect(screen.getByRole('alert')).toHaveTextContent('The distance must be from 1.5 to 100 km.');
    expect(calls('PUT')).toHaveLength(0);
    view.unmount();

    await open({ unit: 'mile' });
    await user.selectOptions(distance(), 'other');
    await enter(user);
    await user.type(customDistance(), '0.5');
    await user.click(useButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('The distance must be from 0.93 to 62.14 mi.');
  });

  it('lets a refused race be fixed and saved', async () => {
    const user = userEvent.setup();
    await open();
    await enter(user, { text: '17:00' });
    await user.click(useButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(t('settings.pace_race_problem_pace'));
    await enter(user, { text: '45:00', day: null });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(useButton());
    expect(await screen.findByText(t('settings.pace_race_saved'))).toBeInTheDocument();
  });

  it('says so when the server refuses a race the form accepted, and keeps what was typed', async () => {
    server.put = () => { throw Object.assign(new Error('The race cannot be in the future.'), { status: 400 }); };
    const user = userEvent.setup();
    await open();
    await enter(user);
    await user.click(useButton());
    expect(await screen.findByText(t('settings.pace_race_refused'))).toBeInTheDocument();
    expect(time()).toHaveValue('45:00');
    expect(date()).toHaveValue(RECENT);
    expect(useButton()).toBeEnabled();
  });

  it('says so when saving fails, and a second try works', async () => {
    server.put = () => { throw Object.assign(new Error('Request failed'), { status: 500 }); };
    const user = userEvent.setup();
    await open();
    await enter(user);
    await user.click(useButton());
    expect(await screen.findByText(t('settings.pace_race_save_error'))).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(t('settings.pace_race_save_error'));

    server.put = (body) => ({ race: body, limits: LIMITS });
    await user.click(useButton());
    expect(await screen.findByText(t('settings.pace_race_saved'))).toBeInTheDocument();
    expect(screen.queryByText(t('settings.pace_race_save_error'))).not.toBeInTheDocument();
  });
});

describe('replacing and removing the race', () => {
  it('allows replacing it only once something is different', async () => {
    server.race = tenK();
    server.put = (body) => ({ race: body, limits: LIMITS });
    const user = userEvent.setup();
    await open();
    expect(useButton(t('settings.pace_race_replace'))).toBeDisabled();
    await enter(user, { text: '44:00', day: null });
    expect(useButton(t('settings.pace_race_replace'))).toBeEnabled();
    expect(screen.getByText(t('settings.pace_zones_preview', { vdot: 46.5 }))).toBeInTheDocument();
    await enter(user, { text: '45:00', day: null });
    expect(useButton(t('settings.pace_race_replace'))).toBeDisabled();

    await user.selectOptions(distance(), '5k');
    await enter(user, { text: '22:30', day: null });
    expect(useButton(t('settings.pace_race_replace'))).toBeEnabled();
    await user.click(useButton(t('settings.pace_race_replace')));
    expect(await screen.findByText(t('settings.pace_race_saved'))).toBeInTheDocument();
    expect(JSON.parse(calls('PUT')[0][1].body)).toEqual({ distanceMeters: 5000, seconds: 1350, date: RECENT });
    expect(basis()).toHaveTextContent('5K in 22:30');
  });

  it('removes the race and goes back to the zones from the runner\'s runs', async () => {
    server.race = tenK();
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('settings.pace_race_remove') }));

    expect(await screen.findByText(t('settings.pace_race_removed'))).toBeInTheDocument();
    expect(calls('DELETE')).toHaveLength(1);
    expect(basis()).toHaveTextContent(t('settings.pace_zones_basis_runs', { vdot: 50 }));
    expect(zoneRows()[4]).toHaveTextContent('4:50–5:52 /km');
    expect(time()).toHaveValue('');
    expect(date()).toHaveValue('');
    expect(screen.queryByRole('button', { name: t('settings.pace_race_remove') })).not.toBeInTheDocument();
    expect(useButton()).toBeEnabled();
  });

  it('says so when the race cannot be removed, and keeps it', async () => {
    server.race = tenK();
    server.remove = () => { throw Object.assign(new Error('Request failed'), { status: 500 }); };
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByRole('button', { name: t('settings.pace_race_remove') }));
    expect(await screen.findByText(t('settings.pace_race_remove_error'))).toBeInTheDocument();
    expect(basis()).toHaveTextContent('10K in 45:00');
    expect(screen.getByRole('button', { name: t('settings.pace_race_remove') })).toBeEnabled();
  });
});

describe('language', () => {
  it('is written in Chinese when the translator is Chinese', async () => {
    const tZh = makeT(zh);
    server.race = tenK({ date: '2026-09-20' });
    render(<SettingsPaceZones t={tZh} lang="zh-CN" unit="km" active />);
    await screen.findByRole('combobox', { name: tZh('settings.pace_race_distance') });
    expect(screen.getByRole('heading', { name: '配速区间' })).toBeInTheDocument();
    expect(screen.getByTestId('pace-zones-basis')).toHaveTextContent('当前：根据比赛成绩计算——10 公里 45:00，2026年9月20日（VDOT 45.3）。');
    const rows = within(screen.getByRole('list', { name: tZh('settings.pace_zones_list') })).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('span').textContent)).toEqual(['重复', '间歇', '乳酸阈', '马拉松配速', '轻松', '恢复']);
    expect(rows[0]).toHaveTextContent('快于 4:00 /公里');
    expect(screen.getByRole('button', { name: '改用这场比赛' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '移除这场比赛' })).toBeInTheDocument();
  });

  it('says what is wrong in Chinese too', async () => {
    const tZh = makeT(zh);
    const user = userEvent.setup();
    render(<SettingsPaceZones t={tZh} lang="zh-CN" unit="km" active />);
    await screen.findByRole('combobox', { name: tZh('settings.pace_race_distance') });
    await user.click(screen.getByRole('button', { name: '采用这场比赛' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('成绩请写成 分:秒 或 时:分:秒，例如 45:00 或 1:45:30。请选择比赛日期。');
  });
});
