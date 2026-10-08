import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Races from '../Races';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiFetch, apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t: translate }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
// Catalog discovery is independent of managing the runner's saved races.
vi.mock('../../../data/worldRaceCatalog', () => ({ default: [], worldRaceCountries: [] }));

function translate(key, values = {}) {
  const dictionary = preferences.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
}

function savedRace(id, name, eventDate, countdownDays, registrationStatus = 'REGISTERED') {
  return { id, name, eventDate, countdownDays, registrationStatus, organization: 'Local club', location: 'New York',
    distanceKm: 10, goalTimeSeconds: 3000, notes: `${name} notes`, nyrrNinePlusOneEligible: false };
}

const upcoming = [
  savedRace(1, 'First upcoming race', '2026-10-20', 12),
  savedRace(2, 'Second upcoming race', '2026-11-20', 43, 'APPLIED'),
  savedRace(3, 'Third upcoming race', '2026-12-20', 73, 'INTERESTED'),
  savedRace(4, 'Fourth upcoming race', '2027-01-20', 104, 'WAITLIST'),
  savedRace(5, 'Fifth upcoming race', '2027-09-20', 347),
  // Outside the season strip as well as the old five-row agenda limit.
  savedRace(6, 'Sixth upcoming race', '2027-11-20', 408),
];
const history = [
  savedRace(7, 'Past registered race', '2026-07-20', -80),
  savedRace(8, 'Completed race', '2026-09-20', -18, 'COMPLETED'),
  savedRace(9, 'Canceled race', '2026-10-10', 2, 'CANCELED'),
  savedRace(10, 'Completed future race', '2026-10-09', 1, 'COMPLETED'),
];
const previouslyInaccessible = [...history, upcoming[5]];
let races;

beforeEach(() => {
  preferences.lang = 'en';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T12:00:00'));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  races = [...history, ...upcoming].reverse().map((race) => ({ ...race }));
  cachedApiJson.mockImplementation(async (url) => {
    if (url === '/api/profile/me') return { displayName: 'Runner' };
    if (url === '/api/activities') return [];
    throw new Error(`Unexpected cached request: ${url}`);
  });
  apiJson.mockImplementation(async (url, options = {}) => {
    if (url === '/api/races' && !options.method) return races.map((race) => ({ ...race }));
    if (options.method === 'PUT') {
      const id = Number(url.split('/').at(-1));
      const payload = JSON.parse(options.body);
      races = races.map((race) => race.id === id ? { ...race, ...payload } : race);
      return races.find((race) => race.id === id);
    }
    throw new Error(`Unexpected race request: ${url}`);
  });
  apiFetch.mockImplementation(async (url, options) => {
    if (options.method !== 'DELETE') throw new Error(`Unexpected race fetch: ${url}`);
    const id = Number(url.split('/').at(-1));
    races = races.filter((race) => race.id !== id);
    return { ok: true };
  });
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/races']}><Races /></MemoryRouter>);
  await screen.findByRole('heading', { name: translate('races.v2_plan_title') });
  return { ...result, agenda: result.container.querySelector('#race-center-calendar') };
}

function getSavedRow(agenda, race) {
  const editButton = within(agenda).queryByRole('button', { name: race.name, exact: true });
  expect(editButton).toBeInTheDocument();
  return editButton.closest('article');
}

it.each(previouslyInaccessible)('can edit and save $name from the saved agenda', async (race) => {
  const { agenda } = await openPage();
  const row = getSavedRow(agenda, race);
  fireEvent.click(within(row).getByRole('button', { name: race.name, exact: true }));
  const dialog = screen.getByRole('dialog', { name: en.races.edit_title });
  expect(within(dialog).getByDisplayValue(race.notes)).toBeInTheDocument();
  expect(within(dialog).getByDisplayValue(race.eventDate)).toBeInTheDocument();
  const updatedName = `${race.name} updated`;
  fireEvent.change(within(dialog).getByDisplayValue(race.name), { target: { value: updatedName } });
  fireEvent.click(within(dialog).getByRole('button', { name: en.races.save_button }));
  await waitFor(() => expect(within(agenda).getByRole('button', { name: updatedName, exact: true })).toBeInTheDocument());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const update = apiJson.mock.calls.find(([url, options]) => url === `/api/races/${race.id}` && options?.method === 'PUT');
  expect(JSON.parse(update[1].body)).toMatchObject({ name: updatedName, registrationStatus: race.registrationStatus,
    eventDate: race.eventDate, distanceKm: race.distanceKm, goalTimeSeconds: race.goalTimeSeconds, notes: race.notes });
});

it.each(previouslyInaccessible)('can remove $name from the saved agenda', async (race) => {
  const { agenda } = await openPage();
  const row = getSavedRow(agenda, race);
  fireEvent.click(within(row).getByRole('button', { name: translate('races.v2_remove_race', { name: race.name }) }));
  expect(window.confirm).toHaveBeenCalledWith(translate('races.delete_confirm', { name: race.name }));
  await waitFor(() => expect(within(agenda).queryByRole('button', { name: race.name, exact: true })).not.toBeInTheDocument());
  expect(apiFetch).toHaveBeenCalledWith(`/api/races/${race.id}`, { method: 'DELETE' });
});

it('shows every saved race, upcoming first and then history by newest event date', async () => {
  const { agenda } = await openPage();
  const rows = within(agenda).getAllByRole('article');
  expect(rows).toHaveLength(upcoming.length + history.length);
  expect(rows.map((row) => within(row).getAllByRole('button')[1].textContent)).toEqual([
    ...upcoming.map((race) => race.name), history[2].name, history[3].name, history[1].name, history[0].name,
  ]);
  expect(agenda).toHaveTextContent(translate('races.v2_plan_count', { count: races.length }));
});

it('keeps the hero, Next emphasis and season strip limited to upcoming active races', async () => {
  const { container, agenda } = await openPage();
  const hero = container.querySelector('.race-center-hero');
  expect(hero).toHaveTextContent(upcoming[0].name);
  const nextRows = agenda.querySelectorAll('.is-next');
  expect(nextRows).toHaveLength(1);
  expect(nextRows[0]).toHaveTextContent(upcoming[0].name);
  const season = container.querySelector('.race-center-v2-season-strip');
  expect(within(season).getAllByRole('button')).toHaveLength(5);
  for (const race of history) {
    expect(hero).not.toHaveTextContent(race.name);
    expect(season).not.toHaveTextContent(race.name);
  }
});

it('keeps history manageable without promoting a past, completed or canceled race to Next', async () => {
  races = history.map((race) => ({ ...race }));
  const { container, agenda } = await openPage();
  expect(within(agenda).getAllByRole('article')).toHaveLength(history.length);
  expect(agenda.querySelector('.is-next')).toBeNull();
  expect(container.querySelector('.race-center-hero')).toHaveTextContent(en.races.stitch_hero_empty_title);
  expect(container.querySelector('.race-center-v2-season-strip')).not.toHaveTextContent(history[3].name);
});

it.each(['en', 'zh-CN'])('uses existing %s copy for history and canceled race metadata', async (lang) => {
  preferences.lang = lang;
  const { agenda } = await openPage();
  const pastRow = getSavedRow(agenda, history[0]);
  expect(pastRow).toHaveTextContent(translate('races.countdown_past', { days: 80 }));
  expect(pastRow).not.toHaveTextContent(translate('races.v2_in_days', { days: -80 }));
  const canceledRow = getSavedRow(agenda, history[2]);
  expect(canceledRow).toHaveTextContent(translate('races.status_canceled'));
  expect(canceledRow).not.toHaveTextContent(translate('races.v2_in_days', { days: 2 }));
});

it('preserves removal confirmation when the runner cancels it', async () => {
  window.confirm.mockReturnValue(false);
  const { agenda } = await openPage();
  const row = getSavedRow(agenda, upcoming[0]);
  fireEvent.click(within(row).getByRole('button', { name: translate('races.v2_remove_race', { name: upcoming[0].name }) }));
  expect(apiFetch).not.toHaveBeenCalled();
  expect(within(agenda).getByRole('button', { name: upcoming[0].name, exact: true })).toBeInTheDocument();
});

it('preserves the empty agenda when nothing is saved', async () => {
  races = [];
  const { container, agenda } = await openPage();
  expect(agenda).toHaveTextContent(en.races.agenda_empty);
  expect(within(agenda).queryAllByRole('article')).toHaveLength(0);
  expect(container.querySelector('.race-center-hero')).toHaveTextContent(en.races.stitch_hero_empty_title);
});
