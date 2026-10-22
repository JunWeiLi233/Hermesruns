import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import en from '../../../i18n/locales/en/trainingIntegration';
import zh from '../../../i18n/locales/zh-CN/trainingIntegration';
import SettingsTrainingTools from './SettingsTrainingTools';
vi.mock('./integrationTools.css', () => ({}));

const state = vi.hoisted(() => ({
  lang: 'en', resources: {},
  api: { updateProfile: vi.fn(), decideAccess: vi.fn(), decideTeamConsent: vi.fn(), requestAccess: vi.fn(), revokeAll: vi.fn() },
}));
const t = (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], state.lang === 'en' ? en : zh) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../ui/workspace', () => ({
  useWorkspace: () => ({ api: { mode: 'http', ...state.api }, actor: 'self', athleteId: 'self' }),
  useResource: method => ({ data: state.resources[method] }),
  useCommand: () => ({ run: async operation => operation() }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.lang = 'en';
  state.resources = {
    getMe: { id: 'self', revision: 4, ftp: 250, fitnessTau: 42, fatigueTau: 7, discoverable: false, routePrivate: true },
    getRoster: { items: [{ id: 'self', name: 'Owner', access: 'owner' }] },
    searchAthletes: { items: [{ id: 'self', name: 'Owner' }, { id: 'athlete', name: 'Sam Ortiz' }] },
    getRequests: { items: [
      { id: 'grant', subject: 'self', grantee: 'coach', granteeName: 'Coach', subjectName: 'Owner', level: 'coach', state: 'pending' },
      { id: 'accepted', subject: 'self', grantee: 'existing', granteeName: 'Existing Coach', subjectName: 'Owner', level: 'read', state: 'accepted' },
      { id: 'sent', subject: 'athlete', grantee: 'self', granteeName: 'Owner', subjectName: 'Sam Ortiz', level: 'read', state: 'pending' },
    ] },
    getTeams: { items: [{ id: 'team', name: 'Team', ownRole: 'member', coachingEnabled: true, scopeRevision: 3, consent: { state: 'pending' } }] },
    getJoinCard: {},
    getAccess: { items: [
      { id: 'accepted', granteeName: 'Existing Coach', level: 'read', state: 'accepted' },
      { id: 'pending', granteeName: 'Pending Coach', level: 'coach', state: 'pending' },
    ], groups: [] },
  };
});
afterEach(cleanup);
const open = view => render(<MemoryRouter><SettingsTrainingTools view={view} /></MemoryRouter>);

it('saves only unique model anchors with their current revision', async () => {
  open('training');
  fireEvent.change(screen.getByLabelText('Functional threshold power (W)'), { target: { value: '275' } });
  fireEvent.click(screen.getByRole('button', { name: 'settings.save' }));
  await waitFor(() => expect(state.api.updateProfile).toHaveBeenCalledWith({ ftp: 275, fitnessTau: 42, fatigueTau: 7, revision: 4 }));
  for (const name of ['Display name', 'Time zone', 'Maximum heart rate (bpm)', 'Distance units']) expect(screen.queryByLabelText(name)).not.toBeInTheDocument();
});

it('keeps account operations in the existing Settings account card and preserves team settings', () => {
  open('account');
  expect(screen.getByRole('heading', { name: 'Coach access' })).toBeInTheDocument();
  expect(screen.getByText('Your data, your grants')).toBeInTheDocument();
  expect(screen.queryByText('Account export and deletion')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Download account export' })).not.toBeInTheDocument();
  expect(screen.getByText('Team settings').closest('details')).not.toHaveAttribute('open');
  expect(screen.getByRole('button', { name: 'Revoke direct grant for Existing Coach' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revoke Existing Coach' })).toBeInTheDocument();
  expect(screen.queryByText('Pending Coach')).not.toBeInTheDocument();
});

it('saves privacy switches with the current profile revision', async () => {
  open('account');
  expect(screen.getByRole('switch', { name: 'Keep precise route private' })).toBeChecked();
  fireEvent.click(screen.getByRole('switch', { name: 'Allow profile discovery' }));
  await waitFor(() => expect(state.api.updateProfile).toHaveBeenCalledWith({ discoverable: true, revision: 4 }));
  fireEvent.click(screen.getByRole('switch', { name: 'Keep precise route private' }));
  await waitFor(() => expect(state.api.updateProfile).toHaveBeenLastCalledWith({ routePrivate: false, revision: 4 }));
});

it('accepts a direct grant without silently sharing wellness fields', async () => {
  open('account');
  fireEvent.click(screen.getByRole('button', { name: 'Accept Coach' }));
  await waitFor(() => expect(state.api.decideAccess).toHaveBeenCalledWith({ relationshipId: 'grant', decision: 'accepted', wellness: [] }));
});

it('includes sleep only after the user explicitly enables it', async () => {
  open('account');
  fireEvent.click(screen.getByRole('switch', { name: 'Also share sleep duration when I accept' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept Coach' }));
  await waitFor(() => expect(state.api.decideAccess).toHaveBeenCalledWith({ relationshipId: 'grant', decision: 'accepted', wellness: ['sleep'] }));
});

it('separates Received and Sent and supports keyboard tab navigation', () => {
  open('account');
  expect(screen.getByRole('tab', { name: 'Received 1' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.queryByText('You asked Sam Ortiz')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Accept Existing Coach' })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Received 1' }), { key: 'ArrowRight' });
  expect(screen.getByRole('tab', { name: 'Sent' })).toHaveFocus();
  expect(screen.getByText('You asked Sam Ortiz')).toBeInTheDocument();
  expect(screen.queryByText('Coach wants access to you')).not.toBeInTheDocument();
  expect(within(screen.getByRole('tabpanel')).queryByRole('button')).not.toBeInTheDocument();
});

it('requests the chosen access level for a discoverable athlete and opens Sent', async () => {
  open('account');
  const submit = screen.getByRole('button', { name: 'Request access' });
  expect(submit).toBeDisabled();
  expect(screen.queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Athlete'), { target: { value: 'athlete' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Coach' }));
  fireEvent.click(submit);
  await waitFor(() => expect(state.api.requestAccess).toHaveBeenCalledWith({ athleteId: 'athlete', level: 'coach' }));
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Sent' })).toHaveAttribute('aria-selected', 'true'));
  expect(submit).toBeDisabled();
});

it('declines and revokes without changing wellness fields', async () => {
  open('account');
  fireEvent.click(screen.getByRole('button', { name: 'Decline Coach' }));
  await waitFor(() => expect(state.api.decideAccess).toHaveBeenCalledWith({ relationshipId: 'grant', decision: 'declined' }));
  fireEvent.click(screen.getByRole('button', { name: 'Revoke Existing Coach' }));
  await waitFor(() => expect(state.api.decideAccess).toHaveBeenLastCalledWith({ relationshipId: 'accepted', decision: 'revoked' }));
});

it('requires inline confirmation for revoke-all, supports Cancel and Escape, and restores focus', async () => {
  open('account');
  fireEvent.click(screen.getByRole('button', { name: 'Revoke all grants…' }));
  expect(state.api.revokeAll).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Revoke all grants…' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke all grants…' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
  expect(state.api.revokeAll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Revoke all grants…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Revoke all', exact: true }));
  await waitFor(() => expect(state.api.revokeAll).toHaveBeenCalledTimes(1));
});

it('counts only accepted direct grants and current enabled member consent', () => {
  state.resources.getAccess.groups = [
    { teamId: 'team', teamName: 'Run Club', state: 'granted', scopeRevision: 3 },
    { teamId: 'stale', teamName: 'Stale Club', state: 'granted', scopeRevision: 2 },
    { teamId: 'disabled', teamName: 'Disabled Club', state: 'granted', scopeRevision: 3 },
    { teamId: 'left', teamName: 'Former Club', state: 'granted', scopeRevision: 3 },
  ];
  state.resources.getTeams.items = [
    { id: 'team', ownRole: 'member', coachingEnabled: true, scopeRevision: 3, consent: { state: 'granted' } },
    { id: 'stale', ownRole: 'member', coachingEnabled: true, scopeRevision: 3, consent: { state: 'scope changed — review required' } },
    { id: 'disabled', ownRole: 'member', coachingEnabled: false, scopeRevision: 3, consent: { state: 'granted' } },
  ];
  open('account');
  expect(screen.getByText('2 active')).toBeInTheDocument();
  expect(screen.getByText('Run Club')).toBeInTheDocument();
  for (const name of ['Stale Club', 'Disabled Club', 'Former Club']) expect(screen.queryByText(name)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Managed in team settings' }));
  expect(document.getElementById('coach-access-team-settings')).toHaveAttribute('open');
});

it('keeps team scope revision and optional wellness consent separate from membership', async () => {
  open('account');
  fireEvent.click(screen.getByText('Team settings'));
  fireEvent.click(screen.getByRole('button', { name: 'Accept disclosed scope' }));
  await waitFor(() => expect(state.api.decideTeamConsent).toHaveBeenCalledWith({ teamId: 'team', decision: 'granted', scopeRevision: 3, level: 'coach', wellness: [] }));
});

it('renders honest empty states and matching Chinese translations', () => {
  state.lang = 'zh-CN';
  state.resources.getRequests.items = [];
  state.resources.getAccess.items = [];
  state.resources.searchAthletes.items = [];
  open('account');
  expect(screen.getByRole('heading', { name: '教练访问' })).toBeInTheDocument();
  expect(screen.getByText('你尚未授权任何人查看你的数据。')).toBeInTheDocument();
  expect(screen.getByText('尚未收到请求。')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: '已发送' }));
  expect(screen.getByText('你尚未发送请求。')).toBeInTheDocument();
  expect(Object.keys(en.training_integration.coachAccess).sort()).toEqual(Object.keys(zh.training_integration.coachAccess).sort());
});
