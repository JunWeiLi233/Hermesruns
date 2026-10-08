import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Analysis from '../Analysis';
import en from '../../../i18n/locales/en';
import { apiJson } from '../../../api';
import { cachedApiJson } from '../../../api/resourceCache';
import { buildAnalysisSnapshot } from '../../../utils/analysisInsights';

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('../../../contexts/UnitContext', () => ({ useUnit: () => ({ unit: 'km' }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: 'en', t: (key, values = {}) => {
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
