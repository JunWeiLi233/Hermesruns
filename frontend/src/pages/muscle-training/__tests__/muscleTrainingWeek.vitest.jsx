import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MuscleTraining from '../MuscleTraining';
import { apiJson } from '../../../api';

const { preferences, t } = vi.hoisted(() => ({
  preferences: { lang: 'en', isMile: false },
  t: (key, values = {}) => `${key}${values.count == null && values.run == null ? '' : ` ${values.count ?? values.run}`}`,
}));
vi.mock('../../../api', () => ({ apiJson: vi.fn() }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: preferences.lang, t }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ isMile: preferences.isMile }) }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('../../../components/PageSkeleton', () => ({ default: () => <div role="status">Loading</div> }));
vi.mock('../../../components/RunActivityContributionGraph', () => ({
  default: ({ runs, status }) => <div data-testid="activity-history">{status}:{runs.length}</div>,
}));

const exercise = (name, muscles) => ({ name, muscles, sets: 3, repsOrDuration: '8/side', targetRpe: 6 });
function makePlan({ appliedDate = '2026-10-07', completed = false } = {}) {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-${String(7 + index).padStart(2, '0')}`,
      run: index === 0 ? { workoutType: 'EASY', plannedDistanceKm: 8 } : null,
      strength: [0, 2, 4].includes(index)
        ? { sessionType: index === 2 ? 'CUSTOM_CORE_STABILITY_MICRO' : 'CUSTOM_LEG_DAY_STANDARD', durationMinutes: 20 }
        : null,
    })),
    sessions: [
      { sessionType: 'CUSTOM_LEG_DAY_STANDARD', blocks: [{ title: 'Legs', exercises: [exercise('Split squat', ['Legs'])] }] },
      { sessionType: 'CUSTOM_CORE_STABILITY_MICRO', blocks: [{ title: 'Core', exercises: [exercise('Dead bug', ['Core'])] }] },
    ],
    strengthCoachDecision: { appliedDate, appliedFocus: 'LEG_DAY', appliedDose: 'STANDARD' },
    todayCheckIn: completed ? { entryState: 'ACTUAL' } : null,
  };
}

let plan;
let history;
beforeEach(() => {
  plan = makePlan();
  history = [];
  preferences.lang = 'en';
  preferences.isMile = false;
  apiJson.mockImplementation(async (url, options) => {
    if (url === '/api/profile/me') return { displayName: 'Runner' };
    if (url.endsWith('/plan')) return plan;
    if (url.endsWith('/check-ins')) return history;
    if (url.endsWith('/today') && options?.method === 'PUT') {
      plan = makePlan({ completed: true });
      history = [{ trainingDate: '2026-10-07', entryState: 'ACTUAL' }];
      return {};
    }
    throw new Error(`Unexpected API call: ${url}`);
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function openPage() {
  const result = render(<MemoryRouter><MuscleTraining /></MemoryRouter>);
  await screen.findByRole('heading', { level: 1 });
  return result;
}

it('keeps the shell and switches days, exercises, and rest states without saving', async () => {
  plan = makePlan({ appliedDate: '2026-10-09' });
  const { container } = await openPage();
  const week = container.querySelector('.mt-week-v2-strip');
  const days = within(week).getAllByRole('button');
  expect(days).toHaveLength(7);
  expect(days[2]).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /Dead bug/ })).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'profile.sidebar_expand' }));
  expect(container.querySelector('.runner-dashboard-page')).not.toHaveClass('is-sidebar-collapsed');

  fireEvent.click(screen.getByRole('button', { name: /Dead bug/ }));
  const video = screen.getByRole('link', { name: 'muscle_training.stitch_video_demo_title' });
  expect(video.href).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=/);
  fireEvent.click(days[1]);
  expect(screen.queryByRole('button', { name: /Dead bug/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'muscle_training.stitch_video_demo_title' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'muscle_training.v3_start_session' })).not.toBeInTheDocument();
  expect(apiJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
});

it('records today once and refreshes the completion state and activity history', async () => {
  await openPage();
  fireEvent.click(screen.getByRole('button', { name: 'muscle_training.v3_start_session' }));
  expect(apiJson.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(false);
  expect(screen.getByRole('button', { name: /Split squat/ })).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'muscle_training.v3_complete_session' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'muscle_training.check_in_done' })).toBeDisabled());
  expect(screen.getByTestId('activity-history')).toHaveTextContent('ready:1');
  const saves = apiJson.mock.calls.filter(([, options]) => options?.method === 'PUT');
  expect(saves).toHaveLength(1);
  expect(JSON.parse(saves[0][1].body)).toMatchObject({
    entryState: 'ACTUAL', distanceKm: null, durationMinutes: null,
    strengthFocus: 'LEG_DAY', strengthDose: 'STANDARD',
  });
});

it('keeps translated prescriptions and the selected distance unit in the week', async () => {
  preferences.lang = 'zh-CN';
  preferences.isMile = true;
  const { container } = await openPage();
  const today = within(container.querySelector('.mt-week-v2-strip')).getAllByRole('button')[0];
  expect(today).toHaveTextContent('5 英里');
  expect(today).toHaveTextContent('20 分钟');
  expect(container.querySelector('.mt-week-v2-rx')).toHaveTextContent('3 × 8/侧');
  const coverage = within(container.querySelector('.mt-week-v2-coverage')).getAllByRole('listitem');
  expect(coverage).toHaveLength(5);
  expect(coverage.find((row) => row.textContent.includes('muscle_training.v3_coverage_legs'))).toHaveTextContent('2/3');
});

it('keeps the selected day available when a check-in fails so it can be retried', async () => {
  const { container } = await openPage();
  const normalApi = apiJson.getMockImplementation();
  apiJson.mockImplementation((url, options) => options?.method === 'PUT'
    ? Promise.reject(new Error('Save failed. Please try again.'))
    : normalApi(url, options));
  fireEvent.click(screen.getByRole('button', { name: 'muscle_training.v3_start_session' }));
  fireEvent.click(screen.getByRole('button', { name: 'muscle_training.v3_complete_session' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed. Please try again.');
  expect(screen.getByRole('button', { name: 'muscle_training.v3_complete_session' })).toBeEnabled();
  expect(container.querySelector('.mt-week-v2-strip')).toBeInTheDocument();
});
