import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import Team from '../../features/training/screens/S24';
import { WorkspaceProvider } from '../../features/training/ui/workspace';

vi.mock('../../contexts/I18nContext', async () => {
  const { default: en } = await import('../../i18n/locales/en/trainingIntegration');
  return { useI18n: () => ({ t: (key, values = {}) => {
    const text = key.split('.').reduce((value, part) => value?.[part], en) || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  } }) };
});
afterEach(cleanup);

const members = [
  { userId: 'self', name: 'Lena Ho', role: 'admin', state: 'active' },
  { userId: 'coach', name: 'Mia Chen', role: 'coach', state: 'active' },
  { userId: 'runner', name: 'Tom Reyes', role: 'member', state: 'active' },
  { userId: 'pending', name: 'Sam Ortiz', role: 'member', state: 'pending' },
  { userId: 'removed', name: 'Removed Runner', role: 'removed', state: 'removed' },
];
function mount(overrides = {}, items) {
  const team = { id: 'club', name: 'Riverside Run Club', slug: 'riverside-rc', revision: 4, ownRole: 'admin', coachingEnabled: true, posting: 'members', visibility: 'members', members, ...overrides };
  const listeners = new Set();
  let version = 0;
  const api = { mode: 'http', getActor: () => 'self', getSecurityKey: () => `self:${version}`, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, refreshSecurity: () => { version++; listeners.forEach(listener => listener()); }, getMe: async () => ({ id: 'self' }), getTeams: async () => ({ items: items || [team] }), updateTeam: vi.fn(async () => ({})), updateMember: vi.fn(async () => ({})), createTeam: vi.fn(async () => ({ id: 'new' })) };
  render(<MemoryRouter><WorkspaceProvider client={api}><Team /></WorkspaceProvider></MemoryRouter>);
  return api;
}

it('filters real members, excludes removed records and protects the last administrator', async () => {
  const user = userEvent.setup();
  mount();
  expect(await screen.findByText('Lena Ho')).toBeInTheDocument();
  expect(screen.queryByText('Removed Runner')).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Role for Lena Ho' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Pending 1' }));
  expect(screen.getByText('Sam Ortiz')).toBeInTheDocument();
  expect(screen.queryByText('Mia Chen')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Staff 2' }));
  expect(screen.getByText('Mia Chen')).toBeInTheDocument();
  expect(screen.queryByText('Sam Ortiz')).not.toBeInTheDocument();
});

it('saves changed policies with the team revision and keeps training consent separate', async () => {
  const user = userEvent.setup();
  const api = mount();
  api.updateTeam.mockImplementationOnce(async () => { api.refreshSecurity(); return {}; });
  const save = await screen.findByRole('button', { name: 'Save' });
  expect(save).toBeDisabled();
  await user.click(screen.getByRole('switch', { name: /Group coaching/ }));
  await user.click(within(screen.getByRole('group', { name: 'Who can post' })).getByLabelText('Staff only'));
  await user.click(save);
  expect(api.updateTeam).toHaveBeenCalledWith({ teamId: 'club', revision: 4, name: 'Riverside Run Club', coachingEnabled: false, posting: 'staff', visibility: 'members' });
  expect(screen.getByText(/Joining a team does not share/)).toBeInTheDocument();
  expect(await screen.findByText('Team settings saved. Changes to coaching access require fresh consent.')).toBeInTheDocument();
});

it('approves and declines requests through the existing membership API', async () => {
  const user = userEvent.setup();
  const api = mount();
  await user.click(await screen.findByRole('button', { name: 'Approve Sam Ortiz' }));
  expect(api.updateMember).toHaveBeenCalledWith({ teamId: 'club', userId: 'pending', role: 'member' });
  await user.click(screen.getByRole('button', { name: 'Decline Sam Ortiz' }));
  expect(api.updateMember).toHaveBeenCalledWith({ teamId: 'club', userId: 'pending', role: 'removed' });
});

it('keeps administration controls out of a member view', async () => {
  mount({ ownRole: 'member' });
  await screen.findByRole('heading', { name: 'Riverside Run Club' });
  expect(screen.queryByRole('heading', { name: 'Team settings' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve Sam Ortiz' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('keeps creation collapsed and exposes the create and join empty state', async () => {
  const user = userEvent.setup();
  const api = mount({}, []);
  expect(await screen.findByText('You’re not on a team yet')).toBeInTheDocument();
  expect(screen.queryByLabelText('New team name')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Join a team' })).toHaveAttribute('href', '/settings?section=account#coach-access-team-settings');
  await user.click(screen.getByRole('button', { name: 'Create a team' }));
  await user.type(screen.getByLabelText('New team name'), 'Tuesday runners');
  await user.click(screen.getByRole('button', { name: 'Create team' }));
  expect(api.createTeam).toHaveBeenCalledWith({ name: 'Tuesday runners' });
});
