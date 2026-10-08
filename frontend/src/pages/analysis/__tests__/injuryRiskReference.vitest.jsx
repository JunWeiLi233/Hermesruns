import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisInsightDetail from '../AnalysisInsightDetail';
import enPages from '../../../i18n/locales/en/pages';
import enComponents from '../../../i18n/locales/en/components';
import { cachedApiJson } from '../../../api/resourceCache';
import { apiJson } from '../../../api';
import { buildAnalysisSnapshot } from '../../../utils/analysisInsights';

const preferences = vi.hoisted(() => ({ unit: 'km' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key, values = {}) => {
  const [section, name] = key.split('.');
  const copy = enComponents[section]?.[name] ?? enPages[section]?.[name] ?? key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy);
} }) }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../api', async importOriginal => ({ ...await importOriginal(), apiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  preferences.unit = 'km';
  activities = Array.from({ length: 60 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, name: `Run ${index + 1}`, startTime: date.toISOString(), distanceKm: 8, movingTimeSeconds: 2400, averageCadence: 176, averageHeartRate: 140, maxHeartRate: 185 };
  });
  cachedApiJson.mockImplementation(async url => url === '/api/activities' ? activities : { displayName: 'Runner' });
  apiJson.mockReset();
  apiJson.mockResolvedValue({ recentLogs: [{ level: 'low' }] });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/analysis/injury-risk']}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
    <Route path="/today-run" element={<h1>Today's plan</h1>} />
    <Route path="/runs" element={<h1>All activities</h1>} />
    <Route path="/runs/:runId" element={<h1>Run detail</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Load vs. cadence', level: 2 });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Fresh' })).toBeEnabled());
  return result;
}

it('keeps the shell, uses the live score, and shows all runs in the six-week window', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  const score = buildAnalysisSnapshot(activities, 'en', 'km').injury.score;
  expect(container.querySelector('.analysis-injury-v2-number strong')).toHaveTextContent(String(score));
  expect(container.querySelectorAll('[data-analysis-history="injury"] li')).toHaveLength(42);
  expect(container.querySelector('[data-analysis-history="injury"]')).not.toHaveTextContent('Run 43');
  const runs = container.querySelector('.analysis-injury-v2-runs');
  expect(runs.querySelectorAll('li')).toHaveLength(4);
  expect(runs).toHaveTextContent('176 spm');
  expect(runs).toHaveTextContent('140 bpm');
  fireEvent.click(screen.getByRole('button', { name: "Open today's run" }));
  expect(screen.getByRole('heading', { name: "Today's plan" })).toBeInTheDocument();
});

it('uses miles in recent runs and opens the actual run', async () => {
  preferences.unit = 'mile';
  const { container } = await openPage();
  const run = container.querySelector('.analysis-injury-v2-runs li button');
  expect(run).toHaveTextContent('5.0 mi');
  fireEvent.click(run);
  expect(screen.getByRole('heading', { name: 'Run detail' })).toBeInTheDocument();
});

it('opens the full run list', async () => {
  await openPage();
  fireEvent.click(screen.getByRole('button', { name: 'All runs ›' }));
  expect(screen.getByRole('heading', { name: 'All activities' })).toBeInTheDocument();
});

it('shows an empty baseline without displaying healthy signal values', async () => {
  activities = [];
  const { container } = await openPage();
  expect(screen.getByRole('heading', { name: 'Your baseline is forming.' })).toBeInTheDocument();
  expect(container.querySelector('.analysis-injury-v2-number strong')).toHaveTextContent('--');
  expect(container.querySelector('.analysis-injury-v2-scale-track i')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.analysis-injury-v2-signal .is-unavailable')).toHaveLength(3);
  expect(container.querySelectorAll('[data-analysis-history="injury"] li')).toHaveLength(0);
});

it('does not label missing cadence and heart-rate measurements as stable', async () => {
  activities = activities.map(run => ({ ...run, averageCadence: null, averageHeartRate: null }));
  const { container } = await openPage();
  const signals = container.querySelectorAll('.analysis-injury-v2-signal');
  expect(signals[0]).toHaveTextContent('No baseline');
  expect(signals[1]).toHaveTextContent('No baseline');
  expect(signals[0].querySelector('strong')).toHaveTextContent('--');
  expect(signals[1].querySelector('strong')).toHaveTextContent('--');
  expect(container.querySelector('.analysis-cinematic-comparison-line')).toHaveAttribute('d', '');
});

it('asks before writing soreness, saves only after confirmation, and preserves selection after a failed refresh', async () => {
  await openPage();
  fireEvent.click(screen.getByRole('button', { name: 'Some' }));
  const dialog = screen.getByRole('dialog');
  expect(apiJson.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  apiJson.mockImplementation(async (url, options) => {
    if (options?.method === 'POST') return {};
    throw Error('refresh failed');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Some' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save check-in' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Some' })).toHaveAttribute('aria-pressed', 'true'));
  expect(apiJson).toHaveBeenCalledWith('/api/injury-risk/log', expect.objectContaining({ method: 'POST', body: JSON.stringify({ level: 'medium' }) }));
});

it('retains the saved soreness selection and shows an error when a write fails', async () => {
  await openPage();
  apiJson.mockRejectedValueOnce(Error('write failed'));
  fireEvent.click(screen.getByRole('button', { name: 'Sore' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save check-in' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Fresh' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Sore' })).toBeEnabled();
});
