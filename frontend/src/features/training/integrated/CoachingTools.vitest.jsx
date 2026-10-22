import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import CoachingTools from './CoachingTools';
vi.mock('./integrationTools.css', () => ({}));
const setAthlete = vi.hoisted(() => vi.fn());
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../ui/workspace', () => ({
  useWorkspace: () => ({ api: { mode: 'http' }, setAthlete }),
  useCommand: () => ({}),
  useResource: () => ({ data: { items: [{ id: 'a', name: 'Athlete', access: 'coach' }, { id: 'b', name: 'Unconsented', access: 'none' }] } }),
}));
vi.mock('../screens/S23', () => ({ default: () => <p>Conversation content</p> }));
vi.mock('../screens/S24', () => ({ default: () => <p>Team content</p> }));
afterEach(cleanup);
it('shows only the requested tool and never another workspace navigation', () => {
  render(<MemoryRouter><CoachingTools view="messages" /></MemoryRouter>);
  expect(screen.getByText('Conversation content')).toBeInTheDocument();
  expect(screen.queryByText('Team content')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
it('offers permitted calendar links without invented athlete totals', () => {
  render(<MemoryRouter><CoachingTools view="athletes" /></MemoryRouter>);
  const link = screen.getByRole('link', { name: 'training_integration.openCalendar Athlete' });
  expect(link).toHaveAttribute('href', '/schedule?athlete=a');
  fireEvent.click(link);
  expect(setAthlete).toHaveBeenCalledWith('a');
  expect(screen.getByText('Unconsented')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /training_integration.openCalendar/ })).toHaveLength(1);
  expect(screen.queryByText('Completed minutes')).not.toBeInTheDocument();
});
