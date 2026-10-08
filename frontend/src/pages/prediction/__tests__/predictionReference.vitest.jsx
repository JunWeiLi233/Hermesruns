import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PredictionDetail from '../PredictionDetail';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';
import { apiJson } from '../../../api';
import { estimateCurrentVdot, predictRaceTimeCalibrated, RACE_DISTANCES } from '../../../utils/vdot';

const state = vi.hoisted(() => ({ lang: 'en', chartData: null }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, email: 'runner@example.test' }) }));
vi.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ lang: state.lang, t: (key, values = {}) => {
  const dictionary = state.lang === 'zh-CN' ? zh : en;
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
} }) }));
vi.mock('../../../api', () => ({ apiJson: vi.fn(), subscribeWakeRetry: () => () => {} }));
vi.mock('../../../components/TopbarUserMenu', () => ({ default: () => null }));
vi.mock('../../../components/TopbarNotifications', () => ({ default: () => null }));
vi.mock('react-chartjs-2', () => ({ Line: ({ data }) => { state.chartData = data; return <div data-testid="forecast-chart" />; } }));

let activities;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T16:00:00Z'));
  state.lang = 'en';
  state.chartData = null;
  activities = Array.from({ length: 35 }, (_, index) => {
    const date = new Date('2026-10-07T12:00:00Z');
    date.setUTCDate(date.getUTCDate() - index);
    return { id: index + 1, startTime: date.toISOString(), name: 'Morning Run', distanceKm: 10,
      movingTimeSeconds: 2800 + index * 12, averageHeartRate: 150, maxHeartRate: 190 };
  });
  apiJson.mockImplementation(async () => activities);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function ChangeDistance() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/prediction/marathon')}>Switch distance</button>;
}

async function openPage(key = 'marathon') {
  const result = render(<MemoryRouter initialEntries={[`/prediction/${key}`]}><Routes>
    <Route path="/prediction/:distKey" element={<><PredictionDetail /><ChangeDistance /></>} />
    <Route path="/today-run" element={<h1>Today destination</h1>} />
    <Route path="/analysis" element={<h1>Analysis destination</h1>} />
  </Routes></MemoryRouter>);
  await screen.findByRole('heading', { level: 1, name: state.lang === 'zh-CN' ? zh.analysis.pred_cockpit_title : en.analysis.pred_cockpit_title });
  return result;
}

function displayedTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(Math.round(seconds % 60)).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}

it.each(RACE_DISTANCES)('uses the real forecast for $key and preserves the shell', async (distance) => {
  const { container } = await openPage(distance.key);
  const current = estimateCurrentVdot(activities);
  const expectedTime = predictRaceTimeCalibrated(current.representativeVdot, distance.meters, activities) * 60;
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent(displayedTime(expectedTime));
  expect(container.querySelector('.runner-shell-topbar')).toBeInTheDocument();
  expect(container.querySelector('.runner-shell-sidebar')).toBeInTheDocument();
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent(distance.labelEn);
  expect(container.querySelector('.prediction-v2-confidence')).not.toBeInTheDocument();
  expect(container.querySelectorAll('.prediction-v2-ladder li')).toHaveLength(4);
  expect(state.chartData.datasets).toHaveLength(1);
  expect(state.chartData.datasets[0].data.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
  expect(apiJson).toHaveBeenCalledWith('/api/activities', {});
});

it('updates the forecast and chart when the route distance changes', async () => {
  const { container } = await openPage('5k');
  const priorTime = container.querySelector('.prediction-forecast-time').textContent;
  const priorTrend = state.chartData.datasets[0].data.at(-1);
  fireEvent.click(screen.getByRole('button', { name: 'Switch distance' }));
  await screen.findByRole('heading', { level: 1, name: en.analysis.pred_cockpit_title });
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent('Marathon');
  expect(container.querySelector('.prediction-forecast-time').textContent).not.toBe(priorTime);
  expect(state.chartData.datasets[0].data.at(-1)).toBeGreaterThan(priorTrend);
});

it.each([
  ['.prediction-v2-primary', 'Today destination'],
  ['.prediction-v2-link', 'Analysis destination'],
])('keeps the action at %s working', async (selector, destination) => {
  const { container } = await openPage();
  fireEvent.click(container.querySelector(selector));
  expect(screen.getByRole('heading', { name: destination })).toBeInTheDocument();
});

it('shows the automatic weather correction in the forecast and trend', async () => {
  activities = activities.map((run) => ({ ...run, pacePenaltySecPerKm: 20, weatherAdjustedMovingTimeSeconds: run.movingTimeSeconds - 200 }));
  const { container } = await openPage();
  const current = estimateCurrentVdot(activities);
  const expected = predictRaceTimeCalibrated(current.adjustedVdot, 42195, activities, { weatherAdjustedAnchors: true }) * 60;
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent(displayedTime(expected));
  expect(container.querySelector('.prediction-v2-weather')).toHaveTextContent(en.analysis.vdot_raw);
  expect(container.querySelector('.prediction-v2-weather')).toHaveTextContent(en.analysis.vdot_weather_adjusted);
  expect(state.chartData.datasets).toHaveLength(2);
});

it.each(['empty', 'failed'])('avoids invented forecasts when activities are %s', async (mode) => {
  if (mode === 'empty') activities = [];
  else apiJson.mockRejectedValue(new Error('Unavailable'));
  const { container } = await openPage();
  expect(container.querySelector('.prediction-forecast-time')).toHaveTextContent('--');
  expect(container.querySelector('.prediction-v2-hero')).toHaveTextContent(en.analysis.pred_cockpit_basis_empty);
  expect(container.querySelectorAll('.prediction-v2-ladder li')).toHaveLength(0);
  expect(screen.queryByTestId('forecast-chart')).not.toBeInTheDocument();
  expect(container.querySelector('.prediction-v2-weather')).not.toBeInTheDocument();
});

it('renders Chinese copy without unresolved placeholders', async () => {
  state.lang = 'zh-CN';
  const { container } = await openPage('half');
  expect(container.querySelector('.prediction-v2-kicker')).toHaveTextContent('半程马拉松');
  expect(container.querySelector('.prediction-v2-ladder')).toHaveTextContent(zh.analysis.pred_effort_title);
  expect(container.querySelector('.prediction-v2').textContent).not.toMatch(/\{(?:count|date|dist|value)\}/);
});
