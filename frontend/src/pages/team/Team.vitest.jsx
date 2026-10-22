import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import Team from './Team';
import TeamProfileCard from './TeamProfileCard';
import LegacyCoachingRedirect from './LegacyCoachingRedirect';

vi.mock('../../contexts/I18nContext', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('../../components/AuthenticatedPageChrome', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../../components/AppIcon', () => ({ default: () => <span aria-hidden="true" /> }));
vi.mock('../../features/training/integrated/TrainingDataProvider', () => ({ default: ({ children }) => children }));
vi.mock('../../features/training/ui/workspace', () => ({ useResource: () => ({ data: { items: [] } }) }));
vi.mock('../../features/training/integrated/CoachingTools', () => ({ default: ({ view }) => <p>Workspace: {view}</p> }));
afterEach(cleanup);

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}{location.hash}</output><button onClick={() => navigate(-1)}>Back</button></>;
}
function mount(url = '/profile/team') {
  render(<MemoryRouter initialEntries={[url]}><Team /><Location /></MemoryRouter>);
}

it('opens Team by default and supports linked sections and browser back', async () => {
  const user = userEvent.setup();
  mount();
  expect(screen.getByText('Workspace: team')).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: /training_integration.athletes/ }));
  expect(screen.getByText('Workspace: athletes')).toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/profile/team?view=athletes');
  await user.click(screen.getByRole('link', { name: /training_integration.messages/ }));
  expect(screen.getByText('Workspace: messages')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('Workspace: athletes')).toBeInTheDocument();
});

it('opens a bookmarked conversation with its full context', () => {
  mount('/profile/team?view=messages&conversation=thread&activity=session#message-1');
  expect(screen.getByText('Workspace: messages')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /training_integration.messages/ })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByTestId('location')).toHaveTextContent('conversation=thread&activity=session#message-1');
});

it('uses Team for an unknown section', () => {
  mount('/profile/team?view=unknown');
  expect(screen.getByText('Workspace: team')).toBeInTheDocument();
});

it('gives Profile a main team entry and shortcuts to all three sections', () => {
  render(<MemoryRouter><TeamProfileCard /></MemoryRouter>);
  expect(screen.getByRole('link', { name: /training_integration.teamPage.open/ })).toHaveAttribute('href', '/profile/team');
  expect(screen.getByRole('link', { name: /training_integration.athletes/ })).toHaveAttribute('href', '/profile/team?view=athletes');
  expect(screen.getByRole('link', { name: /training_integration.messages/ })).toHaveAttribute('href', '/profile/team?view=messages');
});

it('redirects an old Today conversation before rendering the workout page', () => {
  render(<MemoryRouter initialEntries={['/today-run?coaching=messages&conversation=thread&athlete=runner#message-1']}><Routes>
    <Route path="/today-run" element={<LegacyCoachingRedirect><p>Today workout</p></LegacyCoachingRedirect>} />
    <Route path="/profile/team" element={<Location />} />
  </Routes></MemoryRouter>);
  expect(screen.queryByText('Today workout')).not.toBeInTheDocument();
  expect(screen.getByTestId('location')).toHaveTextContent('/profile/team?conversation=thread&athlete=runner&view=messages#message-1');
});

it('keeps ordinary Today links on the workout page', () => {
  render(<MemoryRouter initialEntries={['/today-run?planId=plan']}><LegacyCoachingRedirect><p>Today workout</p></LegacyCoachingRedirect></MemoryRouter>);
  expect(screen.getByText('Today workout')).toBeInTheDocument();
});
