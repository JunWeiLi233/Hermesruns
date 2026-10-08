import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AnalysisInsightDetail from '../AnalysisInsightDetail';
import en from '../../../i18n/locales/en/pages';
import { cachedApiJson } from '../../../api/resourceCache';

const preferences = vi.hoisted(() => ({ unit: 'km' }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key, values = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => preferences }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  preferences.unit = 'km';
  activities = Array.from({ length: 90 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, name: `Run ${index + 1}`, startTime: date.toISOString(), distanceKm: 8 + index % 3, movingTimeSeconds: (8 + index % 3) * 320, averageHeartRate: 140, maxHeartRate: 185 };
  });
  cachedApiJson.mockImplementation(async (url) => url === '/api/activities' ? activities : { displayName: 'Runner' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

async function openPage() {
  const result = render(<MemoryRouter initialEntries={['/analysis/load-balance']}><Routes>
    <Route path="/analysis/:insightKey" element={<AnalysisInsightDetail />} />
    <Route path="/today-run" element={<h1>Today's plan</h1>} />
    <Route path="/runs/:runId" element={<h1>Run detail</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { level: 2, name: 'Acute vs. chronic load' });
  return result;
}

it('keeps the shell, projects seven days, and changes the actual chart window', async () => {
  const { container } = await openPage();
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelectorAll('.analysis-load-v2-budget li')).toHaveLength(7);
  const history = () => container.querySelectorAll('[data-analysis-history="load"] li');
  expect(history()).toHaveLength(56);
  expect(container.querySelector('.analysis-load-v2-band')).toHaveAttribute('d', expect.stringContaining(' Z'));
  fireEvent.click(screen.getByRole('button', { name: '4 wk' }));
  expect(history()).toHaveLength(28);
  expect(screen.getByRole('button', { name: '4 wk' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '12 wk' }));
  expect(history()).toHaveLength(84);
  expect(container.querySelectorAll('.analysis-load-v2-metric')).toHaveLength(4);
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Weekly volume');
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Monotony');
  expect(container.querySelectorAll('.analysis-load-v2-driver')).toHaveLength(7);
  fireEvent.click(screen.getByRole('button', { name: "Open today's run" }));
  expect(screen.getByRole('heading', { name: "Today's plan" })).toBeInTheDocument();
});

it('uses the selected distance unit and opens the contributing run', async () => {
  preferences.unit = 'mile';
  const { container } = await openPage();
  const metrics = container.querySelector('.analysis-load-v2-metrics');
  expect(metrics).toHaveTextContent('38.5 mi');
  const run = container.querySelector('.analysis-load-v2-driver');
  expect(within(run).getByLabelText('Distance')).toHaveTextContent('mi');
  fireEvent.click(run);
  expect(screen.getByRole('heading', { name: 'Run detail' })).toBeInTheDocument();
});

it('shows unavailable load data without inventing a budget or baseline', async () => {
  activities = [];
  const { container } = await openPage();
  expect(container.querySelectorAll('.analysis-load-v2-budget li')).toHaveLength(0);
  expect(container.querySelector('.analysis-load-v2-window')).toHaveTextContent('Not enough data');
  expect(container.querySelector('.analysis-load-v2-ratio > strong')).toHaveTextContent('--');
  expect(container.querySelector('.analysis-load-v2-band')).not.toBeInTheDocument();
  expect(container.querySelector('.analysis-load-v2-metrics')).toHaveTextContent('Baseline forming');
});
