import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../../contexts/I18nContext';
import { UnitProvider } from '../../../contexts/UnitContext';
import { WorkspaceProvider } from '../ui/workspace';
import { NativeTrainingRoutesProvider } from '../ui/router';
import Library from './S17';
import Plans from './S19';
import Workout from './S18';

let library, client, refresh;
const workouts = [
  { id: 'tempo', ownerId: 'runner', title: 'My tempo', minutes: 52, sport: 'Running', version: 3, folderId: 'speed', source: '52m @80% Tempo' },
  { id: 'easy', ownerId: 'coach', title: 'Shared easy', minutes: 45, sport: 'Running', version: 2, folderId: null, source: '45m @65% Easy' },
];
beforeEach(() => {
  localStorage.setItem('hermes_lang', 'en');
  library = { workouts, folders: [{ id: 'speed', name: 'Speed' }, { id: 'empty', name: 'Recovery' }], plans: [] };
  client = {
    getActor: () => 'runner', getSecurityKey: () => 'runner', subscribe: fn => { refresh = fn; return () => {}; },
    getLibrary: vi.fn(async () => library), getRoster: vi.fn(async () => ({ items: [{ id: 'runner', name: 'Me', access: 'owner' }] })),
    getPersonalizedLibrary: vi.fn(async () => ({ workouts: [], plan: { reasonCodes: ['history_required'] }, availabilitySource: 'HISTORY' })),
    createFolder: vi.fn(async ({ name }) => { const folder = { id: 'new', name }; library = { ...library, folders: [...library.folders, folder] }; refresh(); return folder; }),
    saveWorkout: vi.fn(async payload => ({ ...payload, id: 'copy', ownerId: 'runner', version: 1, revision: 1 })),
    createEvent: vi.fn(async payload => payload),
  };
});
afterEach(cleanup);
function mount(child, athleteId = 'runner', url = '/') {
  return render(<MemoryRouter initialEntries={[url]}><I18nProvider><UnitProvider><WorkspaceProvider client={client} initialAthleteId={athleteId}><NativeTrainingRoutesProvider>{child}</NativeTrainingRoutesProvider></WorkspaceProvider></UnitProvider></I18nProvider></MemoryRouter>);
}
it('filters counted folder pills and keeps shared copy actions and empty folders usable', async () => {
  mount(<Library />);
  expect(await screen.findByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('link', { name: /Copy or schedule/ })).toHaveAttribute('href', '/schedule?trainingTool=workout&id=easy');
  fireEvent.click(screen.getByRole('button', { name: 'Speed 1' }));
  expect(screen.getByText('My tempo', { selector: 'strong' })).toBeVisible();
  expect(screen.queryByText('Shared easy')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Recovery 0' }));
  expect(screen.getByText('Nothing in this folder yet')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Show all workouts' }));
  expect(screen.getByText('Shared easy', { selector: 'strong' })).toBeVisible();
});
it('creates a trimmed folder inline, selects it, and clears the form', async () => {
  mount(<Library />);
  fireEvent.click(await screen.findByRole('button', { name: /New folder/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Folder name' }), { target: { value: '  Race week  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add folder' }));
  await waitFor(() => expect(client.createFolder).toHaveBeenCalledWith({ name: 'Race week' }));
  expect(await screen.findByRole('button', { name: 'Race week 0' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('textbox', { name: 'Folder name' })).not.toBeInTheDocument();
});
it('opens the existing account-specific setup without copying a generic library plan', async () => {
  mount(<Plans />);
  expect(await screen.findByRole('link', { name: /Build my plan/ })).toHaveAttribute('href', '/schedule?planView=setup');
  expect(screen.getByText(/current fitness/)).toBeVisible();
});
it('does not send a selected coached athlete into the signed-in runner setup', async () => {
  mount(<Plans />, 'another-athlete');
  await screen.findByText('Compose a reusable plan');
  expect(screen.queryByRole('link', { name: /Build my plan/ })).not.toBeInTheDocument();
});
it('copies shared workouts and saves subsequent edits against the owned copy', async () => {
  mount(<Workout />, 'runner', '/?id=easy');
  fireEvent.click(await screen.findByRole('button', { name: 'Save workout version' }));
  await waitFor(() => expect(client.saveWorkout).toHaveBeenCalledTimes(1));
  expect(client.saveWorkout.mock.calls[0][0].workoutId).toBeUndefined();
  await screen.findByText('Workout saved in your library.');
  fireEvent.change(screen.getByLabelText('Workout name'), { target: { value: 'My own easy' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save workout version' }));
  await waitFor(() => expect(client.saveWorkout).toHaveBeenCalledTimes(2));
  expect(client.saveWorkout.mock.calls[1][0]).toMatchObject({ workoutId: 'copy', revision: 1, title: 'My own easy' });
});
it('schedules edited source without claiming it is the unchanged saved version', async () => {
  mount(<Workout />, 'runner', '/?id=tempo');
  fireEvent.change(await screen.findByLabelText('Workout steps'), { target: { value: '30m @65% Easy' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Schedule workout' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Schedule workout' }));
  await waitFor(() => expect(client.createEvent).toHaveBeenCalled());
  expect(client.createEvent.mock.calls[0][0]).toMatchObject({ athleteId: 'runner', sourceVersion: null, snapshot: { source: '30m @65% Easy' } });
});
it('blocks scheduling for a read-only athlete', async () => {
  client.getRoster.mockResolvedValue({ items: [{ id: 'another-athlete', name: 'Other runner', access: 'read' }] });
  mount(<Workout />, 'another-athlete', '/?id=tempo');
  expect(await screen.findByRole('button', { name: 'Schedule workout' })).toBeDisabled();
  expect(client.createEvent).not.toHaveBeenCalled();
});
it('offers personalized setup even before the runner has saved a first workout', async () => {
  library = { ...library, workouts: [] };
  mount(<Library />);
  expect(await screen.findByRole('link', { name: 'Build my plan' })).toHaveAttribute('href', '/schedule?planView=setup');
  expect(screen.getByText('No saved workouts yet')).toBeVisible();
});
it('does not reuse a shared author’s private folder when saving an owned copy', async () => {
  library = { ...library, workouts: [{ ...workouts[1], folderId: 'coach-private-folder' }] };
  mount(<Workout />, 'runner', '/?id=easy');
  fireEvent.click(await screen.findByRole('button', { name: 'Save workout version' }));
  await waitFor(() => expect(client.saveWorkout).toHaveBeenCalled());
  expect(client.saveWorkout.mock.calls[0][0].folderId).toBe('');
});
