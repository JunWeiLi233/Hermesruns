import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CoachingTools from './CoachingTools';

const openConversation = vi.hoisted(() => vi.fn());
vi.mock('./integrationTools.css', () => ({}));
vi.mock('../../../contexts/I18nContext', async () => {
  const { default: en } = await import('../../../i18n/locales/en/trainingIntegration');
  return { useI18n: () => ({ t: key => key.split('.').reduce((value, part) => value?.[part], en) || key, lang: 'en' }) };
});
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../ui/workspace', () => ({
  useWorkspace: () => ({ api: { mode: 'http', getActor: () => 'self', openConversation } }),
  useResource: method => ({ data: {
    getRoster: { items: [{ id: 'coach', name: 'Current Coach', access: 'coach' }] },
    getConversations: { items: [{ id: 'first', name: 'First thread', kind: 'direct' }, { id: 'second', name: 'Second thread', kind: 'direct' }, { id: 'opened', name: 'New thread', kind: 'direct' }] },
    getActivityConversation: { id: 'first' }, getMe: { id: 'self' }, getMessages: { items: [] }, getLibrary: { workouts: [] },
  }[method] }),
  useCommand: () => ({ run: operation => operation() }),
}));
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}
function mountConversation() {
  render(<MemoryRouter initialEntries={['/profile/team?view=messages&athlete=selected-athlete&activity=session&conversation=first']}>
    <CoachingTools view="messages" /><Location />
  </MemoryRouter>);
}
beforeEach(() => { openConversation.mockReset(); openConversation.mockResolvedValue({ id: 'opened' }); });
afterEach(cleanup);

it('keeps the Team page, athlete and activity when selecting a thread', () => {
  mountConversation();
  fireEvent.click(screen.getByRole('button', { name: /Second thread/ }));
  expect(screen.getByTestId('location')).toHaveTextContent('/profile/team?view=messages&athlete=selected-athlete&activity=session&conversation=second');
  expect(screen.getByRole('button', { name: /Second thread/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByLabelText('Message text')).toBeInTheDocument();
});

it('keeps the existing context after opening a direct conversation', async () => {
  mountConversation();
  fireEvent.click(screen.getByRole('button', { name: 'New conversation' }));
  fireEvent.change(screen.getByLabelText('Start a direct conversation'), { target: { value: 'coach' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open conversation' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/profile/team?view=messages&athlete=selected-athlete&activity=session&conversation=opened'));
  expect(openConversation).toHaveBeenCalledWith({ kind: 'direct', peerId: 'coach' });
  expect(screen.getByRole('button', { name: /New thread/ })).toHaveAttribute('aria-pressed', 'true');
});
