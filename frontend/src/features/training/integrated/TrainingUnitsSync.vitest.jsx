import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UnitProvider, useUnit, UNIT_PREFERENCE_EVENT } from '../../../contexts/UnitContext';
import TrainingUnitsSync from './TrainingUnitsSync';

const auth = vi.hoisted(() => ({ token: 'session-a', authHydrated: true }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth }));
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
let profiles, calls, failure, conflict, deferred;
const response = (status, data) => ({ ok: status < 400, status, json: async () => data });
function Probe() {
  const { unit, setUnit } = useUnit();
  return <><output data-testid="unit">{unit}</output><button onClick={() => setUnit('mile')}>Miles</button><button onClick={() => setUnit('km')}>Kilometres</button></>;
}
function Root() { return <UnitProvider><TrainingUnitsSync /><Probe /></UnitProvider>; }
const patches = () => calls.filter(call => call.options.method === 'PATCH');
beforeEach(() => {
  localStorage.clear(); auth.token = 'session-a'; auth.authHydrated = true;
  calls = []; failure = false; conflict = false; deferred = null;
  profiles = { 'session-a': { id: ownerA, units: 'metric', revision: 1 }, 'session-b': { id: ownerB, units: 'metric', revision: 1 } };
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    calls.push({ url, options });
    if (failure) throw Error('Offline');
    const token = options.headers.Authorization.slice(7);
    if (options.method === 'PATCH') {
      if (conflict) { conflict = false; profiles[token].revision++; return response(409, { code: 'STALE_REVISION' }); }
      Object.assign(profiles[token], JSON.parse(options.body)); profiles[token].revision++;
      return response(200, { ...profiles[token] });
    }
    if (deferred && token === 'session-a') return deferred;
    return response(200, { ...profiles[token] });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it('hydrates server units silently with bearer authentication and no cookie session', async () => {
  profiles['session-a'].units = 'imperial';
  const event = vi.fn(); window.addEventListener(UNIT_PREFERENCE_EVENT, event);
  render(<Root />);
  await waitFor(() => expect(screen.getByTestId('unit')).toHaveTextContent('mile'));
  expect(event).not.toHaveBeenCalled();
  expect(calls).toHaveLength(1);
  expect(calls[0].options).toMatchObject({ credentials: 'omit', headers: { Authorization: 'Bearer session-a' } });
  expect(localStorage.getItem(`hermes_training_units_migrated_${ownerA}`)).toBe(ownerA);
  expect(Object.values(localStorage)).not.toContain('session-a');
  window.removeEventListener(UNIT_PREFERENCE_EVENT, event);
});

it('preserves a prior explicit native choice once when migrating a default metric profile', async () => {
  localStorage.setItem('hermes_unit', 'mile');
  render(<Root />);
  await waitFor(() => expect(patches()).toHaveLength(1));
  expect(JSON.parse(patches()[0].options.body)).toEqual({ units: 'imperial' });
  expect(patches()[0].options.headers['If-Match']).toBe('1');
  await waitFor(() => expect(localStorage.getItem(`hermes_training_units_migrated_${ownerA}`)).toBe(ownerA));
});

it('saves a picker choice using the current profile revision and refetches once on conflict', async () => {
  render(<Root />);
  await waitFor(() => expect(localStorage.getItem(`hermes_training_units_migrated_${ownerA}`)).toBe(ownerA));
  conflict = true;
  fireEvent.click(screen.getByRole('button', { name: 'Miles' }));
  await waitFor(() => expect(patches()).toHaveLength(2));
  expect(patches().map(call => call.options.headers['If-Match'])).toEqual(['1', '2']);
  expect(profiles['session-a'].units).toBe('imperial');
});

it('applies coach bulk configuration on the periodic refresh without another picker', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  render(<Root />);
  await act(async () => {});
  expect(localStorage.getItem(`hermes_training_units_migrated_${ownerA}`)).toBe(ownerA);
  profiles['session-a'].units = 'imperial'; profiles['session-a'].revision++;
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByTestId('unit')).toHaveTextContent('mile');
  expect(patches()).toHaveLength(0);
});

it('keeps a failed local choice and retries it on reconnect before applying server values', async () => {
  render(<Root />);
  await waitFor(() => expect(localStorage.getItem(`hermes_training_units_migrated_${ownerA}`)).toBe(ownerA));
  failure = true;
  fireEvent.click(screen.getByRole('button', { name: 'Miles' }));
  expect(screen.getByTestId('unit')).toHaveTextContent('mile');
  await act(async () => {});
  failure = false;
  fireEvent(window, new Event('online'));
  await waitFor(() => expect(profiles['session-a'].units).toBe('imperial'));
  expect(screen.getByTestId('unit')).toHaveTextContent('mile');
});

it('does not migrate the previous account preference into a new account', async () => {
  profiles['session-a'].units = 'imperial';
  const view = render(<Root />);
  await waitFor(() => expect(screen.getByTestId('unit')).toHaveTextContent('mile'));
  auth.token = 'session-b'; view.rerender(<Root />);
  await waitFor(() => expect(localStorage.getItem('hermes_training_units_owner')).toBe(ownerB));
  expect(screen.getByTestId('unit')).toHaveTextContent('km');
  expect(profiles['session-b'].units).toBe('metric');
  expect(patches()).toHaveLength(0);
});

it('ignores old-account responses after the credential changes', async () => {
  let release;
  deferred = new Promise(resolve => { release = resolve; });
  const view = render(<Root />);
  await waitFor(() => expect(calls).toHaveLength(1));
  auth.token = 'session-b'; view.rerender(<Root />);
  await waitFor(() => expect(localStorage.getItem('hermes_training_units_owner')).toBe(ownerB));
  await act(async () => { release(response(200, { id: ownerA, units: 'imperial', revision: 9 })); });
  expect(screen.getByTestId('unit')).toHaveTextContent('km');
  expect(localStorage.getItem('hermes_training_units_owner')).toBe(ownerB);
});
