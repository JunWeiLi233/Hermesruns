import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Analysis from '../Analysis';
import en from '../../../i18n/locales/en';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import { buildAnalysisSnapshot } from '../../../utils/analysisInsights';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', formatNumber: (value, options) => new Intl.NumberFormat('en-US', options).format(value), t: (key, values = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], en) ?? key;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), copy);
} }) }));
vi.mock('../../../api/resourceCache', () => ({ cachedApiJson: vi.fn(), invalidateResourceCache: vi.fn() }));
vi.mock('../../../api', async importOriginal => ({ ...await importOriginal(), apiJson: vi.fn() }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));

let activities;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  vi.stubGlobal('requestIdleCallback', callback => window.setTimeout(callback, 0));
  vi.stubGlobal('cancelIdleCallback', handle => window.clearTimeout(handle));
  activities = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1, name: `Run ${index + 1}`,
    startTime: new Date(Date.UTC(2026, 9, 8 - index, 12)).toISOString(),
    distanceKm: 8, movingTimeSeconds: 2400, averageCadence: 176,
    averageHeartRate: 140, maxHeartRate: 185,
  }));
  cachedApiJson.mockImplementation(async url => url === '/api/activities/analysis' ? activities : { displayName: 'Runner' });
  apiJson.mockImplementation(async url => url === '/api/injury-risk/status'
    ? { risk: 'HIGH', combinedRiskScore: 83, recommendation: 'rest', coachAdvice: 'Protect recovery today.', recentLogs: [{ level: 'high' }] }
    : null);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('opens Trends inside the existing Analysis page and reuses its history without adding another shell', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/analysis']}><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-injury-value')).toHaveTextContent('83 / 100'));
  const panel = container.querySelector('#analysis-trends');
  expect(panel).toBeInTheDocument();
  expect(panel.open).toBe(false);
  fireEvent.click(panel.querySelector('summary'));
  await screen.findByRole('group', { name: en.trends.reads_label });
  expect(container.querySelectorAll('.runner-shell-sidebar')).toHaveLength(1);
  expect(container.querySelectorAll('main')).toHaveLength(1);
  expect(cachedApiJson.mock.calls.filter(([url]) => url === '/api/activities/analysis')).toHaveLength(1);
});

it('groups the evidence under Go deeper, with a compact initial table and tools beside the intro', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/analysis']}><Analysis /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Go deeper' });
  const estimates = container.querySelector('#vo2max-estimates');
  await waitFor(() => expect(estimates.querySelector('tbody tr')).toBeInTheDocument());
  expect(estimates.open).toBe(true);
  expect(estimates.querySelectorAll('.vo2max-estimates-v2__runs tbody tr')).toHaveLength(6);
  expect(container.querySelector('.analysis-v2-intro .athlete-tools-actions')).toBeInTheDocument();
  expect(container.querySelector('#analysis-trends summary .inline-feature__value')).toHaveTextContent('5:00 /km');
  expect(container.querySelector('.analysis-inline-features').children).toHaveLength(3);
});

it('keeps the collapsed trend summary in sync with the selected metric and run filter', async () => {
  const { container } = render(<MemoryRouter initialEntries={['/analysis?metric=distance&runs=race#analysis-trends']}><Analysis /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Go deeper' });
  // These fixtures have no Race labels; a filter with no data must not show an all-runs median.
  expect(container.querySelector('#analysis-trends summary .inline-feature__value')).toHaveTextContent('—');
  expect(container.querySelector('#vo2max-estimates').open).toBe(false);
});

it('uses server risk for the label, color, summary and score even when the run-only signal is low', async () => {
  expect(buildAnalysisSnapshot(activities, 'en', 'km').injury.level).toBe('low');
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-injury-value')).toHaveTextContent('83 / 100'));
  const card = container.querySelector('.analysis-v2-check--injury');
  expect(card.querySelector('.analysis-v2-injury-value strong')).toHaveTextContent(en.analysis.stitch_injury_high);
  expect(card.querySelector('.analysis-v2-risk .is-on')).toHaveClass('is-high');
  expect(card).toHaveTextContent(en.analysis.stitch_injury_prevention_rec_rest);
  expect(container.querySelector('.analysis-v2-intro')).toHaveTextContent(en.analysis.v2_status_injury_high);
  expect(card).toHaveTextContent('Protect recovery today.');
});

it('renders the server moderate risk and caution recommendation coherently', async () => {
  apiJson.mockImplementation(async url => url === '/api/injury-risk/status'
    ? { risk: 'MODERATE', combinedRiskScore: 50, recommendation: 'caution' } : null);
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-injury-value')).toHaveTextContent('50 / 100'));
  const card = container.querySelector('.analysis-v2-check--injury');
  expect(card.querySelector('.analysis-v2-injury-value strong')).toHaveTextContent(en.analysis.stitch_injury_moderate);
  expect(card.querySelector('.analysis-v2-risk .is-on')).toHaveClass('is-moderate');
  expect(card).toHaveTextContent(en.analysis.stitch_injury_prevention_rec_caution);
});

it('falls back to the run-only signal after status failure without inventing a server score or rest recommendation', async () => {
  apiJson.mockImplementation(async url => {
    if (url === '/api/injury-risk/status') throw Error('status unavailable');
    return null;
  });
  const { container } = render(<MemoryRouter><Analysis /></MemoryRouter>);
  await waitFor(() => expect(container.querySelector('.analysis-v2-check-error')).toBeInTheDocument());
  const card = container.querySelector('.analysis-v2-check--injury');
  expect(card.querySelector('.analysis-v2-injury-value strong')).toHaveTextContent(en.analysis.stitch_injury_low);
  expect(card.querySelector('.analysis-v2-risk .is-on')).toHaveClass('is-low');
  expect(card.querySelector('.analysis-v2-injury-value')).not.toHaveTextContent('/ 100');
  expect(card).not.toHaveTextContent(en.analysis.stitch_injury_prevention_rec_rest);
});
