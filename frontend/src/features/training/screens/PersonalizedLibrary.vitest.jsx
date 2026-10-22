import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../contexts/I18nContext';
import { UnitProvider } from '../../../contexts/UnitContext';
import { WorkspaceProvider } from '../ui/workspace';
import PersonalizedLibrary from './PersonalizedLibrary';

afterEach(cleanup);
function mount(client) {
  localStorage.setItem('hermes_lang', 'en');localStorage.setItem('hermes_unit', 'km');
  return render(<MemoryRouter><I18nProvider><UnitProvider><WorkspaceProvider client={client}><PersonalizedLibrary /></WorkspaceProvider></UnitProvider></I18nProvider></MemoryRouter>);
}
function clientFor(id, distance, pace) {
  return { getActor: () => id, getSecurityKey: () => id, subscribe: () => () => {}, getPersonalizedLibrary: vi.fn(async () => ({
    workouts: [{ scheduledDate: '2026-10-20', workoutType: 'EASY', plannedDistanceKm: distance, plannedDurationMinutes: 35, targetPaceMinSecondsPerKm: pace, targetPaceMaxSecondsPerKm: pace + 30, reasonCode: 'aerobic_progression' }],
    plan: { preferredRunDays: ['TUESDAY', 'THURSDAY', 'SUNDAY'], timeZone: 'America/New_York', reasonCodes: [], historyEvidence: { averageWeeklyKm: distance * 4 } }, availabilitySource: 'CONFIRMED', goal: { name: 'My 10K' }, activePlan: false,
  })) };
}
it('shows the runner’s actual distance, pace range, goal, and training days in the library', async () => {
  mount(clientFor('runner-a', 5, 360));
  expect(await screen.findByText(/5.0 km/)).toBeVisible();
  expect(screen.getByText(/My 10K/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /View workout/ }));
  expect(screen.getByText(/6:00.*6:30/)).toBeVisible();
  expect(screen.getByText(/Tue.*Thu.*Sun/)).toBeVisible();
});
it('clears a previous account’s recommendations immediately while the next account loads', async () => {
  const view = mount(clientFor('runner-a', 5, 360));
  await screen.findByText(/5.0 km/);
  const next = clientFor('runner-b', 12, 280);
  let finish; next.getPersonalizedLibrary.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  view.rerender(<MemoryRouter><I18nProvider><UnitProvider><WorkspaceProvider client={next}><PersonalizedLibrary /></WorkspaceProvider></UnitProvider></I18nProvider></MemoryRouter>);
  expect(screen.queryByText(/5.0 km/)).not.toBeInTheDocument();
  finish({workouts: [], plan: { reasonCodes: ['history_required'] }, availabilitySource: 'HISTORY'});
  expect(await screen.findByText(/running history to tailor/)).toBeVisible();
});
it('reports unavailable personalization without filling the library with sample workouts', async () => {
  const client = clientFor('runner', 5, 360);client.getPersonalizedLibrary.mockRejectedValue(new Error('Offline'));
  mount(client);
  expect(await screen.findByText(/Couldn’t load your personalized workouts/)).toBeVisible();
  expect(screen.queryByText(/5.0 km/)).not.toBeInTheDocument();
});
it('shows different prescriptions for runners with different server-side fitness and history', async () => {
  const first=mount(clientFor('a',5,360));await screen.findByText(/5.0 km/);first.unmount();
  mount(clientFor('b',12,280));
  expect(await screen.findByText(/12.0 km/)).toBeVisible();
  expect(screen.queryByText(/5.0 km/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:/View workout/}));
  expect(screen.getByText(/4:40.*5:10/)).toBeVisible();
});
