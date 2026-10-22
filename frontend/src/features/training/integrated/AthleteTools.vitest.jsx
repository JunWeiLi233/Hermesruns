import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ t: key => key }) }));
vi.mock('./TrainingDataProvider', () => ({ default: ({ children }) => <div data-testid="training-provider">{children}</div> }));
vi.mock('../screens/S12', () => ({ default: () => <p>Saved overlay sessions</p> }));
vi.mock('../screens/S14', () => ({ default: () => <p>Sport volume</p> }));
vi.mock('../screens/S15', () => ({ default: () => <p>Period comparison</p> }));
vi.mock('../screens/S13', () => ({ default: () => <p>Distinct fitness model estimates</p> }));
vi.mock('../screens/S16', () => ({ default: () => <p>Recovery journal</p> }));
vi.mock('../../../pages/training-plan/TrainingPlan', () => ({ RunPlanManualRunEntry: ({ onDone }) => <button onClick={onDone}>Save manual session</button> }));
vi.mock('../screens/S23', () => ({ default: ({ activityId }) => <p>Session thread {activityId}</p> }));
const mocks = vi.hoisted(() => ({ apiJson: vi.fn(), getJob: vi.fn() }));
vi.mock('../../../api', () => ({ apiJson: mocks.apiJson, subscribeWakeRetry: () => () => {} }));
vi.mock('../ui/workspace', () => ({ useWorkspace: () => ({ api: { getJob: mocks.getJob } }) }));

let tools;
beforeEach(async () => { tools = await import('./AthleteTools.jsx'); });
function Location() { const location = useLocation(); return <div data-testid="location">{location.pathname}{location.search}</div>; }
function mount(Component, url, props = {}) { return render(<MemoryRouter initialEntries={[url]}><Component {...props} /><Location /></MemoryRouter>); }

it('opens saved comparisons in Runs and preserves its existing query when dismissed', async () => {
  expect(tools.RunsTrainingTools).toBeTypeOf('function');
  mount(tools.RunsTrainingTools, '/runs?year=2026&view=compare');
  expect(await screen.findByText('Saved overlay sessions')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveClass('comparison-modal');
  expect(screen.getByText('training_integration.compare.subtitle')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'profile.close' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/runs?year=2026');
  expect(screen.queryByTestId('training-provider')).not.toBeInTheDocument();
});

it('reuses the manual entry and refreshes the native ledger only after saving', async () => {
  expect(tools.RunsTrainingTools).toBeTypeOf('function');
  const onSaved = vi.fn();
  mount(tools.RunsTrainingTools, '/runs?manual=1&year=2026', { onSaved });
  fireEvent.click(await screen.findByRole('button', { name: 'Save manual session' }));
  expect(onSaved).toHaveBeenCalledOnce();
  expect(screen.getByTestId('location')).toHaveTextContent('/runs?year=2026');
});

it('opens totals without mounting the separate period view', async () => {
  expect(tools.AnalysisTrainingTools).toBeTypeOf('function');
  mount(tools.AnalysisTrainingTools, '/analysis?view=totals');
  expect(await screen.findByText('Sport volume')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveClass('sport-totals-modal');
  expect(screen.queryByText('Period comparison')).not.toBeInTheDocument();
});
it('opens the period dialog with its reference layout and preserves filters on Escape', async () => {
  mount(tools.AnalysisTrainingTools, '/analysis?view=compare&year=2026');
  expect(await screen.findByText('Period comparison')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveClass('periods-modal');
  expect(screen.getByText('training_integration.periods.subtitle')).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByTestId('location')).toHaveTextContent('/analysis?year=2026');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('keeps the separately identified HR/RPE model within existing load balance',async()=>{
 mount(tools.FitnessModelTool,'/analysis/load-balance?fitness=1');
 expect(await screen.findByText('Distinct fitness model estimates')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'profile.close'}));
 expect(screen.getByTestId('location')).toHaveTextContent('/analysis/load-balance');
});

it('resolves a native session to its authorized workspace identity before opening the thread', async () => {
  expect(tools.SessionConversationTool).toBeTypeOf('function');
  mocks.apiJson.mockResolvedValue({ id: 'workspace-session', canonicalId: 42 });
  mount(tools.SessionConversationTool, '/runs/42?conversation=1', { canonicalId: 42 });
  expect(await screen.findByText('Session thread workspace-session')).toBeInTheDocument();
  expect(mocks.apiJson).toHaveBeenCalledWith('/api/training/activities/by-canonical/42');
});

it('does not open a conversation when the canonical resolver rejects access', async () => {
  expect(tools.SessionConversationTool).toBeTypeOf('function');
  mocks.apiJson.mockRejectedValue(new Error('Access denied'));
  mount(tools.SessionConversationTool, '/runs/42?conversation=1', { canonicalId: 42 });
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.queryByText(/Session thread/)).not.toBeInTheDocument();
});

it('checks an import job without introducing a second file picker', async () => {
  expect(tools.QueuedImportStatus).toBeTypeOf('function');
  mocks.getJob.mockResolvedValue({ id: 'job-123', state: 'completed' });
  const { container } = mount(tools.QueuedImportStatus, '/settings/import-data');
  fireEvent.click(screen.getByText('training_integration.check_import'));
  fireEvent.change(await screen.findByLabelText('training_integration.job_id'), { target: { value: ' job-123 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'training_integration.check_status' }));
  await waitFor(() => expect(mocks.getJob).toHaveBeenCalledWith({ jobId: 'job-123' }));
  expect(await screen.findByRole('status')).toHaveTextContent('completed');
  expect(container.querySelector('input[type="file"]')).toBeNull();
});
